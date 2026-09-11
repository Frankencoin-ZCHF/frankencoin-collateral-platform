import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSnapshot } from "@/services/protocol";
import { join } from "@/services/collaterals";
import { assessmentPriorities, commonExposures, maturityProfile } from "@/services/insights";
import { sortRows } from "@/lib/collateral-filters";
import { toRow } from "@/lib/rows";
import type { CollateralRecord, LiveCollateral } from "@/types";
const json = (file: string) => JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"));
const records = join([], buildSnapshot({ positions: json("positions.json").list, prices: json("prices.json"), stats: json("stats.json").map, collaterals: [], challenges: [] }), "2026-09-07");
const NOW = Date.parse("2026-09-11T00:00:00Z");
const asset = (): CollateralRecord => structuredClone(records.find(r => r.ticker === "WBTC")!);

describe("portfolio insights", () => {
  it("counts each debt position once, including expired and missing expiries", () => {
    const r = asset(), p = r.live!.positions.list[0]!;
    r.live!.positions.list = [-1, 7, 30, 90, 91, null].map((days, i) => ({ ...p, address: `position-${i}`, status: "active", minted: 100, expiresAt: days === null ? null : new Date(NOW + days * 86_400_000).toISOString() }));
    r.live!.positions.list.push({ ...p, status: "closed", minted: 9999 }, { ...p, status: "active", minted: 0 });
    const result = maturityProfile([r], NOW);
    expect(result.coveredDebt).toBe(600);
    expect(result.buckets.map(b => b.debt)).toEqual([100, 100, 100, 100, 100, 100]);
  });
  it("does not treat bridge minting horizons as repayment maturities", () => {
    const r = asset(); r.live!.bridge = {} as LiveCollateral["bridge"];
    expect(maturityProfile([r], NOW)).toMatchObject({ reportedDebt: 0, coveredDebt: 0 });
  });
  it("groups shared price drivers by verified identity, not token tickers", () => {
    const a = asset(), b = asset(), fake = asset();
    b.address = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"; b.slug = "cbbtc";
    fake.address = "0x0000000000000000000000000000000000000001";
    const groups = commonExposures([a, b, fake]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBe("Bitcoin");
    expect(groups[0]!.assets).toHaveLength(2);
    expect(toRow(a).assetType).toBe(toRow(a).exposureGroup);
  });
  it("prioritises assessment actions by outstanding debt and excludes unused assets", () => {
    const a = asset(), b = asset(), unused = asset();
    a.live!.totalMintedZchf = 100; b.live!.totalMintedZchf = 500; b.slug = "larger";
    unused.live!.totalMintedZchf = 0;
    expect(assessmentPriorities([a, unused, b]).map(r => r.slug)).toEqual(["larger", "wbtc"]);
  });
  it("sorts weakest aggregate backing first, keeping missing values last", () => {
    const a = toRow(asset()), b = { ...a, slug: "b", overcollateralisationPct: -10 }, unknown = { ...a, slug: "unknown", overcollateralisationPct: null };
    expect(sortRows([unknown, a, b], "backing").map(r => r.slug)).toEqual(["b", "wbtc", "unknown"]);
  });
});
