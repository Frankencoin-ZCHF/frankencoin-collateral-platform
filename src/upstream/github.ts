/**
 * GitHub client for the assessments repo + discussions.
 *
 *  - Repo index:  Git Trees API (1 call) + commit lookup for the ref (1 call)
 *  - File bodies: raw.githubusercontent.com — does NOT consume the REST API quota
 *  - History:     Commits API, filtered by path
 *  - Discussions: GraphQL (token required; without one every call throws MissingSecretError
 *                 *before* any network I/O — the degradable-secret pattern from frankencoin-mcp)
 *
 * `repo` and `path` values are always built from config/constants or from values already
 * validated against the repo index — never from raw request input.
 */

import { config } from "@/config";
import { getOrLoad, TTL } from "@/lib/cache";
import { GITHUB_API, GITHUB_RAW } from "@/lib/constants";
import { MissingSecretError, UpstreamError } from "@/lib/errors";
import { fetchJson, fetchText } from "./client";

const SOURCE = "github";

function authHeaders(): Record<string, string> {
  return config.githubToken ? { Authorization: `Bearer ${config.githubToken}` } : {};
}

function restHeaders(): Record<string, string> {
  return { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...authHeaders() };
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

export interface CommitInfo {
  sha: string;
  date: string;
  author: string;
  authorLogin: string | null;
  authorAvatar: string | null;
  message: string;
  url: string;
}

interface RawCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string }; committer: { name: string; date: string } };
  author: { login: string; avatar_url: string } | null;
}

function mapCommit(c: RawCommit): CommitInfo {
  return {
    sha: c.sha,
    date: c.commit.committer?.date ?? c.commit.author?.date,
    author: c.commit.author?.name ?? c.author?.login ?? "unknown",
    authorLogin: c.author?.login ?? null,
    authorAvatar: c.author?.avatar_url ?? null,
    message: (c.commit.message ?? "").split("\n")[0] ?? "",
    url: c.html_url,
  };
}

/** Full recursive tree of the repo at `ref`. */
export function tree(repo: string, ref: string): Promise<{ sha: string; truncated: boolean; entries: TreeEntry[] }> {
  return getOrLoad(`gh:tree:${repo}@${ref}`, 5 * TTL.MINUTE, async () => {
    const data = await fetchJson<{ sha: string; truncated: boolean; tree: TreeEntry[] }>(
      `${GITHUB_API}/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
      { source: SOURCE, headers: restHeaders() },
    );
    return { sha: data.sha, truncated: Boolean(data.truncated), entries: data.tree ?? [] };
  }, { swrMs: 30 * TTL.MINUTE });
}

/** The commit a ref (branch/tag/sha) currently points to. */
export function commitForRef(repo: string, ref: string): Promise<CommitInfo> {
  return getOrLoad(`gh:ref:${repo}@${ref}`, 5 * TTL.MINUTE, async () => {
    const c = await fetchJson<RawCommit>(`${GITHUB_API}/repos/${repo}/commits/${encodeURIComponent(ref)}`, {
      source: SOURCE,
      headers: restHeaders(),
    });
    return mapCommit(c);
  }, { swrMs: 30 * TTL.MINUTE });
}

/** Raw file content. Immutable when `ref` is a full sha → cached for a day. */
export function rawFile(repo: string, ref: string, path: string): Promise<string> {
  const immutable = /^[0-9a-f]{40}$/.test(ref);
  const ttl = immutable ? TTL.DAY : 5 * TTL.MINUTE;
  return getOrLoad(`gh:raw:${repo}@${ref}/${path}`, ttl, () =>
    fetchText(`${GITHUB_RAW}/${repo}/${ref}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      source: SOURCE,
      headers: authHeaders(),
    }),
    { swrMs: immutable ? 0 : 30 * TTL.MINUTE },
  );
}

/** Commits touching `path` on `ref`, newest first (max 100). */
export function commitsForPath(repo: string, ref: string, path: string): Promise<CommitInfo[]> {
  return getOrLoad(`gh:commits:${repo}@${ref}:${path}`, 5 * TTL.MINUTE, async () => {
    const list = await fetchJson<RawCommit[]>(
      `${GITHUB_API}/repos/${repo}/commits?sha=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}&per_page=100`,
      { source: SOURCE, headers: restHeaders() },
    );
    return (list ?? []).map(mapCommit);
  }, { swrMs: 30 * TTL.MINUTE });
}

/** GraphQL — requires a token. Throws MissingSecretError without touching the network. */
export async function graphql<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!config.githubToken) throw new MissingSecretError(SOURCE, "GITHUB_TOKEN");
  const data = await fetchJson<{ data?: T; errors?: { message: string }[] }>(`${GITHUB_API}/graphql`, {
    source: `${SOURCE}-graphql`,
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    retry: false,
  });
  if (data.errors?.length) throw new UpstreamError(SOURCE, undefined, `GraphQL: ${data.errors.map((e) => e.message).join("; ")}`);
  if (!data.data) throw new UpstreamError(SOURCE, undefined, "GraphQL: empty response");
  return data.data;
}

export function hasToken(): boolean {
  return Boolean(config.githubToken);
}
