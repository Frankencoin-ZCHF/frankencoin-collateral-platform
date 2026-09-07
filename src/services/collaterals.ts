/**
 * The joined view: every collateral that is assessed, live on-chain, or both —
 * one record per address. Single input for the overview, the JSON API and the
 * detail-page header.
 */

import { getOrLoad, TTL } from "@/lib/cache";
import { describeForLog } from "@/lib/errors";
import { round, sum } from "@/lib/numbers";
import { slugFromTicker } from "@/lib/slug";
import * as coingecko from "@/upstream/coingecko";
import * as assessments from "./assessments";
import * as protocol from "./protocol";
import type { Assessment, CollateralRecord, LiveCollateral } from "@/types";

export interface CollateralSet {
  records: CollateralRecord[];
  assessmentsHead: import("@/types").VersionRef | null;
  assessmentFailures: import("@/types").ParseFailure[];
  protocolFetchedAt: string | null;
  /** Human-readable notes about degraded sources. */
  warnings: string[];
}

/** Pure join. Exported for tests. */
export function join(items: Assessment[], live: Map<string, LiveCollateral>): CollateralRecord[] {
  const records: CollateralRecord[] = [];
  const usedAddresses = new Set<string>();
  const usedSlugs = new Set<string>();

  // Pass 1: exact address matches.
  const matched = new Map<Assessment, LiveCollateral | null>();
  for (const a of items) {
    const l = a.data.address ? live.get(a.data.address) ?? null : null;
    if (l) usedAddresses.add(l.address);
    matched.set(a, l);
  }
  // Pass 2: an assessment whose address matched nothing is joined to a *listed* on-chain
  // collateral with the same symbol (case-insensitive) — the mismatch is flagged on the record.
  // Restricting to listed collaterals keeps same-symbol impostor tokens out.
  const liveBySymbol = new Map<string, LiveCollateral>();
  for (const l of live.values()) if (l.listed && !usedAddresses.has(l.address)) liveBySymbol.set(l.symbol.toLowerCase(), l);

  for (const a of items) {
    let l = matched.get(a) ?? null;
    let addressMismatch: CollateralRecord["addressMismatch"] = null;
    if (!l) {
      const bySymbol = liveBySymbol.get(a.ticker.toLowerCase());
      if (bySymbol && !usedAddresses.has(bySymbol.address)) {
        l = bySymbol;
        usedAddresses.add(l.address);
        addressMismatch = { assessed: a.data.address, onchain: l.address };
      }
    }
    usedSlugs.add(a.slug);
    records.push({
      slug: a.slug,
      ticker: a.ticker,
      name: a.data.assetName || l?.name || a.ticker,
      address: l?.address ?? a.data.address ?? null,
      kind: l ? "both" : "assessed",
      assessment: a,
      live: l,
      addressMismatch,
    });
  }

  for (const [addr, l] of live) {
    if (usedAddresses.has(addr)) continue;
    // Unlisted tokens that only ever had denied/closed positions are noise, not collaterals.
    if (!l.listed && l.positions.active === 0) continue;
    let slug = slugFromTicker(l.symbol);
    if (usedSlugs.has(slug)) slug = `${slug}-${addr.slice(2, 8)}`;
    usedSlugs.add(slug);
    records.push({ slug, ticker: l.symbol, name: l.name, address: addr, kind: "live-only", assessment: null, live: l, addressMismatch: null });
  }

  return records.sort((a, b) => {
    // Assessed first, then by minted ZCHF desc, then ticker.
    const ka = a.assessment ? 0 : 1;
    const kb = b.assessment ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const ma = a.live?.totalMintedZchf ?? 0;
    const mb = b.live?.totalMintedZchf ?? 0;
    if (mb !== ma) return mb - ma;
    return a.ticker.localeCompare(b.ticker, "en", { sensitivity: "base" });
  });
}

/** Best-effort CoinGecko market enrichment for records whose assessment links a coin page. */
async function enrichMarket(records: CollateralRecord[]): Promise<void> {
  const idFor = new Map<CollateralRecord, string>();
  for (const r of records) {
    const link = r.assessment?.data.links.find((l) => l.key === "coingecko")?.url;
    const id = coingecko.idFromUrl(link);
    if (id && r.live) idFor.set(r, id);
  }
  if (idFor.size === 0) return;
  const prices = await coingecko.simplePrice([...idFor.values()]);
  for (const [r, id] of idFor) {
    const p = prices[id];
    if (!p || !r.live) continue;
    r.live.market = {
      change24hPct: typeof p.usd_24h_change === "number" ? round(p.usd_24h_change, 2) : null,
      marketCapUsd: typeof p.usd_market_cap === "number" ? Math.round(p.usd_market_cap) : null,
    };
  }
}

export function all(): Promise<CollateralSet> {
  return getOrLoad("svc:collaterals:all", TTL.MINUTE, async () => {
    const warnings: string[] = [];
    const [idx, snap] = await Promise.allSettled([assessments.index(), protocol.snapshot()]);

    if (idx.status === "rejected") {
      console.error(`[collaterals] assessments index failed: ${describeForLog(idx.reason)}`);
      warnings.push("Risk assessments could not be loaded from GitHub.");
    }
    if (snap.status === "rejected") {
      console.error(`[collaterals] protocol snapshot failed: ${describeForLog(snap.reason)}`);
      warnings.push("Live protocol data could not be loaded from api.frankencoin.com.");
    } else if (snap.value.degraded.length) {
      warnings.push(`Partially degraded protocol data (${snap.value.degraded.join(", ")}).`);
    }
    if (idx.status === "rejected" && snap.status === "rejected") throw idx.reason;

    const items = idx.status === "fulfilled" ? idx.value.items : [];
    const live = snap.status === "fulfilled" ? snap.value.byAddress : new Map<string, LiveCollateral>();
    const records = join(items, live);
    await enrichMarket(records);

    return {
      records,
      assessmentsHead: idx.status === "fulfilled" ? idx.value.head : null,
      assessmentFailures: idx.status === "fulfilled" ? idx.value.failures : [],
      protocolFetchedAt: snap.status === "fulfilled" ? snap.value.fetchedAt : null,
      warnings,
    };
  }, { swrMs: 5 * TTL.MINUTE });
}

export async function bySlug(slug: string): Promise<CollateralRecord | null> {
  const { records } = await all();
  return records.find((r) => r.slug === slug) ?? null;
}

export interface Summary {
  assessed: number;
  published: number;
  draft: number;
  liveCollaterals: number;
  activePositions: number;
  totalMintedZchf: number;
  totalCollateralValueChf: number;
  activeChallenges: number;
  lastAssessmentDate: string | null;
}

export function summarize(records: CollateralRecord[]): Summary {
  const live = records.map((r) => r.live).filter((l): l is LiveCollateral => l !== null);
  const dates = records.map((r) => r.assessment?.data.assessmentDate).filter((d): d is string => Boolean(d)).sort();
  return {
    assessed: records.filter((r) => r.assessment).length,
    published: records.filter((r) => r.assessment?.status === "published").length,
    draft: records.filter((r) => r.assessment?.status === "draft").length,
    liveCollaterals: live.filter((l) => l.positions.active > 0).length,
    activePositions: sum(live.map((l) => l.positions.active)),
    totalMintedZchf: round(sum(live.map((l) => l.totalMintedZchf)), 0),
    totalCollateralValueChf: round(sum(live.map((l) => l.collateralValueChf)), 0),
    activeChallenges: sum(live.map((l) => l.challenges.active)),
    lastAssessmentDate: dates.at(-1) ?? null,
  };
}
