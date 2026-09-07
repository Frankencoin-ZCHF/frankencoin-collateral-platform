import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareParameters } from "@/services/comparison";
import { attentionItems } from "@/services/attention";
import { buildSnapshot, type Inputs } from "@/services/protocol";
import { join } from "@/services/collaterals";
import { buildAssessment } from "@/services/assessments";

const json = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const text = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const inputs: Inputs = { positions: json("positions.json").list, prices: json("prices.json"), collaterals: json("collaterals.json").list, challenges: json("challenges.json").list, stats: json("stats.json").map, now: 1_788_800_000 };
const TODAY = "2026-09-07";

describe("compareParameters", () => {
  const snap = buildSnapshot(inputs);
  const wsteth = buildAssessment(text("wstETH.md"), "assessments/draft/wstETH.md", "draft", "wstETH", null, TODAY);
  const live = snap.get(wsteth.data.address!)!;

  it("returns a named verdict with an explanation for every parameter", () => {
    const rows = compareParameters(wsteth.data.params, live);
    expect(rows.map((r) => r.key)).toEqual(["retained_reserve", "risk_premium", "liquidation_price", "auction_duration", "minimum_collateral", "global_minting_limit", "maturity"]);
    for (const r of rows) {
      expect(["matches", "within-range", "differs", "not-comparable", "unavailable"]).toContain(r.verdict);
      expect(r.explanation.length).toBeGreaterThan(10);
    }
    expect(rows.find((r) => r.key === "maturity")!.verdict).toBe("not-comparable");
  });

  it("treats a more conservative live value as within range, a less conservative one as differing", () => {
    const params = { ...wsteth.data.params, retainedReservePct: 20 }; // live reserve is 25% → more conservative
    expect(compareParameters(params, live).find((r) => r.key === "retained_reserve")!.verdict).toBe("within-range");
    const loose = { ...wsteth.data.params, retainedReservePct: 40 }; // live 25% is less conservative
    expect(compareParameters(loose, live).find((r) => r.key === "retained_reserve")!.verdict).toBe("differs");
  });

  it("is 'unavailable' without live positions and 'not-comparable' without an assessed value", () => {
    expect(compareParameters(wsteth.data.params, null).find((r) => r.key === "risk_premium")!.verdict).toBe("unavailable");
    expect(compareParameters({ ...wsteth.data.params, targetInterestRatePct: null }, live).find((r) => r.key === "risk_premium")!.verdict).toBe("not-comparable");
  });
});

describe("attentionItems", () => {
  it("lists integrity issues, parameter deviations and near-liquidation debt, most severe first", () => {
    const snap = buildSnapshot(inputs);
    const wsteth = buildAssessment(text("wstETH.md").replace('"assessment_date": "2026-08-01"', '"assessment_date": "2027-08-01"'), "assessments/draft/wstETH.md", "draft", "wstETH", null, TODAY);
    const items = attentionItems(join([wsteth], snap, TODAY));
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.kind === "future date" && i.ticker === "wstETH")).toBe(true);
    expect(items.some((i) => i.kind === "feed divergence" && i.ticker === "CHFAU")).toBe(true);
    const ranks = items.map((i) => ({ high: 0, medium: 1, low: 2 })[i.severity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
