import type { CollateralRow } from "./rows";
export const VIEWS = ["current", "proposals", "archive", "all"] as const;
export type CollateralView = (typeof VIEWS)[number];
export function collateralView(value: string | null): CollateralView {
  return VIEWS.includes(value as CollateralView) ? (value as CollateralView) : "current";
}
export function inView(row: Pick<CollateralRow, "mintedZchf" | "lifecycle">, view: CollateralView): boolean {
  if (view === "all") return true;
  if ((row.mintedZchf ?? 0) > 0) return view === "current";
  const archived = row.lifecycle === "closed" || row.lifecycle === "denied";
  return view === "archive" ? archived : view === "proposals" && !archived;
}
export function matchesFilters(row: CollateralRow, view: CollateralView, query = "", group = "all"): boolean {
  return (
    inView(row, view) &&
    (group === "all" || row.exposureGroup === group) &&
    `${row.ticker} ${row.name} ${row.address ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );
}

export const SORTS = ["exposure", "name", "backing", "interest"] as const;
export type CollateralSort = (typeof SORTS)[number];
export function collateralSort(value: string | null): CollateralSort {
  return SORTS.includes(value as CollateralSort) ? value as CollateralSort : "exposure";
}
export function sortRows(rows: CollateralRow[], sort: CollateralSort): CollateralRow[] {
  return [...rows].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const key = sort === "backing" ? "overcollateralisationPct" : sort === "interest" ? "effectiveInterestAvgPct" : "mintedZchf";
    const av = a[key], bv = b[key];
    if (av === null || bv === null) return av === bv ? a.name.localeCompare(b.name) : av === null ? 1 : -1;
    return (sort === "exposure" ? bv - av : av - bv) || a.name.localeCompare(b.name);
  });
}
