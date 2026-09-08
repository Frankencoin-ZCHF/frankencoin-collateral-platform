import { assetProfile } from "@/lib/assets";
import { formatCompact, formatPercent, round, sum } from "@/lib/numbers";
import type { CollateralRecord, LiveCollateral, Position } from "@/types";

export interface PriceQuality {
  state: "current" | "stale" | "unavailable" | "invalid-time";
  label: string;
  detail: string;
  observedAt: string | null;
  maxAgeHours: number;
}

/** Freshness is about the source observation, not when a response was fetched. */
export function priceQuality(live: LiveCollateral, now = Date.now()): PriceQuality {
  const maxAgeHours = assetProfile(live.address, Boolean(live.bridge)).priceMaxAgeHours;
  const p = live.price;
  const base = { observedAt: p?.timestamp ?? null, maxAgeHours };
  if (!p || !Number.isFinite(p.chf) || p.chf <= 0)
    return {
      ...base,
      state: "unavailable",
      label: "Reference price unavailable",
      detail: "Price-based monitoring cannot be evaluated without a valid reference price.",
    };
  const timestamp = p.timestamp ? Date.parse(p.timestamp) : NaN;
  if (!Number.isFinite(timestamp) || timestamp > now + 5 * 60_000)
    return {
      ...base,
      state: "invalid-time",
      label: "Price timestamp unverified",
      detail: "The reference price has no valid observation time. Its freshness cannot be established.",
    };
  const ageHours = Math.max(0, (now - timestamp) / 3_600_000);
  if (ageHours > maxAgeHours)
    return {
      ...base,
      state: "stale",
      label: "Price data outdated",
      detail: `The last price observation is ${Math.floor(ageHours)} hours old; this asset's monitoring window is ${maxAgeHours} hours. Price-based figures describe that earlier observation.`,
    };
  return {
    ...base,
    state: "current",
    label: "Reference price current",
    detail: `Observed within the ${maxAgeHours}-hour monitoring window. This is a data-freshness check, not a guarantee of market liquidity.`,
  };
}

export function hasCurrentExposure(r: CollateralRecord): boolean {
  return (r.live?.totalMintedZchf ?? 0) > 0;
}

export function monitoringComplete(r: CollateralRecord, now = Date.now()): boolean {
  const l = r.live;
  if (!l || !hasCurrentExposure(r) || l.reconciliation.divergent || priceQuality(l, now).state !== "current") return false;
  if (r.issues.some((i) => i.code === "protocol-unavailable" || i.code === "address-mismatch")) return false;
  return Boolean(
    l.bridge ||
    (l.safety && l.positions.list.filter((p) => p.status === "active" && p.minted > 0).every((p) => p.liquidationPriceZchf > 0)),
  );
}

export function monitoringCoverage(records: CollateralRecord[], now = Date.now()) {
  const exposed = records.filter(hasCurrentExposure);
  const totalDebt = sum(exposed.map((r) => r.live!.totalMintedZchf));
  const monitored = exposed.filter((r) => monitoringComplete(r, now));
  const monitoredDebt = sum(monitored.map((r) => r.live!.totalMintedZchf));
  const valued = exposed.filter((r) => r.live!.collateralValueChf !== null);
  return {
    totalDebt,
    monitoredDebt,
    sharePct: totalDebt > 0 ? round((monitoredDebt / totalDebt) * 100, 1) : null,
    incompleteAssets: exposed.length - monitored.length,
    valuedAssets: valued.length,
    exposedAssets: exposed.length,
    backingValueChf: sum(valued.map((r) => r.live!.collateralValueChf)),
    freshNearDebt: sum(monitored.map((r) => r.live!.safety?.debtWithin.pct10)),
  };
}

export function exposureGroups(records: CollateralRecord[]) {
  const total = sum(records.map((r) => r.live?.totalMintedZchf));
  const groups = new Map<
    string,
    { label: string; debt: number; sharePct: number; assets: { ticker: string; slug: string; debt: number }[] }
  >();
  for (const r of records.filter(hasCurrentExposure)) {
    const label = assetProfile(r.address, Boolean(r.live?.bridge)).group;
    const group = groups.get(label) ?? { label, debt: 0, sharePct: 0, assets: [] };
    group.debt += r.live!.totalMintedZchf;
    group.assets.push({ ticker: r.ticker, slug: r.slug, debt: r.live!.totalMintedZchf });
    groups.set(label, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, sharePct: total > 0 ? (g.debt / total) * 100 : 0, assets: g.assets.sort((a, b) => b.debt - a.debt) }))
    .sort((a, b) => b.debt - a.debt);
}

export interface PriceScenario {
  dropPct: number;
  priceChf: number;
  debt: number;
  sharePct: number | null;
  positions: number;
}
/** Static threshold exposure; never an auction-outcome or loss forecast. */
export function priceScenario(
  positions: Pick<Position, "status" | "minted" | "liquidationPriceZchf">[],
  referencePrice: number,
  totalDebt: number,
  dropPct: number,
): PriceScenario | null {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0 || !Number.isFinite(dropPct) || dropPct < 0 || dropPct > 100) return null;
  const priceChf = referencePrice * (1 - dropPct / 100);
  const exposed = positions.filter(
    (p) => p.status === "active" && p.minted > 0 && p.liquidationPriceZchf > 0 && p.liquidationPriceZchf >= priceChf,
  );
  const debt = sum(exposed.map((p) => p.minted));
  return { dropPct, priceChf, debt, sharePct: totalDebt > 0 ? (debt / totalDebt) * 100 : null, positions: exposed.length };
}

export function nearDebtDescription(l: LiveCollateral): string {
  const debt = l.safety?.debtWithin.pct10;
  if (debt == null) return "Position-level price exposure unavailable.";
  return `${formatCompact(debt)} ZCHF (${formatPercent(l.totalMintedZchf > 0 ? (debt / l.totalMintedZchf) * 100 : null, 2)} of this asset's debt) is within 10% of its configured liquidation price at the last observed market price.`;
}
