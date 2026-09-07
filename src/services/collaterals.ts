/**
 * The joined view: every collateral that is assessed, live on-chain, or both — one record
 * per contract address. Single input for the overview, the JSON API and the detail page.
 *
 * Contract address is the identity. An assessment whose address matches nothing on-chain
 * stays an assessment-only record even if a same-symbol token is live — the mismatch is
 * recorded as an integrity issue and surfaced on the dashboard, never silently merged.
 */

import { getOrLoad, TTL } from "@/lib/cache";
import { describeForLog } from "@/lib/errors";
import { round, sum } from "@/lib/numbers";
import { slugFromTicker } from "@/lib/slug";
import * as coingecko from "@/upstream/coingecko";
import * as assessments from "./assessments";
import * as protocol from "./protocol";
import type { Assessment, CollateralLifecycle, CollateralRecord, IntegrityIssue, LiveCollateral, ParseFailure, VersionRef } from "@/types";

export interface CollateralSet {
  records: CollateralRecord[];
  assessmentsHead: VersionRef | null;
  assessmentsFetchedAt: string | null;
  assessmentFailures: ParseFailure[];
  protocolFetchedAt: string | null;
  protocolDegraded: string[];
  /** Human-readable notes about degraded sources. */
  warnings: string[];
}

/** Lifecycle from protocol counts (aggregate endpoint preferred, position feed as fallback). */
export function deriveLifecycle(live: LiveCollateral | null): CollateralLifecycle {
  if (!live) return "draft";
  const c = live.counts;
  const open = c ? c.open : live.positions.active;
  const requested = c ? c.requested : 0;
  const closed = c ? c.closed : live.positions.closed;
  const denied = c ? c.denied : live.positions.denied;
  if (open > 0) return "live";
  if (requested > 0) return "proposed";
  if (closed > 0) return "closed";
  if (denied > 0) return "denied";
  return "proposed"; // known to the protocol, nothing open yet
}

function issuesFor(a: Assessment | null, live: LiveCollateral | null, lifecycle: CollateralLifecycle, today: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  if (a?.data.assessmentDate && a.data.assessmentDate > today) {
    issues.push({ code: "future-date", severity: "medium", message: `Assessment date ${a.data.assessmentDate} lies in the future.` });
  }
  if (live?.reconciliation.divergent) {
    issues.push({ code: "feed-divergence", severity: "medium", message: live.reconciliation.note ?? "Position feed and protocol aggregate disagree." });
  }
  if (lifecycle === "live" && a?.status !== "published") {
    issues.push({ code: "live-without-published", severity: a ? "low" : "medium", message: a ? `Live collateral with a ${a.status} assessment.` : "Live collateral without any risk assessment." });
  }
  if (live?.price?.timestamp) {
    const ageH = (Date.now() - new Date(live.price.timestamp).getTime()) / 3_600_000;
    if (ageH > 24) issues.push({ code: "stale-price", severity: "low", message: `Price feed is ${Math.round(ageH)} h old.` });
  }
  return issues;
}

/** Pure join. Exported for tests. `failures` = assessment files that exist but could not be loaded. */
export function join(items: Assessment[], live: Map<string, LiveCollateral>, today = new Date().toISOString().slice(0, 10), failures: ParseFailure[] = []): CollateralRecord[] {
  const records: CollateralRecord[] = [];
  const usedAddresses = new Set<string>();
  const usedSlugs = new Set<string>();
  const failedBySlug = new Map<string, string>();
  for (const f of failures) {
    const file = f.path.split("/").pop()?.replace(/\.md$/, "");
    if (file) failedBySlug.set(slugFromTicker(file), f.error);
  }

  // Live-only records get their slug from the symbol — but an assessment with the same
  // ticker owns the plain slug, so reserve those first.
  for (const a of items) usedSlugs.add(a.slug);

  const liveSlug = new Map<string, string>();
  const slugForLive = (l: LiveCollateral) => {
    const base = slugFromTicker(l.symbol);
    const slug = usedSlugs.has(base) ? `${base}-${l.address.slice(2, 8)}` : base;
    usedSlugs.add(slug);
    liveSlug.set(l.address, slug);
    return slug;
  };

  // Pass 1: exact address matches.
  const matched = new Map<Assessment, LiveCollateral | null>();
  for (const a of items) {
    const l = a.data.address ? live.get(a.data.address) ?? null : null;
    if (l) usedAddresses.add(l.address);
    matched.set(a, l);
  }

  // Pass 2: live-only records (listed, or with real position history).
  const liveOnly: LiveCollateral[] = [];
  for (const [addr, l] of live) {
    if (usedAddresses.has(addr)) continue;
    if (!l.listed && l.positions.active === 0) continue; // one-off denied/closed impostors
    liveOnly.push(l);
    slugForLive(l);
  }

  for (const a of items) {
    const l = matched.get(a) ?? null;
    const lifecycle = deriveLifecycle(l);
    const issues = issuesFor(a, l, lifecycle, today);
    let addressMismatch: CollateralRecord["addressMismatch"] = null;
    if (!l) {
      const sameSymbol = liveOnly.find((x) => x.listed && x.symbol.toLowerCase() === a.ticker.toLowerCase());
      if (sameSymbol) {
        addressMismatch = { assessed: a.data.address, onchain: sameSymbol.address, liveSlug: liveSlug.get(sameSymbol.address)! };
        issues.unshift({
          code: "address-mismatch",
          severity: "high",
          message: `Assessment declares contract ${a.data.address ?? "(none)"}, but the protocol's ${sameSymbol.symbol} is ${sameSymbol.address}. Not merged.`,
        });
      }
    }
    records.push({
      slug: a.slug,
      ticker: a.ticker,
      name: a.data.assetName || a.ticker,
      address: a.data.address ?? null,
      kind: l ? "both" : "assessed",
      lifecycle,
      assessment: a,
      live: l,
      addressMismatch,
      issues,
      assessmentUnavailable: null,
    });
  }

  for (const l of liveOnly) {
    const lifecycle = deriveLifecycle(l);
    const slug = liveSlug.get(l.address)!;
    const unavailable = failedBySlug.get(slug) ?? failedBySlug.get(slugFromTicker(l.symbol)) ?? null;
    const issues = issuesFor(null, l, lifecycle, today).filter((i) => !(unavailable && i.code === "live-without-published"));
    if (unavailable) {
      issues.unshift({ code: "assessment-unavailable", severity: "medium", message: `The assessment file could not be loaded in this snapshot (${unavailable}). It will be retried shortly.` });
    }
    records.push({
      slug,
      ticker: l.symbol,
      name: l.name,
      address: l.address,
      kind: "live-only",
      lifecycle,
      assessment: null,
      live: l,
      addressMismatch: null,
      issues,
      assessmentUnavailable: unavailable,
    });
  }

  const LIFECYCLE_ORDER: Record<CollateralLifecycle, number> = { live: 0, proposed: 1, draft: 2, closed: 3, denied: 4 };
  return records.sort((a, b) => {
    const la = LIFECYCLE_ORDER[a.lifecycle];
    const lb = LIFECYCLE_ORDER[b.lifecycle];
    if (la !== lb) return la - lb;
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
      warnings.push(`Protocol data partially degraded (${snap.value.degraded.join(", ")}) — affected figures fall back to the position feed.`);
    }
    if (idx.status === "rejected" && snap.status === "rejected") throw idx.reason;

    const items = idx.status === "fulfilled" ? idx.value.items : [];
    const failures = idx.status === "fulfilled" ? idx.value.failures : [];
    if (failures.length) warnings.push(`${failures.length} assessment file${failures.length === 1 ? "" : "s"} could not be loaded from GitHub in this snapshot; the affected collaterals are marked "assessment unavailable" and will be retried shortly.`);
    const live = snap.status === "fulfilled" ? snap.value.byAddress : new Map<string, LiveCollateral>();
    const records = join(items, live, undefined, failures);
    await enrichMarket(records);

    return {
      records,
      assessmentsHead: idx.status === "fulfilled" ? idx.value.head : null,
      assessmentsFetchedAt: idx.status === "fulfilled" ? idx.value.fetchedAt : null,
      assessmentFailures: idx.status === "fulfilled" ? idx.value.failures : [],
      protocolFetchedAt: snap.status === "fulfilled" ? snap.value.fetchedAt : null,
      protocolDegraded: snap.status === "fulfilled" ? snap.value.degraded : ["all"],
      warnings,
    };
  }, { swrMs: 5 * TTL.MINUTE });
}

export async function bySlug(slug: string): Promise<CollateralRecord | null> {
  const { records } = await all();
  return records.find((r) => r.slug === slug) ?? null;
}

export interface Summary {
  lifecycle: Record<CollateralLifecycle, number>;
  assessments: { published: number; draft: number; deprecated: number; none: number };
  liveWithoutPublished: number;
  activePositions: number;
  totalMintedZchf: number;
  totalCollateralValueChf: number;
  /** ZCHF minted in positions within 10 % of their liquidation price. */
  debtWithin10Pct: number;
  activeChallenges: number;
  integrityIssues: number;
  lastAssessmentDate: string | null;
}

export function summarize(records: CollateralRecord[]): Summary {
  const live = records.map((r) => r.live).filter((l): l is LiveCollateral => l !== null);
  const dates = records.map((r) => r.assessment?.data.assessmentDate).filter((d): d is string => Boolean(d)).sort();
  const lifecycle: Record<CollateralLifecycle, number> = { live: 0, proposed: 0, draft: 0, closed: 0, denied: 0 };
  for (const r of records) lifecycle[r.lifecycle]++;
  return {
    lifecycle,
    assessments: {
      published: records.filter((r) => r.assessment?.status === "published").length,
      draft: records.filter((r) => r.assessment?.status === "draft").length,
      deprecated: records.filter((r) => r.assessment?.status === "deprecated").length,
      none: records.filter((r) => !r.assessment).length,
    },
    liveWithoutPublished: records.filter((r) => r.lifecycle === "live" && r.assessment?.status !== "published").length,
    activePositions: sum(live.map((l) => l.counts?.open ?? l.positions.active)),
    totalMintedZchf: round(sum(live.map((l) => l.totalMintedZchf)), 0),
    totalCollateralValueChf: round(sum(live.map((l) => l.collateralValueChf)), 0),
    debtWithin10Pct: round(sum(live.map((l) => l.safety?.debtWithin.pct10 ?? 0)), 0),
    activeChallenges: sum(live.map((l) => l.challenges.active)),
    integrityIssues: sum(records.map((r) => r.issues.filter((i) => i.severity !== "low").length)),
    lastAssessmentDate: dates.at(-1) ?? null,
  };
}
