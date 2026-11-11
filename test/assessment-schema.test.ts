import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAssessmentFile, splitFrontmatter } from "@/lib/frontmatter";
import { normalizeAssessment } from "@/lib/normalize";
import { formatDuration, formatMaturity, formatMintingLimit } from "@/lib/numbers";
import { structuredDiff } from "@/lib/diff";
import { buildAssessment } from "@/services/assessments";
import { compareParameters } from "@/services/comparison";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const current = (ticker: string) => fixture(`current-schema/${ticker}.md`);
const normalize = (source: string) => normalizeAssessment(parseAssessmentFile(source).frontmatter);
function edit(change: (raw: Record<string, any>) => void): string {
  const { json, body } = splitFrontmatter(current("WBTC"));
  const raw = JSON.parse(json);
  change(raw);
  return `---\n${JSON.stringify(raw)}\n---\n${body}`;
}

describe("current and legacy assessment schema compatibility", () => {
  it.each([
    ["WBTC", "published", "no limit", 36, 3],
    ["BOSS", "published", 5_000_000, 24, 3],
    ["CHFAU", "published", 10_000_000, 12, 3],
    ["NEAR", "draft", 4_500_000, 24, 3],
  ] as const)("loads the current %s assessment without removed legacy fields", (ticker, status, limit, months, risks) => {
    const a = buildAssessment(current(ticker), `assessments/${status}/${ticker}.md`, status, ticker, null, "2026-11-11");
    expect(a.data.params).toMatchObject({ globalMintingLimit: limit, maturityMonths: months, liquidationPrice: null, minimumCollateral: null });
    expect(a.data.tailRisks).toHaveLength(risks);
    expect(a.body).toContain("## Summary");
    expect(a.raw.risk_parameters).not.toHaveProperty("liquidation_price");
    expect(a.raw.risk_scores.tail_risks).not.toHaveProperty("legal_risks");
  });

  it("preserves legacy month units, numeric caps, removed parameters and all six risk categories", () => {
    const old = parseAssessmentFile(fixture("wstETH.md"));
    const data = normalizeAssessment(old.frontmatter);
    expect(data.params.maturityMonths).toBe(old.frontmatter.risk_parameters.maturity);
    expect(data.params.globalMintingLimit).toBe(old.frontmatter.risk_parameters.global_minting_limit);
    expect(data.params.liquidationPrice).toBe(1300);
    expect(data.tailRisks).toHaveLength(6);
    expect(data.tailRisks.some((r) => r.category === "legal_risks")).toBe(true);
  });

  it("keeps absent optional measurements unknown and the authored report readable", () => {
    const source = edit((r) => { r.risk_parameters = {}; r.risk_scores = {}; });
    const { frontmatter, body } = parseAssessmentFile(source);
    const data = normalizeAssessment(frontmatter);
    expect(Object.values(data.params)).toEqual(Array(7).fill(null));
    expect(Object.values(data.scores)).toEqual(Array(3).fill(null));
    expect(data.tailRisks).toEqual([]);
    expect(data.totalCompensationPct).toBeNull();
    expect(body).toContain("WBTC is an ERC-20 representation of Bitcoin.");
    expect(frontmatter.risk_parameters).toEqual({});
  });

  it("does not confuse no limit, zero, missing values and unsupported text", () => {
    for (const [value, expected] of [["no limit", "no limit"], [" No Limit ", "no limit"], [0, 0], [null, null], [undefined, null], ["pending", null], ["5000000", null], [-1, null]] as const) {
      const data = normalize(edit((r) => { r.risk_parameters.global_minting_limit = value; }));
      expect(data.params.globalMintingLimit).toBe(expected);
      expect(JSON.parse(JSON.stringify(data)).params.globalMintingLimit).toBe(expected);
    }
    expect(formatMintingLimit("no limit")).toBe("No limit");
    expect(formatMintingLimit(0)).toBe("0 ZCHF");
    expect(formatMintingLimit(null)).toBe("–");
  });

  it("interprets only explicit year strings and legacy month numbers", () => {
    for (const [value, expected] of [["1 year", 12], ["3 years", 36], [24, 24], [0, 0], [null, null], ["3", null], ["2 decades", null], [-12, null], ["999999999999999999 years", null]] as const) {
      expect(normalize(edit((r) => { r.risk_parameters.maturity = value; })).params.maturityMonths).toBe(expected);
    }
    expect(formatMaturity(12)).toBe("1 year");
    expect(formatMaturity(36)).toBe("3 years");
    expect(formatMaturity(18)).toBe("18 months");
    expect(formatMaturity(null)).toBe("–");
  });

  it("retains explicit zero rates, reserves and auction duration for stablecoin bridges", () => {
    const data = normalize(current("CHFAU"));
    expect(data.params).toMatchObject({ retainedReservePct: 0, targetInterestRatePct: 0, auctionDurationHours: 0 });
    expect(data.totalCompensationPct).toBe(0);
    expect(formatDuration(0)).toBe("0 h");
    expect(formatDuration(null)).toBe("–");
  });

  it("does not label a partial risk-compensation sum as the total", () => {
    const data = normalize(edit((r) => { r.risk_scores.tail_risks.counterparty_risks[0].compensation = "n/a"; }));
    expect(data.totalCompensationPct).toBeNull();
    expect(data.params.targetInterestRatePct).toBe(0.75);
    expect(data.tailRisks.find((r) => r.category === "smart_contract_risks")?.compensationPct).toBe(0.25);
  });

  it("keeps source schema changes visible in historical diffs", () => {
    const before = parseAssessmentFile(fixture("WBTC.md")).frontmatter;
    const after = parseAssessmentFile(current("WBTC")).frontmatter;
    const changes = structuredDiff(before, after);
    expect(changes).toContainEqual(expect.objectContaining({ key: "risk_parameters.global_minting_limit", after: "no limit" }));
    expect(changes).toContainEqual(expect.objectContaining({ key: "risk_parameters.maturity", after: "3 years" }));
    expect(changes).toContainEqual(expect.objectContaining({ key: "risk_parameters.liquidation_price", kind: "removed" }));
    expect(changes.some((c) => c.key.startsWith("risk_scores.tail_risks.legal_risks") && c.kind === "removed")).toBe(true);
  });

  it("parses the current empty template without inventing recommendations", () => {
    const data = normalize(current("template"));
    expect(data.params.globalMintingLimit).toBe("no limit");
    expect(data.params.maturityMonths).toBeNull();
    expect(data.totalCompensationPct).toBeNull();
  });

  it("keeps critical identity validation for published assessments", () => {
    for (const address of ["", "not-an-address"]) {
      const source = edit((r) => { r.contract_address = address; });
      expect(() => buildAssessment(source, "assessments/published/WBTC.md", "published", "WBTC", null)).toThrow(/contract_address|address/);
    }
    expect(() => parseAssessmentFile(edit((r) => { r.asset_name = '<img onerror="alert(1)">'; }))).toThrow(/asset_name/);
  });

  it("does not invent equality or a parameter-difference alert for an uncapped recommendation", () => {
    const data = normalize(current("WBTC"));
    const rows = compareParameters(data.params, null, "published");
    expect(rows.find((r) => r.key === "global_minting_limit")).toMatchObject({ assessed: "No limit", onchain: "–", verdict: "unavailable" });
    expect(rows.find((r) => r.key === "maturity")?.assessed).toBe("3 years");
  });
});
