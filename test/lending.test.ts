import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSnapshot } from "@/services/protocol";
import { effectiveInterestPct, lendingTerms } from "@/services/lending";
import { compareParameters } from "@/services/comparison";
import { buildAssessment } from "@/services/assessments";
import type { LiveCollateral, Position } from "@/types";
const raw = JSON.parse(readFileSync(new URL("./fixtures/positions.json", import.meta.url), "utf8")).list;
const base = buildSnapshot({ positions: raw, prices: [], collaterals: [], challenges: [], stats: null }).get("0x2260fac5e5542a773aa44fbcfedf7c193bc2c599")!;
const position = (minted: number, reserve: number | null, rate: number | null): Position => ({ ...base.positions.list[0]!, status: "active", minted, annualInterestPct: rate, reserveContributionPct: reserve });
const live = (positions: Position[], debt = positions.reduce((s, p) => s + p.minted, 0)): LiveCollateral => ({ ...base, totalMintedZchf: debt, collateralValueChf: debt * 1.74, totalLimitZchf: 1000, positions: { ...base.positions, list: positions }, reconciliation: { ...base.reconciliation, divergent: false } });

describe("lending terms in effective units", () => {
  it("converts the whole annual rate, including base, using the retained reserve", () => {
    expect(effectiveInterestPct(position(100, 20, 1.4))).toBeCloseTo(1.75);
    expect(effectiveInterestPct(position(100, 0, 1.4))).toBe(1.4);
    expect(effectiveInterestPct(position(100, 20, 0))).toBe(0);
  });
  it("does not turn missing rates or invalid reserve settings into zero interest", () => {
    for (const reserve of [null, -1, 100, 101, NaN]) expect(effectiveInterestPct(position(100, reserve, 1))).toBeNull();
    expect(effectiveInterestPct(position(100, 20, null))).toBeNull();
    const missing = { ...raw.find((p: { version: number }) => p.version === 2), annualInterestPPM: undefined };
    const mapped = [...buildSnapshot({ positions: [missing], prices: [], collaterals: [], challenges: [], stats: null }).values()][0]!.positions.list[0]!;
    expect(mapped.annualInterestPct).toBeNull(); // Must not fall back to raw premium.
  });
  it("weights reserves by gross debt and effective interest by debt outside reserve", () => {
    const t = lendingTerms(live([position(100, 20, 1.6), position(300, 40, 3.6)]));
    expect(t.reserveRequired).toBeCloseTo(140);
    expect(t.outsideReserve).toBeCloseTo(260);
    expect(t.interest).toMatchObject({ min: 2, max: 6 });
    expect(t.interest!.average).toBeCloseTo(12.4 / 260 * 100);
    expect(t.reserve!.average).toBe(35);
    expect(t.reserveRequired! + t.outsideReserve!).toBe(t.debt);
  });
  it("uses aggregate backing, not the smallest position cushion, and never sums clone limits", () => {
    const l = live([position(100, 20, 1.4)]);
    l.safety = { ...base.safety!, minLiquidationBufferPct: 6.7 };
    const t = lendingTerms(l);
    expect(t.overcollateralisationPct).toBeCloseTo(74);
    expect(t.collateralisationPct).toBeCloseTo(174);
    expect(t.limit).toBe(1000);
    expect(t.limitUsedPct).toBe(10);
    expect(lendingTerms({ ...l, collateralValueChf: 80 }).overcollateralisationPct).toBe(-20);
  });
  it("allows integer aggregate rounding but suppresses incomplete reserve splits", () => {
    const p = position(100.8, 20, 1.4);
    expect(lendingTerms(live([p], 100)).reserveRequired).toBe(20);
    expect(lendingTerms(live([p], 110)).outsideReserve).toBeNull();
    const l = live([p]); l.reconciliation.divergent = true;
    expect(lendingTerms(l).reserveRequired).toBeNull();
    expect(lendingTerms(live([position(100, null, 1.4)]))).toMatchObject({ reserveRequired: null, interest: null });
  });
  it("preserves unknown and zero-debt states, and bridge semantics", () => {
    expect(lendingTerms(null)).toMatchObject({ debt: null, outsideReserve: null, limit: null });
    expect(lendingTerms(live([position(0, 20, 1.4)]))).toMatchObject({ reserveRequired: 0, outsideReserve: 0, overcollateralisationPct: null });
    const l = live([], 100); l.bridge = {} as LiveCollateral["bridge"];
    expect(lendingTerms(l)).toMatchObject({ reserveRequired: 0, outsideReserve: 100, interest: null, reserve: null });
  });
  it("compares an assessed effective target with effective total interest, not raw premium", () => {
    const a = buildAssessment(readFileSync(new URL("./fixtures/WBTC.md", import.meta.url), "utf8"), "assessments/draft/WBTC.md", "draft", "WBTC", null, "2026-09-07");
    const p = position(100, 20, 1.4); p.riskPremiumPct = 0.4;
    const params = { ...a.data.params, targetInterestRatePct: 1.75 };
    expect(compareParameters(params, live([p])).find(r => r.key === "risk_premium")!.verdict).toBe("matches");
    expect(compareParameters(params, live([p, position(200, 20, null)])).find(r => r.key === "risk_premium")!.verdict).toBe("unavailable");
  });
});
