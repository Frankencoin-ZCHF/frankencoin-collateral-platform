import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assetProfile } from "@/lib/assets";
import { collateralView, inView, matchesFilters } from "@/lib/collateral-filters";
import { toRow } from "@/lib/rows";
import { assessmentExcerpt } from "@/services/assessment-summary";
import { itemsFor, monitoringStatus } from "@/services/attention";
import { join } from "@/services/collaterals";
import { exposureGroups, monitoringComplete, monitoringCoverage, priceQuality, priceScenario } from "@/services/monitoring";
import { buildSnapshot, type Inputs } from "@/services/protocol";
import type { CollateralRecord, LiveCollateral } from "@/types";

const json = (file: string) => JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"));
const NOW = Date.parse("2026-09-08T12:00:00Z");
const HOUR = 3_600_000;
const WBTC = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599";
const CBBTC = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const inputs: Inputs = {
  positions: json("positions.json").list,
  prices: json("prices.json"),
  collaterals: json("collaterals.json").list,
  challenges: json("challenges.json").list,
  stats: json("stats.json").map,
  now: NOW / 1000,
};
const records = join([], buildSnapshot(inputs), "2026-09-08");
function record(): CollateralRecord {
  const original = structuredClone(records.find((r) => r.address === WBTC)!);
  original.issues = [];
  original.live!.price = { chf: 100_000, usd: 110_000, source: "test", timestamp: new Date(NOW - 15 * 60_000).toISOString() };
  original.live!.reconciliation.divergent = false;
  original.live!.challenges = { active: 0, total: 0, list: [] };
  original.live!.safety!.debtWithin = { pct5: 0, pct10: 0, pct20: 0 };
  return original;
}
afterEach(() => vi.useRealTimers());

describe("source-price freshness", () => {
  it("uses observation time, never a recent fetch, and makes outdated monitoring unknown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const r = record();
    expect(priceQuality(r.live!, NOW).state).toBe("current");
    expect(monitoringStatus(r).state).toBe("ok");
    r.live!.price!.timestamp = new Date(NOW - 2 * HOUR).toISOString();
    expect(priceQuality(r.live!, NOW).state).toBe("stale");
    expect(monitoringStatus(r).state).toBe("unknown");
    expect(itemsFor(r)).toContainEqual(expect.objectContaining({ queue: "data", title: "Price data outdated" }));
  });
  it("does not trust missing, invalid or implausibly future timestamps", () => {
    const l = record().live!;
    for (const timestamp of [null, "garbage", new Date(NOW + HOUR).toISOString()]) {
      l.price!.timestamp = timestamp;
      expect(priceQuality(l, NOW).state).toBe("invalid-time");
      expect(monitoringComplete({ ...record(), live: l }, NOW)).toBe(false);
    }
    for (const chf of [0, -1, NaN, Infinity]) {
      l.price!.chf = chf;
      expect(priceQuality(l, NOW).state).toBe("unavailable");
    }
    l.price = null;
    expect(priceQuality(l, NOW).state).toBe("unavailable");
  });
  it("applies explicit asset windows without classifying by an untrusted ticker", () => {
    const l = record().live!;
    l.price!.timestamp = new Date(NOW - 2 * HOUR).toISOString();
    expect(priceQuality(l, NOW).state).toBe("stale");
    l.address = "0x45804880de22913dafe09f4980848ece6ecbaf78";
    expect(priceQuality(l, NOW)).toMatchObject({ state: "current", maxAgeHours: 24 });
    expect(assetProfile(WBTC.toUpperCase()).group).toBe("Bitcoin");
    expect(assetProfile("0x0000000000000000000000000000000000000001").group).toBe("Other / unclassified");
  });
  it("keeps a known active challenge visible alongside a data limitation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const r = record();
    r.live!.price = null;
    r.live!.challenges.active = 1;
    expect(monitoringStatus(r).state).toBe("risk");
    expect(itemsFor(r).map((i) => i.queue)).toEqual(expect.arrayContaining(["live", "data"]));
  });
});

describe("monitoring coverage", () => {
  it("weights coverage by outstanding debt and excludes incomplete position feeds", () => {
    const a = record(),
      b = record();
    a.live!.totalMintedZchf = 100;
    b.live!.totalMintedZchf = 300;
    a.live!.safety!.debtWithin.pct10 = 20;
    b.live!.safety!.debtWithin.pct10 = 70;
    b.live!.reconciliation.divergent = true;
    expect(monitoringCoverage([a, b], NOW)).toMatchObject({
      totalDebt: 400,
      monitoredDebt: 100,
      sharePct: 25,
      incompleteAssets: 1,
      freshNearDebt: 20,
    });
    a.issues.push({ code: "protocol-unavailable", severity: "medium", message: "missing source" });
    expect(monitoringCoverage([a, b], NOW).sharePct).toBe(0);
    expect(monitoringCoverage([], NOW).sharePct).toBeNull();
  });
  it("does not call partly unpriced positions fully monitored", () => {
    const r = record();
    r.live!.positions.list.find((p) => p.status === "active" && p.minted > 0)!.liquidationPriceZchf = 0;
    expect(monitoringComplete(r, NOW)).toBe(false);
  });
});

describe("static price scenarios", () => {
  const positions: Pick<LiveCollateral["positions"]["list"][number], "status" | "minted" | "liquidationPriceZchf">[] = [
    { status: "active", minted: 100, liquidationPriceZchf: 90 },
    { status: "active", minted: 300, liquidationPriceZchf: 60 },
    { status: "closed", minted: 1000, liquidationPriceZchf: 100 },
    { status: "active", minted: 0, liquidationPriceZchf: 100 },
    { status: "active", minted: 500, liquidationPriceZchf: 0 },
  ];
  it("includes equality at the threshold and counts debt only once", () => {
    expect(priceScenario(positions, 100, 900, 0)).toMatchObject({ debt: 0, positions: 0 });
    expect(priceScenario(positions, 100, 900, 10)).toMatchObject({ debt: 100, priceChf: 90, positions: 1 });
    expect(priceScenario(positions, 100, 900, 40)).toMatchObject({ debt: 400, priceChf: 60, positions: 2 });
    expect(priceScenario(positions, 100, 900, 40)!.sharePct).toBeCloseTo((400 / 900) * 100);
    expect(priceScenario(positions, 100, 900, 80)!.debt).toBe(400);
  });
  it("rejects invalid price inputs and does not invent a share for zero debt", () => {
    expect(priceScenario(positions, 0, 400, 10)).toBeNull();
    for (const drop of [-1, 101, NaN]) expect(priceScenario(positions, 100, 400, drop)).toBeNull();
    expect(priceScenario([], 100, 0, 10)!.sharePct).toBeNull();
  });
});

describe("exposure browsing", () => {
  it("groups BTC wrappers while preserving individual identities and issuer links", () => {
    const a = record(),
      b = record(),
      impostor = record();
    a.live!.totalMintedZchf = 100;
    b.address = CBBTC;
    b.ticker = "cbBTC";
    b.slug = "cbbtc";
    b.live!.totalMintedZchf = 300;
    impostor.address = "0x0000000000000000000000000000000000000001";
    impostor.slug = "wbtc-other";
    impostor.live!.totalMintedZchf = 100;
    const groups = exposureGroups([a, b, impostor]);
    expect(groups[0]).toMatchObject({ label: "Bitcoin", debt: 400, sharePct: 80 });
    expect(groups[0]!.assets.map((a) => a.slug)).toEqual(["cbbtc", "wbtc"]);
    expect(groups[1]!.label).toBe("Other / unclassified");
  });
  it("keeps outstanding debt in current backing even after a facility closes", () => {
    expect(inView({ lifecycle: "closed", mintedZchf: 100 }, "current")).toBe(true);
    expect(inView({ lifecycle: "closed", mintedZchf: 100 }, "archive")).toBe(false);
    expect(inView({ lifecycle: "closed", mintedZchf: 0 }, "archive")).toBe(true);
    expect(inView({ lifecycle: "live", mintedZchf: 0 }, "proposals")).toBe(true);
    expect(collateralView("nonsense")).toBe("current");
  });
  it("combines search, exposure groups and view filters", () => {
    const r = toRow(record(), 1_000_000);
    expect(matchesFilters(r, "current", " WbTc ", "Bitcoin")).toBe(true);
    expect(matchesFilters(r, "current", WBTC, "Bitcoin")).toBe(true);
    expect(matchesFilters(r, "current", "WBTC", "Gold")).toBe(false);
    expect(matchesFilters(r, "archive", "WBTC", "Bitcoin")).toBe(false);
  });
});

describe("author's opening summary", () => {
  it("preserves the author's words without relying on standard headings", () => {
    const paragraph = "This asset depends on its custodian and redemption process, which must be considered alongside its market price.";
    const html = assessmentExcerpt(
      `# An unusual heading\n\n${paragraph}\n\n## Another heading\n\n${paragraph}\n\nA third paragraph that should not be repeated in the summary, since it is already in the assessment.`,
    );
    expect(html.match(/This asset depends/g)).toHaveLength(2);
    expect(html).not.toContain("third paragraph");
    expect(html).not.toContain("<h");
  });
  it("sanitises author-supplied markup before displaying it in the overview", () => {
    const html = assessmentExcerpt(
      'This assessment contains an embedded image and an unsafe link that must be sanitised. <img src="x" onerror="alert(1)"> [unsafe](javascript:alert(1))',
    );
    expect(html).not.toMatch(/onerror|javascript:/);
    expect(html).toContain("must be sanitised");
  });
});
