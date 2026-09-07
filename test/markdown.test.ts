import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderMarkdown, splitAtPlaceholders, splitSections } from "@/lib/markdown";
import { parseAssessmentFile } from "@/lib/frontmatter";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("renderMarkdown", () => {
  it("renders the wstETH narrative with heading ids and external links", () => {
    const { body } = parseAssessmentFile(fixture("wstETH.md"));
    const r = renderMarkdown(body);
    expect(r.html).toContain('<h2 id="summary">Summary</h2>');
    expect(r.headings.some((h) => h.text === "Market Risk" && h.level === 2)).toBe(true);
    expect(r.headings.some((h) => h.text.startsWith("Counterparty Risk") && h.level === 3)).toBe(true);
    expect(r.fences).toHaveLength(0);
    const sections = splitSections(r.html);
    expect(sections.map((s) => s.heading)).toContain("Market Risk");
  });

  it("lifts ```block fences into placeholders and keeps their position", () => {
    const md = "## A\n\ntext\n\n```block\ntype: callout\ntext: hi\n```\n\nmore\n\n```js\nconsole.log(1)\n```\n";
    const r = renderMarkdown(md);
    expect(r.fences).toEqual([{ index: 0, yaml: "type: callout\ntext: hi" }]);
    expect(r.html).toContain("<!--fc-block:0-->");
    expect(r.html).toContain('<code class="language-js">');
    const parts = splitAtPlaceholders(r.html);
    expect(parts.map((p) => p.blockIndex)).toEqual([null, 0, null]);
    expect(parts[0]!.html).toContain("<h2");
    expect(parts[2]!.html).toContain("more");
  });

  it("sanitizes scripts and event handlers", () => {
    const r = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[x](javascript:alert(1))');
    expect(r.html).not.toContain("<script");
    expect(r.html).not.toContain("onerror");
    expect(r.html).not.toContain("javascript:");
  });

  it("de-duplicates heading ids", () => {
    const r = renderMarkdown("## Risk\n\n## Risk\n");
    expect(r.html).toContain('id="risk"');
    expect(r.html).toContain('id="risk-1"');
  });
});
