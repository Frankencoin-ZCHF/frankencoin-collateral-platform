import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAssessmentFile, splitFrontmatter, FrontmatterError } from "@/lib/frontmatter";
import { normalizeAssessment } from "@/lib/normalize";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("splitFrontmatter", () => {
  it("splits on the second --- like scripts/validate.js", () => {
    const { json, body } = splitFrontmatter('---\n{"a":1}\n---\n# Title\n\ntext');
    expect(json).toBe('{"a":1}');
    expect(body).toBe("# Title\n\ntext");
  });

  it("tolerates a BOM and CRLF", () => {
    const { json } = splitFrontmatter('﻿---\r\n{"a":1}\r\n---\r\nbody');
    expect(json).toBe('{"a":1}');
  });

  it("rejects files without frontmatter", () => {
    expect(() => splitFrontmatter("# nope")).toThrow(FrontmatterError);
    expect(() => splitFrontmatter("---\n{}")).toThrow(FrontmatterError);
  });
});

describe("parseAssessmentFile", () => {
  it("parses the real wstETH assessment", () => {
    const { frontmatter, body } = parseAssessmentFile(fixture("wstETH.md"));
    expect(frontmatter.asset_ticker).toBe("wstETH");
    expect(frontmatter.contract_address.toLowerCase()).toBe("0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0");
    expect(frontmatter.risk_parameters.retained_reserve).toBe(0.25);
    expect(frontmatter.risk_scores.tail_risks.counterparty_risks[0]?.compensation).toBe("0.25%");
    expect(body).toMatch(/^# Collateral Risk Assessment/);
  });

  it("parses WBTC and the example file", () => {
    expect(parseAssessmentFile(fixture("WBTC.md")).frontmatter.asset_ticker).toBe("WBTC");
    expect(parseAssessmentFile(fixture("example.md")).frontmatter.asset_ticker).toBe("EXAMPLE");
  });

  it("parses the template (empty strings, nulls)", () => {
    const { frontmatter } = parseAssessmentFile(fixture("template.md"));
    expect(frontmatter.asset_name).toBe("");
    expect(frontmatter.risk_parameters.retained_reserve).toBeNull();
  });

  it("preserves unknown keys such as links.discussion and blocks", () => {
    const src = fixture("wstETH.md").replace('"etherscan":', '"discussion": "https://github.com/Frankencoin-ZCHF/Frankencoin/discussions/15",\n    "etherscan":');
    const { frontmatter } = parseAssessmentFile(src);
    expect(frontmatter.links.discussion).toContain("/discussions/15");
  });

  it("reports the failing field", () => {
    const src = fixture("wstETH.md").replace('"author": "Paolo Di Stefano",', "");
    expect(() => parseAssessmentFile(src)).toThrow(/author/);
  });
});

describe("normalizeAssessment", () => {
  it("normalises percents, fractions and n/a", () => {
    const { frontmatter } = parseAssessmentFile(fixture("wstETH.md"));
    const d = normalizeAssessment(frontmatter);
    expect(d.address).toBe("0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0");
    expect(d.scores.marketRiskPct).toBeCloseTo(16.98);
    expect(d.scores.freeFloat).toBe("Strong");
    expect(d.params.retainedReservePct).toBe(25);
    expect(d.params.targetInterestRatePct).toBe(0.75);
    expect(d.params.liquidationPrice).toBe(1300);
    expect(d.params.auctionDurationHours).toBe(24);
    expect(d.tailRisks).toHaveLength(6);
    const gov = d.tailRisks.find((t) => t.category === "governance_risks")!;
    expect(gov.probability).toBeNull();
    expect(gov.compensationPct).toBe(0);
    expect(d.totalCompensationPct).toBeCloseTo(0.75);
    expect(d.links.map((l) => l.key)).toEqual(["etherscan", "coingecko", "website", "docs", "other"]);
    expect(d.discussionUrl).toBeNull();
  });

  it("picks up a discussion URL from links.other when no explicit field exists", () => {
    const { frontmatter } = parseAssessmentFile(fixture("wstETH.md"));
    frontmatter.links.other = "https://github.com/Frankencoin-ZCHF/Frankencoin/discussions/15";
    expect(normalizeAssessment(frontmatter).discussionUrl).toContain("/discussions/15");
  });

  it("handles the empty template without throwing", () => {
    const { frontmatter } = parseAssessmentFile(fixture("template.md"));
    const d = normalizeAssessment(frontmatter);
    expect(d.address).toBeNull();
    expect(d.scores.freeFloat).toBeNull();
    expect(d.params.retainedReservePct).toBeNull();
    expect(d.totalCompensationPct).toBeNull();
  });
});
