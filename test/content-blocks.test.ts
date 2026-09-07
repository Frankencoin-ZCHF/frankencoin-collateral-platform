import { describe, expect, it } from "vitest";
import { CONTENT_BLOCK_TYPES, contentBlockTypeNames, parseBlockYaml, validateSpec } from "@/blocks/content/registry";
import { renderMarkdown } from "@/lib/markdown";
import { formatValue } from "@/lib/format-value";
import { getPath } from "@/upstream/generic";
import { readFileSync } from "node:fs";

describe("content block specs", () => {
  it("parses a valid documents fence", () => {
    const r = parseBlockYaml("type: documents\ntitle: Docs\nitems:\n  - label: Audit\n    url: https://example.com/a.pdf\n");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe("documents");
  });

  it("accepts the `links` alias", () => {
    expect(parseBlockYaml("type: links\nitems:\n  - label: x\n    url: https://x.y\n").ok).toBe(true);
  });

  it("rejects unknown types with the list of known ones", () => {
    const r = parseBlockYaml("type: nope\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unknown block type "nope"/);
  });

  it("rejects invalid YAML and missing type", () => {
    expect(parseBlockYaml("type: [unclosed").ok).toBe(false);
    expect(parseBlockYaml("title: no type").ok).toBe(false);
  });

  it("reports the failing field for a bad spec", () => {
    const r = parseBlockYaml("type: api\nurl: not-a-url\nlabel: x\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/url/);
  });

  it("applies defaults (coingecko.show, callout.variant, chart.kind)", () => {
    const cg = validateSpec({ type: "coingecko", id: "wrapped-steth" });
    expect(cg.ok && (cg.spec as { show: string[] }).show.length).toBeGreaterThan(0);
    const co = validateSpec({ type: "callout", text: "hi" });
    expect(co.ok && (co.spec as { variant: string }).variant).toBe("note");
    const ch = validateSpec({ type: "chart", x: "date", y: "v", data: [{ date: "2026-01-01", v: 1 }] });
    expect(ch.ok && (ch.spec as { kind: string }).kind).toBe("line");
  });

  it("embed allows only allow-listed https hosts", () => {
    expect(validateSpec({ type: "embed", url: "https://dune.com/embeds/1/2" }).ok).toBe(true);
    expect(validateSpec({ type: "embed", url: "https://evil.example/x" }).ok).toBe(false);
    expect(validateSpec({ type: "embed", url: "http://dune.com/embeds/1/2" }).ok).toBe(false);
  });

  it("frontmatter `blocks` array is accepted through the same validator", () => {
    expect(validateSpec({ type: "defillama", protocol: "lido" }).ok).toBe(true);
  });

  it("every registered type is documented in docs/content-blocks.md", () => {
    const doc = readFileSync(new URL("../docs/content-blocks.md", import.meta.url), "utf8");
    for (const name of contentBlockTypeNames()) expect(doc, `docs missing "${name}"`).toMatch(new RegExp(`type: ${name}\\b`));
    expect(Object.keys(CONTENT_BLOCK_TYPES).length).toBeGreaterThanOrEqual(9);
  });
});

describe("fence → placeholder → block wiring", () => {
  it("keeps the fence index aligned with the placeholder", () => {
    const md = "Intro\n\n```block\ntype: callout\ntext: one\n```\n\nMiddle\n\n```block\ntype: callout\ntext: two\n```\n";
    const r = renderMarkdown(md);
    expect(r.fences.map((f) => f.index)).toEqual([0, 1]);
    expect(r.html.indexOf("<!--fc-block:0-->")).toBeLessThan(r.html.indexOf("<!--fc-block:1-->"));
  });
});

describe("helpers", () => {
  it("getPath resolves dot and bracket paths", () => {
    const o = { a: { b: [{ c: 5 }] } };
    expect(getPath(o, "a.b[0].c")).toBe(5);
    expect(getPath(o, "a.b.0.c")).toBe(5);
    expect(getPath(o, "a.x.y")).toBeUndefined();
    expect(getPath(o, "")).toBe(o);
  });

  it("formatValue handles declared formats", () => {
    expect(formatValue(0.0312, "percent")).toBe("0.03%");
    expect(formatValue(3.12, "percent:1")).toBe("3.1%");
    expect(formatValue(1234567, "compact")).toBe("1.2M");
    expect(formatValue(1234.5, "currency:CHF")).toBe("1'234.50 CHF");
    expect(formatValue("2026-08-01T00:00:00Z", "date")).toMatch(/2026/);
    expect(formatValue(1_754_006_400, "date")).toMatch(/2025/);
    expect(formatValue(null)).toBe("–");
    expect(formatValue(true)).toBe("Yes");
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });
});
