import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clear } from "@/lib/cache";
import { NotFoundError, UpstreamError } from "@/lib/errors";
import { atVersion, index } from "@/services/assessments";
import * as github from "@/upstream/github";

vi.mock("@/upstream/github", () => ({ commitForRef: vi.fn(), tree: vi.fn(), rawFile: vi.fn(), commitsForPath: vi.fn() }));
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const HEAD = "a".repeat(40), MOVED = "b".repeat(40);
const commit = (sha: string): github.CommitInfo => ({ sha, date: "2026-11-10T00:00:00Z", author: "Author", authorLogin: null, authorAvatar: null, message: "Assessment update", url: `https://github.com/example/assessments/commit/${sha}` });
const tree = (paths: string[]) => ({ sha: "tree", truncated: false, entries: paths.map((path) => ({ path, type: "blob" as const, sha: "blob" })) });

beforeEach(() => {
  clear();
  vi.resetAllMocks();
  vi.mocked(github.commitForRef).mockResolvedValue(commit(HEAD));
});

describe("assessment index and version fallback", () => {
  it("loads mixed schemas from one immutable snapshot and isolates a broken file", async () => {
    const files: Record<string, string> = {
      "assessments/publish/WBTC.md": fixture("WBTC.md"),
      "assessments/published/WBTC.md": fixture("current-schema/WBTC.md"),
      "assessments/draft/NEAR.md": fixture("current-schema/NEAR.md"),
      "assessments/draft/wstETH.md": fixture("wstETH.md"),
      "assessments/draft/BROKEN.md": '---\n{"broken":\n---\nReadable text',
    };
    vi.mocked(github.tree).mockResolvedValue(tree(Object.keys(files)));
    vi.mocked(github.rawFile).mockImplementation(async (_repo, sha, path) => {
      expect(sha).toBe(HEAD);
      return files[path]!;
    });
    const result = await index();
    expect(result.items.map((a) => a.ticker).sort()).toEqual(["NEAR", "WBTC", "wstETH"]);
    expect(result.items.find((a) => a.ticker === "WBTC")?.data.params.globalMintingLimit).toBe("no limit");
    expect(result.items.find((a) => a.ticker === "WBTC")?.path).toBe("assessments/published/WBTC.md");
    expect(result.items.find((a) => a.ticker === "wstETH")?.data.params.liquidationPrice).toBe(1300);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.path).toBe("assessments/draft/BROKEN.md");
  });

  it.each(["published", "publish", "deprecated"])("finds the historical destination in %s after a later move back to draft", async (folder) => {
    const currentPath = "assessments/draft/WBTC.md";
    const destination = `assessments/${folder}/WBTC.md`;
    vi.mocked(github.tree).mockImplementation(async (_repo, sha) => tree([sha === HEAD ? currentPath : destination]));
    vi.mocked(github.commitsForPath).mockImplementation(async (_repo, _ref, path) => path === currentPath ? [commit(HEAD), commit(MOVED)] : path === destination ? [commit(MOVED)] : []);
    vi.mocked(github.rawFile).mockImplementation(async (_repo, sha, path) => {
      if (sha === HEAD && path === currentPath) return fixture("current-schema/WBTC.md");
      if (sha === MOVED && path === destination) return fixture("WBTC.md");
      throw new NotFoundError("github", path);
    });
    const result = await atVersion("wbtc", MOVED);
    expect(result.assessment.path).toBe(destination);
    expect(result.assessment.status).toBe(folder === "publish" ? "published" : folder);
    expect(result.version).toMatchObject({ path: destination, sha: MOVED });
    expect(result.assessment.source).toBe(fixture("WBTC.md"));
    expect(result.assessment.data.params.maturityMonths).toBeNull();
    expect(result.all.find((v) => v.sha === MOVED)?.path).toBe(destination);
  });

  it("does not substitute another file or version after a network failure", async () => {
    const path = "assessments/draft/WBTC.md";
    vi.mocked(github.tree).mockResolvedValue(tree([path]));
    vi.mocked(github.commitsForPath).mockImplementation(async (_repo, _ref, p) => p === path ? [commit(HEAD), commit(MOVED)] : []);
    vi.mocked(github.rawFile).mockImplementation(async (_repo, sha) => {
      if (sha === HEAD) return fixture("current-schema/WBTC.md");
      throw new UpstreamError("github", 503);
    });
    await expect(atVersion("wbtc", MOVED)).rejects.toBeInstanceOf(UpstreamError);
    expect(github.tree).toHaveBeenCalledTimes(1);
  });
});
