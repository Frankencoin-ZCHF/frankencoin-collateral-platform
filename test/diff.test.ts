import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { flatten, structuredDiff, textPatch } from "@/lib/diff";
import { parseAssessmentFile } from "@/lib/frontmatter";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("structuredDiff", () => {
  it("flattens nested objects and arrays with dotted keys", () => {
    expect(flatten({ a: { b: 1, c: [{ d: "x" }] }, e: null })).toEqual({ "a.b": 1, "a.c[0].d": "x", e: null });
  });

  it("reports changed / added / removed fields between two versions of an assessment", () => {
    const v1 = parseAssessmentFile(fixture("wstETH.md")).frontmatter;
    const v2 = structuredClone(v1);
    v2.risk_parameters.retained_reserve = 0.3;
    v2.risk_scores.tail_risks.legal_risks[0]!.compensation = "0.1%";
    (v2.links as Record<string, unknown>).discussion = "https://github.com/x/y/discussions/1";
    delete (v2.links as Record<string, unknown>).other;

    const changes = structuredDiff(v1, v2);
    const byKey = Object.fromEntries(changes.map((c) => [c.key, c]));
    expect(byKey["risk_parameters.retained_reserve"]).toMatchObject({ kind: "changed", before: 0.25, after: 0.3, group: "risk_parameters" });
    expect(byKey["risk_scores.tail_risks.legal_risks[0].compensation"]).toMatchObject({ kind: "changed", before: "0%", after: "0.1%" });
    expect(byKey["links.discussion"]).toMatchObject({ kind: "added" });
    expect(byKey["links.other"]).toMatchObject({ kind: "removed" });
    expect(changes).toHaveLength(4);
  });

  it("returns no changes for identical input", () => {
    const v = parseAssessmentFile(fixture("WBTC.md")).frontmatter;
    expect(structuredDiff(v, structuredClone(v))).toEqual([]);
  });
});

describe("textPatch", () => {
  it("produces a unified diff of the markdown body", () => {
    const patch = textPatch("a.md", "b.md", "# T\n\nline one\nline two\n", "# T\n\nline one changed\nline two\n");
    expect(patch).toContain("-line one");
    expect(patch).toContain("+line one changed");
  });
});
