import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import narrative from "@/blocks/system/narrative";
import { blockIssues } from "@/blocks/content/registry";
import { buildAssessment } from "@/services/assessments";
import type { BlockContext } from "@/blocks/types";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/** wstETH with four fences injected after "## Public Information": valid callout, valid documents, unknown type, api → private IP. */
function withFences(): string {
  const fences = [
    "```block\ntype: callout\ntitle: Note\ntext: Rendered **inline**\nvariant: warning\n```",
    "```block\ntype: documents\nitems:\n  - label: Audit\n    url: https://example.com/audit.pdf\n```",
    "```block\ntype: nope\n```",
    "```block\ntype: api\nlabel: Meta\nurl: https://169.254.169.254/latest/meta-data\npath: x\n```",
  ].join("\n\n");
  return fixture("wstETH.md").replace("## Public Information\n", `## Public Information\n\n${fences}\n\n`);
}

function ctxFor(source: string): BlockContext {
  const assessment = buildAssessment(source, "assessments/draft/wstETH.md", "draft", "wstETH", null);
  const record = { slug: "wsteth", ticker: "wstETH", name: "Wrapped Staked ETH", address: assessment.data.address, kind: "assessed" as const, assessment, live: null, addressMismatch: null };
  return { record, assessment, isHistorical: false, version: null, versions: [], origin: "http://localhost" };
}

describe("narrative block + content blocks (no network)", () => {
  it("renders fences inline in the right section, with notices for invalid/blocked blocks", async () => {
    const data = (await narrative.load(ctxFor(withFences())))!;
    expect(data).not.toBeNull();

    const section = data.sections.find((s) => s.heading === "Public Information")!;
    const blocks = section.parts.filter((p) => p.block).map((p) => p.block!);
    expect(blocks.map((b) => [b.type, b.status])).toEqual([
      ["callout", "ok"],
      ["documents", "ok"],
      ["?", "invalid"],
      ["api", "error"],
    ]);
    expect((blocks[0]!.data as { html: string }).html).toContain("<strong>inline</strong>");
    expect(blocks[2]!.error).toMatch(/Unknown block type "nope"/);
    expect(blocks[3]!.error).toMatch(/private|Blocked/);

    // Other sections untouched, headings intact.
    expect(data.sections.find((s) => s.heading === "Market Risk")!.parts.every((p) => !p.block)).toBe(true);
    expect(data.headings.some((h) => h.text === "Conclusion")).toBe(true);

    // Issues are surfaced for /health.
    const issues = blockIssues();
    expect(issues.some((i) => i.collateral === "wsteth" && /Unknown block type/.test(i.error))).toBe(true);
    expect(issues.some((i) => i.collateral === "wsteth" && i.type === "api")).toBe(true);
  });

  it("returns plain sections when there are no fences", async () => {
    const data = (await narrative.load(ctxFor(fixture("wstETH.md"))))!;
    expect(data.sections.every((s) => s.parts.every((p) => p.block === null))).toBe(true);
    expect(data.sections.map((s) => s.heading)).toContain("Summary");
  });
});
