import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSnapshot, computeSafety, type Inputs } from "@/services/protocol";
import { deriveLifecycle, join, summarize } from "@/services/collaterals";
import { buildAssessment } from "@/services/assessments";
import type { Position } from "@/types";

const json = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const text = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const inputs: Inputs = {
  positions: json("positions.json").list,
  prices: json("prices.json"),
  collaterals: json("collaterals.json").list,
  challenges: json("challenges.json").list,
  stats: json("stats.json").map,
  now: 1_788_800_000, // ~2026-09-07
};
const TODAY = "2026-09-07";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const CHFAU = "0xbd4dfc058eb95b8de5ceaf39966a1a70f5556f78";

describe("buildSnapshot — aggregates from /ecosystem/collateral/stats", () => {
  const snap = buildSnapshot(inputs);

  it("takes minted, limit and remaining capacity from the aggregate, not from clone fields", () => {
    const weth = snap.get(WETH)!;
    const s = inputs.stats![WETH]!;
    expect(weth.totalMintedZchf).toBe(s.totalMinted);
    expect(weth.totalLimitZchf).toBe(s.totalLimit);
    expect(weth.remainingLimitZchf).toBe(s.totalLimit - s.totalMinted);
    // Summing the per-clone capacity fields (what the old code did) overstates the real remaining limit several times over.
    const naive = weth.positions.list.filter((p) => p.status === "active").reduce((n, p) => n + p.availableForClones + p.availableForMinting, 0);
    expect(naive).toBeGreaterThan(weth.remainingLimitZchf! * 4);
    expect(weth.reconciliation.aggregateSource).toBe("stats");
    expect(weth.reconciliation.divergent).toBe(false);
  });

  it("surfaces a collateral that exists in the aggregate but not in the position feed (CHFAU) and flags the divergence", () => {
    const c = snap.get(CHFAU)!;
    expect(c.symbol).toBe("CHFAU");
    expect(c.counts?.open).toBe(1);
    expect(c.totalMintedZchf).toBeGreaterThan(0);
    expect(c.positions.list).toHaveLength(0);
    expect(c.reconciliation.divergent).toBe(true);
    expect(c.reconciliation.note).toMatch(/position feed lists 0/);
  });

  it("falls back to the position feed when the aggregate is unavailable", () => {
    const noStats = buildSnapshot({ ...inputs, stats: null });
    const weth = noStats.get(WETH)!;
    expect(weth.reconciliation.aggregateSource).toBe("positions");
    expect(weth.totalLimitZchf).toBeNull();
    expect(weth.remainingLimitZchf).toBeNull();
    expect(weth.totalMintedZchf).toBeCloseTo(weth.reconciliation.mintedFromPositions, 0);
    expect(noStats.has(CHFAU)).toBe(true); // still listed via /ecosystem/collateral/list
  });

  it("groups every position under its collateral and decodes units", () => {
    const totalPositions = [...snap.values()].reduce((n, c) => n + c.positions.total, 0);
    expect(totalPositions).toBe(inputs.positions.length);
    const wbtc = snap.get("0x2260fac5e5542a773aa44fbcfedf7c193bc2c599")!;
    const p = wbtc.positions.list.find((x) => x.status === "active")!;
    expect(p.liquidationPriceZchf).toBeGreaterThan(10_000);
    expect(p.liquidationPriceZchf).toBeLessThan(500_000);
    const v1 = [...snap.values()].flatMap((c) => c.positions.list).find((p) => p.version === 1)!;
    expect(v1.riskPremiumPct).toBeGreaterThan(0);
  });

  it("computes position safety from active priced positions", () => {
    const weth = snap.get(WETH)!;
    const s = weth.safety!;
    expect(s.positionsConsidered).toBeGreaterThan(0);
    expect(s.minLiquidationBufferPct).toBeGreaterThan(0);
    expect(s.minLiquidationBufferPct).toBeLessThanOrEqual(s.medianLiquidationBufferPct!);
    expect(s.debtWithin.pct5).toBeLessThanOrEqual(s.debtWithin.pct10);
    expect(s.debtWithin.pct10).toBeLessThanOrEqual(s.debtWithin.pct20);
    expect(s.weightedCollateralRatioPct).toBeGreaterThan(100);
  });

  it("computeSafety handles edge cases", () => {
    const mk = (minted: number, liq: number): Position => ({ minted, liquidationPriceZchf: liq, status: "active", collateralRatioPct: 200 } as Position);
    expect(computeSafety([], 100)).toBeNull();
    expect(computeSafety([mk(10, 90)], null)).toBeNull();
    const s = computeSafety([mk(10, 96), mk(20, 50)], 100)!;
    expect(s.minLiquidationBufferPct).toBe(4);
    expect(s.debtWithin).toEqual({ pct5: 10, pct10: 10, pct20: 10 });
  });

  it("joins challenges through their position", () => {
    const total = [...snap.values()].reduce((n, c) => n + c.challenges.total, 0);
    expect(total).toBe(inputs.challenges.length);
  });
});

describe("join — identity is the contract address", () => {
  const snap = buildSnapshot(inputs);
  const wsteth = buildAssessment(text("wstETH.md"), "assessments/draft/wstETH.md", "draft", "wstETH", null, TODAY);
  const wbtc = buildAssessment(text("WBTC.md"), "assessments/draft/WBTC.md", "draft", "WBTC", null, TODAY);

  it("matches by address and derives lifecycle from protocol counts", () => {
    const records = join([wsteth, wbtc], snap, TODAY);
    const w = records.find((r) => r.slug === "wsteth")!;
    expect(w.kind).toBe("both");
    expect(w.lifecycle).toBe("live");
    expect(w.issues.map((i) => i.code)).not.toContain("no-assessment"); // it has a (draft) assessment
    expect(new Set(records.map((r) => r.slug)).size).toBe(records.length);
    expect(records[0]!.lifecycle).toBe("live"); // live first
  });

  it("does NOT merge an assessment with a same-symbol token when the address differs — two records, flagged", () => {
    const wrong = buildAssessment(text("WBTC.md").replace(/"contract_address": "[^"]+"/, '"contract_address": "0x000000000000000000000000000000000000dEaD"'), "assessments/draft/WBTC.md", "draft", "WBTC", null, TODAY);
    const records = join([wrong], snap, TODAY);
    const both = records.filter((r) => r.ticker === "WBTC");
    expect(both).toHaveLength(2);
    const assessed = both.find((r) => r.kind === "assessed")!;
    const live = both.find((r) => r.kind === "live-only")!;
    expect(assessed.slug).toBe("wbtc");
    expect(assessed.live).toBeNull();
    expect(assessed.lifecycle).toBe("draft");
    expect(assessed.addressMismatch).toEqual({ assessed: "0x000000000000000000000000000000000000dead", onchain: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", liveSlug: live.slug });
    expect(assessed.issues[0]).toMatchObject({ code: "address-mismatch", severity: "high" });
    expect(live.slug).toMatch(/^wbtc-[0-9a-f]{6}$/);
    expect(live.lifecycle).toBe("live");
  });

  it("tolerates future assessment dates on drafts (no integrity issue) and rejects them on published assessments", () => {
    const future = buildAssessment(text("wstETH.md").replace('"assessment_date": "2026-08-01"', '"assessment_date": "2027-08-01"'), "assessments/draft/wstETH.md", "draft", "wstETH", null, TODAY);
    const rec = join([future], snap, TODAY).find((r) => r.slug === "wsteth")!;
    expect(rec.issues.map((i) => i.code)).not.toContain("future-date");
    expect(() => buildAssessment(text("wstETH.md").replace('"assessment_date": "2026-08-01"', '"assessment_date": "2027-08-01"'), "assessments/published/wstETH.md", "published", "wstETH", null, TODAY)).toThrow(/future/);
  });

  it("deriveLifecycle follows open > requested > closed > denied > proposed", () => {
    const base = { positions: { active: 0, closed: 0, denied: 0, total: 0, list: [] } };
    const mk = (counts: Partial<{ open: number; requested: number; closed: number; denied: number }>) =>
      ({ ...base, counts: { total: 0, open: 0, requested: 0, closed: 0, denied: 0, originals: 0, clones: 0, ...counts } }) as never;
    expect(deriveLifecycle(null)).toBe("draft");
    expect(deriveLifecycle(mk({ open: 1 }))).toBe("live");
    expect(deriveLifecycle(mk({ requested: 1 }))).toBe("proposed");
    expect(deriveLifecycle(mk({ closed: 2 }))).toBe("closed");
    expect(deriveLifecycle(mk({ denied: 1 }))).toBe("denied");
    expect(deriveLifecycle(mk({}))).toBe("proposed");
  });

  it("drops unlisted tokens that only ever had denied/closed positions", () => {
    const records = join([], snap, TODAY);
    expect(records.every((r) => r.live!.listed || r.live!.positions.active > 0)).toBe(true);
    expect(records.map((r) => r.ticker)).toContain("VCHF");
    expect(records.find((r) => r.ticker === "VCHF")!.lifecycle).toBe("proposed");
  });

  it("marks a live collateral whose assessment file failed to load as 'unavailable', not 'no assessment'", () => {
    const records = join([], snap, TODAY, [{ path: "assessments/draft/WBTC.md", error: "github timed out" }]);
    const wbtc = records.find((r) => r.ticker === "WBTC")!;
    expect(wbtc.assessmentUnavailable).toBe("github timed out");
    expect(wbtc.issues.map((i) => i.code)).toContain("assessment-unavailable");
    expect(wbtc.issues.map((i) => i.code)).not.toContain("no-assessment");
    expect(records.find((r) => r.ticker === "WETH")!.assessmentUnavailable).toBeNull();
  });

  it("when the whole index is unavailable, nothing is called 'without any assessment'", () => {
    const records = join([], snap, TODAY, [], "the assessments repository could not be read from GitHub");
    expect(records.filter((r) => r.lifecycle === "live").every((r) => r.assessmentUnavailable !== null)).toBe(true);
    expect(records.some((r) => r.issues.some((i) => i.code === "no-assessment"))).toBe(false);
    const s = summarize(records);
    expect(s.coverage.missing).toBe(0);
    expect(s.coverage.unavailable).toBe(s.lifecycle.live);
  });

  it("summarises lifecycle × assessment dimensions", () => {
    const s = summarize(join([wsteth, wbtc], snap, TODAY));
    expect(s.lifecycle.live).toBeGreaterThan(10);
    expect(s.assessments.draft).toBe(2);
    expect(s.assessments.none).toBeGreaterThan(0);
    expect(s.coverage.draft).toBe(2);
    expect(s.coverage.missing).toBe(s.lifecycle.live - 2);
    expect(s.concentration?.ticker).toBeDefined();
    expect(s.totalMintedZchf).toBeGreaterThan(30_000_000); // includes CHFAU's 600k from the aggregate
    expect(s.lastAssessmentDate).toBe("2026-08-01");
  });
});
