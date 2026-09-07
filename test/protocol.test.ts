import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSnapshot } from "@/services/protocol";
import { join, summarize } from "@/services/collaterals";
import { buildAssessment } from "@/services/assessments";

const json = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const text = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const inputs = {
  positions: json("positions.json").list,
  prices: json("prices.json"),
  collaterals: json("collaterals.json").list,
  challenges: json("challenges.json").list,
  now: 1_788_800_000, // ~2026-09-07
};

describe("buildSnapshot", () => {
  const snap = buildSnapshot(inputs);

  it("groups every position under its collateral", () => {
    const totalPositions = [...snap.values()].reduce((n, c) => n + c.positions.total, 0);
    expect(totalPositions).toBe(inputs.positions.length);
  });

  it("decodes WETH figures with 18 decimals", () => {
    const weth = snap.get("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")!;
    expect(weth.symbol).toBe("WETH");
    expect(weth.decimals).toBe(18);
    expect(weth.price?.chf).toBeGreaterThan(0);
    expect(weth.positions.active).toBeGreaterThan(0);
    expect(weth.totalMintedZchf).toBeGreaterThan(0);
    expect(weth.collateralValueChf).toBeGreaterThan(weth.totalMintedZchf); // over-collateralised
    expect(weth.utilizationPct).toBeLessThan(100);
    const p = weth.positions.list.find((x) => x.status === "active" && x.minted > 0)!;
    expect(p.liquidationPriceZchf).toBeGreaterThan(100);
    expect(p.liquidationPriceZchf).toBeLessThan(100_000);
    expect(p.riskPremiumPct).toBeGreaterThanOrEqual(0);
    expect(p.url).toMatch(/^https:\/\/app\.frankencoin\.com\//);
  });

  it("decodes WBTC liquidation prices with 36 - 8 decimals", () => {
    const wbtc = snap.get("0x2260fac5e5542a773aa44fbcfedf7c193bc2c599")!;
    const p = wbtc.positions.list.find((x) => x.status === "active")!;
    expect(p.liquidationPriceZchf).toBeGreaterThan(10_000);
    expect(p.liquidationPriceZchf).toBeLessThan(500_000);
  });

  it("maps V1 annualInterestPPM to riskPremiumPct", () => {
    const v1 = [...snap.values()].flatMap((c) => c.positions.list).find((p) => p.version === 1)!;
    expect(v1.riskPremiumPct).toBeGreaterThan(0);
  });

  it("joins challenges through their position", () => {
    const total = [...snap.values()].reduce((n, c) => n + c.challenges.total, 0);
    expect(total).toBe(inputs.challenges.length);
    const finished = [...snap.values()].flatMap((c) => c.challenges.list).find((c) => c.status === "Success");
    expect(finished?.isActive).toBe(false);
  });

  it("keeps collaterals from the list even without positions", () => {
    for (const c of inputs.collaterals) expect(snap.has(c.address.toLowerCase())).toBe(true);
  });
});

describe("join + summarize", () => {
  const snap = buildSnapshot(inputs);
  const wsteth = buildAssessment(text("wstETH.md"), "assessments/draft/wstETH.md", "draft", "wstETH", null);
  const wbtc = buildAssessment(text("WBTC.md"), "assessments/draft/WBTC.md", "draft", "WBTC", null);

  it("produces one record per address, assessed first", () => {
    const records = join([wsteth, wbtc], snap);
    expect(records.filter((r) => r.kind === "both").map((r) => r.ticker).sort()).toEqual(["WBTC", "wstETH"]);
    const liveOnly = records.filter((r) => r.kind === "live-only");
    expect(liveOnly.length).toBeLessThan(snap.size - 2); // unlisted dead tokens (ZEUS, HPS, UNI…) are dropped
    expect(liveOnly.map((r) => r.ticker)).toContain("VCHF"); // listed but unassessed
    expect(liveOnly.every((r) => r.live!.listed || r.live!.positions.active > 0)).toBe(true);
    expect(records[0]!.assessment).not.toBeNull();
    const slugs = records.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("wsteth");
  });

  it("joins by symbol (listed collaterals only) when the assessment address does not match, and flags it", () => {
    const wrongAddr = buildAssessment(text("WBTC.md").replace(/"contract_address": "[^"]+"/, '"contract_address": "0x000000000000000000000000000000000000dEaD"'), "assessments/draft/WBTC.md", "draft", "WBTC", null);
    const records = join([wrongAddr], snap);
    const wbtc = records.find((r) => r.slug === "wbtc")!;
    expect(wbtc.kind).toBe("both");
    expect(wbtc.addressMismatch).toEqual({ assessed: "0x000000000000000000000000000000000000dead", onchain: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" });
    expect(records.filter((r) => r.ticker === "WBTC")).toHaveLength(1);
  });

  it("summarises", () => {
    const s = summarize(join([wsteth, wbtc], snap));
    expect(s.assessed).toBe(2);
    expect(s.draft).toBe(2);
    expect(s.totalMintedZchf).toBeGreaterThan(1_000_000);
    expect(s.lastAssessmentDate).toBe("2026-08-01");
  });
});
