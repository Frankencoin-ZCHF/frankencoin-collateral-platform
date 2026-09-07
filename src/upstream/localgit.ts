/**
 * Local-git backend for the assessments repository (offline / test environment).
 * Mirrors the subset of the GitHub API that src/upstream/github.ts exposes, by running
 * `git` against a local clone (ASSESSMENTS_LOCAL_PATH). Read-only; no network.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "@/config";
import { UpstreamError, NotFoundError } from "@/lib/errors";
import type { CommitInfo, TreeEntry } from "./github";

const run = promisify(execFile);
const SOURCE = "local-git";

async function git(args: string[]): Promise<string> {
  try {
    const { stdout } = await run("git", args, { cwd: config.assessmentsLocalPath, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    return stdout;
  } catch (e) {
    const msg = String((e as { stderr?: string }).stderr ?? (e as Error).message);
    if (/does not exist|not found|exists on disk, but not in|bad object|unknown revision/i.test(msg)) throw new NotFoundError(SOURCE, args.slice(-1)[0]);
    throw new UpstreamError(SOURCE, undefined, `local git failed: ${msg.split("\n")[0]}`);
  }
}

const FORMAT = "%H%x1f%cI%x1f%an%x1f%s";
function parseCommit(line: string): CommitInfo | null {
  const [sha, date, author, message] = line.split("\x1f");
  if (!sha) return null;
  return { sha, date: date ?? "", author: author ?? "unknown", authorLogin: null, authorAvatar: null, message: message ?? "", url: `file://${config.assessmentsLocalPath}#${sha}` };
}

export async function tree(ref: string): Promise<{ sha: string; truncated: boolean; entries: TreeEntry[] }> {
  const out = await git(["ls-tree", "-r", "--long", ref]);
  const entries: TreeEntry[] = out
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      // <mode> SP <type> SP <sha> SP+ <size> TAB <path>
      const [meta, path] = l.split("\t");
      const [, type, sha, size] = (meta ?? "").trim().split(/\s+/);
      return { path: path ?? "", type: (type as TreeEntry["type"]) ?? "blob", sha: sha ?? "", size: size === "-" ? undefined : Number(size) };
    });
  const sha = (await git(["rev-parse", `${ref}^{tree}`])).trim();
  return { sha, truncated: false, entries };
}

export async function commitForRef(ref: string): Promise<CommitInfo> {
  const c = parseCommit((await git(["log", "-1", `--format=${FORMAT}`, ref])).trim());
  if (!c) throw new NotFoundError(SOURCE, ref);
  return c;
}

export function rawFile(ref: string, path: string): Promise<string> {
  return git(["show", `${ref}:${path}`]);
}

export async function commitsForPath(ref: string, path: string): Promise<CommitInfo[]> {
  const out = await git(["log", "-n", "100", `--format=${FORMAT}`, ref, "--", path]);
  return out.split("\n").map(parseCommit).filter((c): c is CommitInfo => c !== null);
}
