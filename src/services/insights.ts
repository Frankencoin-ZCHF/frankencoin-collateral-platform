import type { CollateralRecord, Position } from "@/types";
import { assetProfile } from "@/lib/assets";
import { compareParameters } from "./comparison";
import { hasCurrentExposure } from "./monitoring";

/** Shared price drivers are distinct from the asset categories used throughout the UI. */
export function commonExposures(records: CollateralRecord[]) {
  const groups = new Map<string, { label: string; debt: number; assets: { ticker: string; slug: string }[] }>();
  for (const r of records.filter(hasCurrentExposure)) {
    const label = assetProfile(r.address, Boolean(r.live?.bridge)).underlying;
    if (!["Bitcoin", "Ether", "Gold", "Swiss franc"].includes(label)) continue;
    const g = groups.get(label) ?? { label, debt: 0, assets: [] };
    g.debt += r.live!.totalMintedZchf;
    g.assets.push({ ticker: r.ticker, slug: r.slug });
    groups.set(label, g);
  }
  return [...groups.values()].filter(g => g.assets.length > 1).sort((a, b) => b.debt - a.debt);
}
export function maturityProfile(records: CollateralRecord[], now = Date.now()) {
  const buckets = [
    { id: "expired", label: "Already expired" }, { id: "week", label: "Within 7 days" },
    { id: "month", label: "8–30 days" }, { id: "quarter", label: "31–90 days" },
    { id: "later", label: "After 90 days" }, { id: "unknown", label: "Expiry unavailable" },
  ].map(b => ({ ...b, debt: 0, positions: [] as { slug: string; ticker: string; position: Position }[] }));
  let reportedDebt = 0, incompleteAssets = 0;
  for (const r of records.filter(hasCurrentExposure)) {
    const l = r.live!;
    if (l.bridge) continue; // A bridge's minting horizon is not a debt repayment deadline.
    reportedDebt += l.totalMintedZchf;
    if (l.reconciliation.divergent) incompleteAssets++;
    for (const p of l.positions.list.filter(p => p.status === "active" && p.minted > 0)) {
      const days = p.expiresAt ? (Date.parse(p.expiresAt) - now) / 86_400_000 : NaN;
      const index = !Number.isFinite(days) ? 5 : days <= 0 ? 0 : days <= 7 ? 1 : days <= 30 ? 2 : days <= 90 ? 3 : 4;
      buckets[index]!.debt += p.minted;
      buckets[index]!.positions.push({ slug: r.slug, ticker: r.ticker, position: p });
    }
  }
  for (const b of buckets) b.positions.sort((a, b) => b.position.minted - a.position.minted);
  return { buckets, reportedDebt, incompleteAssets, coveredDebt: buckets.reduce((s, b) => s + b.debt, 0) };
}
/** One review action per exposed asset, ordered by the debt it represents. */
export function assessmentPriorities(records: CollateralRecord[]) {
  return records.filter(hasCurrentExposure).flatMap(r => {
    const a = r.assessment;
    const differences = a ? compareParameters(a.data.params, r.live, a.status).filter(p => ["retained_reserve", "risk_premium", "global_minting_limit"].includes(p.key) && ["differs", "varies", "within-range", "within-tolerance"].includes(p.verdict)) : [];
    let action = "", detail = "", anchor = "assessment";
    if (r.assessmentUnavailable) { action = "Restore assessment access"; detail = "The assessment could not be loaded."; }
    else if (!a) { action = "Add a risk assessment"; detail = "Outstanding exposure has no assessment in the repository."; }
    else if (a.status === "deprecated") { action = "Replace archived assessment"; detail = "This asset still backs outstanding ZCHF."; }
    else if (differences.length) {
      action = `Review ${differences.length} lending term${differences.length === 1 ? "" : "s"}`;
      detail = differences.map(p => `${p.label}: ${p.onchain} current / ${p.assessed} ${a.status === "draft" ? "proposed" : "assessed"}`).join(" · ");
      anchor = "risk-parameters";
    } else if (a.status === "draft") { action = "Review draft assessment"; detail = "A draft is available for discussion."; }
    if (!action) return [];
    return [{ slug: r.slug, ticker: r.ticker, category: assetProfile(r.address, Boolean(r.live?.bridge)).type, debt: r.live!.totalMintedZchf, action, detail, url: `/collateral/${r.slug}#${anchor}`, status: a?.status ?? "Missing" }];
  }).sort((a, b) => b.debt - a.debt || a.ticker.localeCompare(b.ticker));
}
