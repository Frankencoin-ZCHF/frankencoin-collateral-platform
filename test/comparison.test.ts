import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareParameters, verdictLabel } from "@/services/comparison";
import { attentionGroups, itemsFor, summarizeAttention } from "@/services/attention";
import { buildSnapshot, type Inputs } from "@/services/protocol";
import { join } from "@/services/collaterals";
import { buildAssessment } from "@/services/assessments";
import type { LiveCollateral } from "@/types";
const json = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const text = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const inputs: Inputs = {
  positions: json("positions.json").list,
  prices: json("prices.json"),
  collaterals: json("collaterals.json").list,
  challenges: json("challenges.json").list,
  stats: json("stats.json").map,
  now: 1_788_800_000,
};
const assessment = buildAssessment(text("wstETH.md"), "assessments/draft/wstETH.md", "draft", "wstETH", null, "2026-09-07");
const snap = buildSnapshot(inputs);
const live = snap.get(assessment.data.address!)!;
const row = (l: LiveCollateral, key = "retained_reserve") =>
  compareParameters({ ...assessment.data.params, retainedReservePct: 25 }, l).find((r) => r.key === key)!;
function withPositions(values: number[]): LiveCollateral {
  return {
    ...live,
    positions: {
      ...live.positions,
      list: values.map((reserve, i) => ({
        ...live.positions.list[0]!,
        address: `position-${i}`,
        url: `https://example.com/${i}`,
        version: 2,
        status: "active",
        minted: i === 0 ? 100_000 : 900_000,
        reserveContributionPct: reserve,
        challengePeriodSeconds: i === 0 ? 86_400 : 172_800,
      })),
    },
  };
}

describe("per-position assessment comparisons", () => {
  it("does not let a weighted average hide positions below the proposed reserve", () => {
    const r = row(withPositions([25, 20]));
    expect(r.verdict).toBe("varies");
    expect(r.onchain).toBe("20.0% – 25.0%");
    expect(r.differentPositions.map((p) => p.address)).toEqual(["position-1"]);
    expect(r.differentDebt).toBe(900_000);
    expect(r.explanation).toContain("1 of 2 positions");
  });
  it("does not let the shortest auction stand for every position", () => {
    const r = row(withPositions([25, 25]), "auction_duration");
    expect(r.verdict).toBe("varies");
    expect(r.differentPositions).toHaveLength(1);
    expect(r.differentDebt).toBe(900_000);
  });
  it("distinguishes an exact match, a display tolerance, and a more conservative setting", () => {
    expect(row(withPositions([25, 25])).verdict).toBe("matches");
    expect(row(withPositions([24, 24])).verdict).toBe("within-tolerance");
    expect(row(withPositions([30, 30])).verdict).toBe("within-range");
    expect(row(withPositions([20, 20])).verdict).toBe("differs");
    expect(verdictLabel("within-tolerance", "published")).toBe("Within stated tolerance");
  });
  it("does not present missing data as matching or confuse a zero limit with missing", () => {
    expect(compareParameters(assessment.data.params, null).find((r) => r.key === "risk_premium")!.verdict).toBe("unavailable");
    expect(
      compareParameters({ ...assessment.data.params, targetInterestRatePct: null }, live).find((r) => r.key === "risk_premium")!.verdict,
    ).toBe("not-comparable");
    expect(
      compareParameters({ ...assessment.data.params, globalMintingLimit: 0 }, { ...live, totalLimitZchf: 0 }).find(
        (r) => r.key === "global_minting_limit",
      )!.verdict,
    ).toBe("matches");
  });
  it("excludes V1 total interest from risk-premium comparisons", () => {
    const old = withPositions([25]);
    old.positions.list[0]!.version = 1;
    expect(row(old, "risk_premium").verdict).toBe("unavailable");
  });
  it("does not imply publication is governance approval", () => {
    const r = compareParameters(assessment.data.params, withPositions([10]), "published")[0]!;
    expect(r.explanation).not.toMatch(/approved assessment|approved baseline/);
    expect(r.explanation).toContain("does not establish");
  });
});

describe("finding categories", () => {
  it("keeps financial, data-quality and assessment findings separate", () => {
    const records = join([assessment], snap, "2026-09-07");
    const chfau = records.find((r) => r.ticker === "CHFAU")!;
    expect(itemsFor(chfau)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ queue: "data", title: "Position data incomplete" }),
        expect.objectContaining({ queue: "review", title: "Assessment missing" }),
      ]),
    );
    for (const queue of ["live", "data", "review"] as const)
      expect(attentionGroups(records, queue).every((g) => g.items.every((i) => i.queue === queue))).toBe(true);
  });
  it("keeps differences from a published assessment in review unless an adopted baseline is evidenced", () => {
    const published = {
      ...assessment,
      status: "published" as const,
      data: { ...assessment.data, params: { ...assessment.data.params, retainedReservePct: 60 } },
    };
    const r = join([published], snap, "2026-09-07").find((r) => r.slug === "wsteth")!;
    const findings = itemsFor(r).filter((i) => i.title.startsWith("Retained reserve differs"));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.queue).toBe("review");
  });
  it("includes active unattributed challenges in the financial headline", () => {
    const s = summarizeAttention([], 2);
    expect(s.live.challenges).toBe(2);
    expect(s.live.items).toBe(2);
    expect(s.live.high).toBe(2);
  });
});
