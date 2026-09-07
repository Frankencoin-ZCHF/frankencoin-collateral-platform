/**
 * Assessments service: index of all collateral assessments, one by ticker, version
 * history, content at a given commit, and the framework document.
 */

import { config } from "@/config";
import { getOrLoad, TTL } from "@/lib/cache";
import {
  ASSESSMENTS_DIR,
  ASSESSMENT_IGNORED_FILES,
  ASSESSMENT_STATUSES,
  FRAMEWORK_PATH,
  GITHUB_WEB,
} from "@/lib/constants";
import { describeForLog, NotFoundError } from "@/lib/errors";
import { FrontmatterError, parseAssessmentFile } from "@/lib/frontmatter";
import { normalizeAssessment } from "@/lib/normalize";
import { slugFromTicker } from "@/lib/slug";
import * as github from "@/upstream/github";
import type { Assessment, AssessmentStatus, ParseFailure, VersionRef } from "@/types";

const repo = () => config.assessmentsRepo;
const ref = () => config.assessmentsRef;

export interface AssessmentIndex {
  items: Assessment[];
  failures: ParseFailure[];
  head: VersionRef | null;
  fetchedAt: string;
}

const FILE_RE = new RegExp(`^${ASSESSMENTS_DIR}/(${ASSESSMENT_STATUSES.join("|")})/([^/]+)\\.md$`);

function parseTreePath(path: string): { status: AssessmentStatus; ticker: string } | null {
  const m = FILE_RE.exec(path);
  if (!m) return null;
  const file = path.split("/").pop() ?? "";
  if (ASSESSMENT_IGNORED_FILES.has(file)) return null;
  return { status: m[1] as AssessmentStatus, ticker: m[2] as string };
}

function toVersionRef(c: github.CommitInfo, path: string): VersionRef {
  return {
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    date: c.date,
    author: c.author,
    authorLogin: c.authorLogin,
    message: c.message,
    path,
    url: c.url,
  };
}

/**
 * Parse a raw file into an Assessment. Throws FrontmatterError on invalid input.
 * A *published* assessment must also be internally consistent: a future assessment date
 * or a missing contract address is a hard failure there (drafts merely get flagged later).
 */
export function buildAssessment(source: string, path: string, status: AssessmentStatus, tickerFromPath: string, refInfo: VersionRef | null, today = new Date().toISOString().slice(0, 10)): Assessment {
  const { frontmatter, body } = parseAssessmentFile(source);
  const data = normalizeAssessment(frontmatter);
  const ticker = data.ticker || tickerFromPath;
  if (status === "published") {
    if (!data.address) throw new FrontmatterError("Published assessment has no valid contract_address");
    if (data.assessmentDate && data.assessmentDate > today) throw new FrontmatterError(`Published assessment is dated in the future (${data.assessmentDate})`);
  }
  return {
    ticker,
    slug: slugFromTicker(tickerFromPath),
    status,
    path,
    ref: refInfo,
    raw: frontmatter,
    data,
    body,
    source,
  };
}

/**
 * All assessments at the configured ref. Parse failures never fail the index.
 *
 * Coherence: the ref is resolved to ONE commit sha first, and the tree and every file are
 * then read at that immutable sha — a push in the middle can never mix two states.
 */
export function index(): Promise<AssessmentIndex> {
  return getOrLoad(`svc:assessments:index@${repo()}@${ref()}`, 5 * TTL.MINUTE, async () => {
    const headCommit = await github.commitForRef(repo(), ref());
    const t = await github.tree(repo(), headCommit.sha);

    const candidates = t.entries
      .filter((e) => e.type === "blob")
      .map((e) => ({ entry: e, meta: parseTreePath(e.path) }))
      .filter((c): c is { entry: github.TreeEntry; meta: { status: AssessmentStatus; ticker: string } } => c.meta !== null);

    const failures: ParseFailure[] = [];
    const bySlug = new Map<string, Assessment>();
    const precedence = (s: AssessmentStatus) => ASSESSMENT_STATUSES.indexOf(s);

    const results = await Promise.allSettled(
      candidates.map(async ({ entry, meta }) => {
        const source = await github.rawFile(repo(), headCommit.sha, entry.path);
        return buildAssessment(source, entry.path, meta.status, meta.ticker, toVersionRef(headCommit, entry.path));
      }),
    );

    results.forEach((r, i) => {
      const path = candidates[i]!.entry.path;
      if (r.status === "rejected") {
        failures.push({ path, error: (r.reason as Error)?.message ?? String(r.reason) });
        console.error(`[assessments] skipped ${path}: ${describeForLog(r.reason)}`);
        return;
      }
      const a = r.value;
      const existing = bySlug.get(a.slug);
      if (!existing || precedence(a.status) < precedence(existing.status)) bySlug.set(a.slug, a);
    });

    const items = [...bySlug.values()].sort((a, b) => a.ticker.localeCompare(b.ticker, "en", { sensitivity: "base" }));
    return {
      items,
      failures,
      head: toVersionRef(headCommit, ""),
      fetchedAt: new Date().toISOString(),
    };
  }, { swrMs: 30 * TTL.MINUTE });
}

export async function bySlug(slug: string): Promise<Assessment | null> {
  const { items } = await index();
  return items.find((a) => a.slug === slug) ?? null;
}

/**
 * Version history for a ticker. Because a file moves between draft/published/deprecated
 * (and `?path=` does not follow renames), all three candidate paths are queried and
 * merged by sha.
 */
export function versions(slug: string): Promise<VersionRef[]> {
  return getOrLoad(`svc:assessments:versions:${slug}`, 5 * TTL.MINUTE, async () => {
    const current = await bySlug(slug);
    if (!current) throw new NotFoundError("assessments", slug);
    const fileName = current.path.split("/").pop()!;
    const paths = ASSESSMENT_STATUSES.map((s) => `${ASSESSMENTS_DIR}/${s}/${fileName}`);

    const lists = await Promise.allSettled(paths.map((p) => github.commitsForPath(repo(), ref(), p)));
    const bySha = new Map<string, VersionRef>();
    lists.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      for (const c of r.value) {
        // Same sha can touch two paths in a move commit — keep the destination (current folder wins).
        const existing = bySha.get(c.sha);
        if (!existing || paths[i] === current.path) bySha.set(c.sha, toVersionRef(c, paths[i]!));
      }
    });
    return [...bySha.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, { swrMs: 30 * TTL.MINUTE });
}

/** The assessment as it was at `sha`. */
export async function atVersion(slug: string, sha: string): Promise<{ assessment: Assessment; version: VersionRef; all: VersionRef[] }> {
  const all = await versions(slug);
  const version = all.find((v) => v.sha === sha || v.sha.startsWith(sha));
  if (!version) throw new NotFoundError("assessments", `${slug}@${sha}`);
  const status = (version.path.split("/")[1] ?? "draft") as AssessmentStatus;
  const ticker = version.path.split("/").pop()!.replace(/\.md$/, "");
  const source = await github.rawFile(repo(), version.sha, version.path);
  return { assessment: buildAssessment(source, version.path, status, ticker, version), version, all };
}

export function frameworkMarkdown(): Promise<string> {
  return github.rawFile(repo(), ref(), FRAMEWORK_PATH);
}

export function repoUrl(): string {
  return `${GITHUB_WEB}/${repo()}`;
}

export function fileUrl(path: string, sha?: string): string {
  return `${GITHUB_WEB}/${repo()}/blob/${sha ?? ref()}/${path}`;
}

export function historyUrl(path: string): string {
  return `${GITHUB_WEB}/${repo()}/commits/${ref()}/${path}`;
}
