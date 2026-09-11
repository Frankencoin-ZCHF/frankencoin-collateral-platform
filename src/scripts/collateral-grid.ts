/**
 * Overview table island: AG Grid Community fed by the JSON embedded in the page
 * (`#grid-data`, written with jsonForScript so it cannot break out of its element).
 * Renderers build DOM nodes / escaped strings — assessment-controlled text never reaches
 * innerHTML unescaped. Also wires the toolbar and hides the SSR fallback once mounted.
 */

import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  themeQuartz,
  type ColDef,
  type ColGroupDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams,
  type ValueFormatterParams,
} from "ag-grid-community";
import type { CollateralRow } from "@/lib/rows";
import { escapeHtml } from "@/lib/html";
import { formatCompact, formatNumber, formatPercent, formatPrice } from "@/lib/numbers";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  fontFamily: "Avenir, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial",
  fontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 700,
  headerBackgroundColor: "#f9fafc",
  headerTextColor: "#5d647b",
  borderColor: "#dfe0e6",
  accentColor: "#0f80f0",
  rowHoverColor: "#f7f7f9",
  selectedRowBackgroundColor: "#eaf3fe",
  borderRadius: 8,
  wrapperBorderRadius: 12,
  spacing: 6,
  rowHeight: 42,
  headerHeight: 38,
});

type Num = ValueFormatterParams<CollateralRow, number | null>;
const num = (dp: number) => (p: Num) => (p.value == null ? "–" : formatNumber(p.value, dp));
const pct = (dp: number) => (p: Num) => (p.value == null ? "–" : formatPercent(p.value, dp));
const compact = (p: Num) => (p.value == null ? "–" : formatCompact(p.value));
const price = (p: Num) => (p.value == null ? "–" : formatPrice(p.value));
const date = (p: ValueFormatterParams<CollateralRow, string | null>) => (p.value ? p.value.slice(0, 10) : "–");

const PILL: Record<string, string> = {
  draft: "fc-pill-draft",
  published: "fc-pill-published",
  deprecated: "fc-pill-deprecated",
  none: "fc-pill-insufficient",
  strong: "fc-pill-strong",
  sufficient: "fc-pill-sufficient",
  insufficient: "fc-pill-insufficient",
  live: "fc-pill-published",
  proposed: "fc-pill-live",
  closed: "fc-pill-neutral",
  denied: "fc-pill-insufficient",
};

/** Escaped pill markup — `value` is assessment/protocol controlled. */
function pill(value: string | null | undefined, label?: string): string {
  if (!value) return '<span class="text-[var(--color-gray-60)]">–</span>';
  const cls = PILL[value.toLowerCase()] ?? "fc-pill-neutral";
  return `<span class="fc-pill ${cls}">${escapeHtml(label ?? value)}</span>`;
}

/** DOM-built link cell (no HTML string interpolation of the ticker). */
function tickerCell(p: ICellRendererParams<CollateralRow>): HTMLElement {
  const a = document.createElement("a");
  a.href = p.data?.url ?? "#";
  a.className = "font-bold text-[var(--color-brand-deep-blue)] hover:text-[var(--color-brand-swiss)]";
  a.textContent = String(p.value ?? "");
  return a;
}

/** Precise finding label; incomplete monitoring never receives a reassuring pill. */
function liveRiskCell(p: ICellRendererParams<CollateralRow>): HTMLElement {
  const a = document.createElement("a");
  const state = p.data?.liveRiskState;
  a.href = p.data?.attentionUrl ?? "/attention";
  a.className = `fc-finding ${state === "risk" ? "text-red-800" : state === "watch" || state === "unknown" ? "text-amber-900" : "text-[var(--color-neutral-650)]"}`;
  a.textContent = p.data?.monitoringLabel ?? "Monitoring unavailable";
  a.title = p.data?.monitoringDetail ?? "";
  return a;
}

/** Assessment-review items (draft-proposal differences, missing governance reference). */
function reviewCell(p: ICellRendererParams<CollateralRow>): HTMLElement {
  const n = p.data?.reviewCount ?? 0;
  if (n === 0) {
    const span = document.createElement("span");
    span.textContent = "–";
    span.className = "text-[var(--color-gray-60)]";
    return span;
  }
  const a = document.createElement("a");
  a.href = p.data ? `/attention#review-${p.data.slug}` : "/attention#review";
  a.textContent = String(n);
  a.className = "fc-pill fc-pill-neutral hover:bg-[var(--color-neutral-300)]";
  a.title = (p.data?.review ?? []).join("\n");
  return a;
}

const columnDefs: (ColDef<CollateralRow> | ColGroupDef<CollateralRow>)[] = [
  {
    headerName: "Asset",
    children: [
      { field: "ticker", headerName: "Ticker", pinned: "left", width: 120, cellRenderer: tickerCell },
      { field: "name", headerName: "Name", width: 190 },
      { field: "lifecycle", headerName: "Lifecycle", width: 150, cellRenderer: (p: ICellRendererParams<CollateralRow>) => pill(p.value, p.data?.isBridge ? `${p.value} · 1:1 bridge` : undefined), headerTooltip: "Collateral lifecycle from protocol state. '1:1 bridge' = a StablecoinBridge minter, not a collateralised position." },
      { field: "status", headerName: "Assessment", width: 125, cellRenderer: (p: ICellRendererParams<CollateralRow>) => pill(p.value, p.value === "none" ? "none" : undefined) },
      { field: "liveRiskState", headerName: "Current findings", width: 220, cellRenderer: liveRiskCell, headerTooltip: "Financial monitoring findings and data-quality limitations. Click for details." },
      { field: "reviewCount", headerName: "Review", width: 90, type: "num", cellRenderer: reviewCell, headerTooltip: "Assessment-review items: differences against a draft proposal, missing governance reference.", hide: true },
      { field: "assessedOn", headerName: "Assessed on", width: 120, valueFormatter: date, filter: "agDateColumnFilter", hide: true },
    ],
  },
  {
    headerName: "Risk assessment",
    children: [
      { field: "freeFloat", headerName: "Free float", width: 120, cellRenderer: (p: ICellRendererParams<CollateralRow>) => pill(p.value), hide: true },
      { field: "publicInformation", headerName: "Public info", width: 120, cellRenderer: (p: ICellRendererParams<CollateralRow>) => pill(p.value), hide: true },
      { field: "marketRiskPct", headerName: "Observed downside", width: 120, type: "num", valueFormatter: pct(2), headerTooltip: "Historical downside from the assessment, measured over twice its proposed auction duration. Not a future loss ceiling.", hide: true },
      { field: "retainedReservePct", headerName: "Assessed reserve", width: 135, type: "num", valueFormatter: pct(1), headerTooltip: "Share of minted ZCHF proposed to be retained for liquidation outcomes", hide: true },
      { field: "targetRatePct", headerName: "Assessed effective rate", width: 140, type: "num", valueFormatter: pct(2), headerTooltip: "Assessed effective annual interest rate, after reserve adjustment", hide: true },
      { field: "totalCompensationPct", headerName: "Tail-risk comp.", width: 130, type: "num", valueFormatter: pct(2), hide: true },
      { field: "liquidationPriceAssessed", headerName: "Liq. price (assessed)", width: 150, type: "num", valueFormatter: price, hide: true },
      { field: "auctionDurationHours", headerName: "Auction (h)", width: 110, type: "num", valueFormatter: num(0), hide: true },
      { field: "author", headerName: "Author", width: 150, hide: true },
      { field: "assessmentSha", headerName: "Version", width: 100, hide: true },
    ],
  },
  {
    headerName: "On-chain (Ethereum)",
    children: [
      { field: "priceChf", headerName: "Reference CHF price", width: 135, type: "num", valueFormatter: price, headerTooltip: "Market price used for display and monitoring, not an automatic liquidation trigger" },
      { field: "priceUsd", headerName: "Price USD", width: 120, type: "num", valueFormatter: price, hide: true },
      { field: "change24hPct", headerName: "24h", width: 90, type: "num", valueFormatter: pct(1), cellClassRules: { "text-emerald-700": (p) => (p.value ?? 0) > 0, "text-red-700": (p) => (p.value ?? 0) < 0 }, hide: true },
      { field: "positionsOpen", headerName: "Open positions", width: 125, type: "num", valueFormatter: num(0) },
      { field: "mintedZchf", headerName: "Minted ZCHF", width: 125, type: "num", valueFormatter: compact },
      { field: "collateralValueChf", headerName: "Estimated collateral value", width: 170, type: "num", valueFormatter: compact, headerTooltip: "Collateral quantity × last observed reference price", hide: true },
      { field: "minLiquidationBufferPct", headerName: "Nearest price cushion", width: 130, type: "num", valueFormatter: (p: Num) => (p.data?.isBridge ? "n/a (1:1)" : p.value == null ? "–" : formatPercent(p.value, 1)), headerTooltip: "Minimum liquidation buffer: reference-price distance to the highest configured liquidation price", cellClassRules: { "text-red-700": (p) => p.value != null && p.value < 5, "text-amber-700": (p) => p.value != null && p.value >= 5 && p.value < 15 } },
      { field: "debtWithin10Pct", headerName: "Debt ≤10% of liq.", width: 140, type: "num", valueFormatter: compact, hide: true },
      { field: "weightedCollateralRatioPct", headerName: "Collateralisation", width: 135, type: "num", valueFormatter: pct(0), hide: true },
      { field: "utilizationPct", headerName: "Debt / collateral value", width: 110, type: "num", valueFormatter: pct(1), headerTooltip: "Debt ÷ reference-priced collateral", hide: true },
      { field: "riskPremiumAvgPct", headerName: "V2 contract premium", width: 120, type: "num", valueFormatter: pct(2), headerTooltip: "Live position-weighted risk premium", hide: true },
      { field: "effectiveInterestAvgPct", headerName: "Effective annual interest", width: 170, type: "num", valueFormatter: pct(2), headerTooltip: "Reserve-adjusted annual rate, weighted by debt outside reserve" },
      { field: "overcollateralisationPct", headerName: "Average overcollateralisation", width: 190, type: "num", valueFormatter: pct(1), headerTooltip: "Total collateral value divided by gross debt, minus one" },
      { field: "outsideReserveZchf", headerName: "ZCHF outside reserve", width: 170, type: "num", valueFormatter: compact, hide: true },
      { field: "reserveRequiredZchf", headerName: "Minter reserve requirement", width: 180, type: "num", valueFormatter: compact, hide: true },
      { field: "annualInterestAvgPct", headerName: "Gross annual fee rate", width: 150, type: "num", valueFormatter: pct(2), headerTooltip: "Base rate + contract premium, before reserve adjustment, minted-weighted", hide: true },
      { field: "reserveContributionAvgPct", headerName: "Live reserve", width: 115, type: "num", valueFormatter: pct(1), hide: true },
      { field: "remainingLimitZchf", headerName: "Remaining agg. limit", width: 150, type: "num", valueFormatter: compact, headerTooltip: "Unused aggregate limit; actual borrowing depends on position terms and collateral", hide: true },
      { field: "totalLimitZchf", headerName: "Aggregate limit", width: 130, type: "num", valueFormatter: compact, hide: true },
      { field: "collateralAmount", headerName: "Collateral (units)", width: 140, type: "num", valueFormatter: (p: Num) => (p.value == null ? "–" : formatNumber(p.value, p.value < 10 ? 4 : 2)), hide: true },
      { field: "liquidationPriceMin", headerName: "Liq. price min", width: 125, type: "num", valueFormatter: price, hide: true },
      { field: "liquidationPriceMax", headerName: "Liq. price max", width: 125, type: "num", valueFormatter: price, hide: true },
      { field: "activeChallenges", headerName: "Challenges", width: 110, type: "num", valueFormatter: num(0), headerTooltip: "Active challenges", hide: true },
      { field: "nextExpiry", headerName: "Next expiry", width: 120, valueFormatter: date, hide: true },
    ],
  },
];

function leafColumns(defs: typeof columnDefs): ColDef<CollateralRow>[] {
  return defs.flatMap((d) => ("children" in d ? (d.children as ColDef<CollateralRow>[]) : [d]));
}

interface Chips {
  lifecycle: string; // all | live | proposed | draft | closed | denied
  status: string; // all | published | draft | deprecated | none
  classification: string; // all | strong | sufficient | insufficient
  issuesOnly: boolean;
}

export function mount() {
  const el = document.getElementById("collateral-grid");
  const dataEl = document.getElementById("grid-data");
  if (!el || !dataEl || el.dataset.mounted) return;

  const rows: CollateralRow[] = JSON.parse(dataEl.textContent ?? "[]");

  const chips: Chips = { lifecycle: "all", status: "all", classification: "all", issuesOnly: false };
  const STORAGE_KEY = "fc-collaterals-grid-columns-v3";

  const options: GridOptions<CollateralRow> = {
    theme,
    rowData: rows,
    columnDefs,
    columnTypes: { num: { cellClass: "fc-num", filter: "agNumberColumnFilter", headerClass: "ag-right-aligned-header" } },
    defaultColDef: { sortable: true, resizable: true, filter: true, minWidth: 80, wrapHeaderText: true, autoHeaderHeight: true },
    domLayout: "autoHeight",
    animateRows: false,
    suppressCellFocus: false,
    enableCellTextSelection: true,
    tooltipShowDelay: 300,
    getRowId: (p) => p.data.slug,
    onRowClicked: (e) => {
      const target = e.event?.target as HTMLElement | null;
      if (target?.closest("a")) return;
      if (e.data) window.location.href = e.data.url;
    },
    rowClass: "cursor-pointer",
    isExternalFilterPresent: () => chips.lifecycle !== "all" || chips.status !== "all" || chips.classification !== "all" || chips.issuesOnly,
    doesExternalFilterPass: (node) => {
      const d = node.data;
      if (!d) return false;
      if (chips.lifecycle !== "all" && d.lifecycle !== chips.lifecycle) return false;
      if (chips.status !== "all" && d.status !== chips.status) return false;
      if (chips.classification !== "all" && (d.freeFloat ?? "").toLowerCase() !== chips.classification) return false;
      if (chips.issuesOnly && d.liveRiskState === "ok") return false;
      return true;
    },
    onColumnVisible: (e) => persistColumns(e.api),
    onColumnMoved: (e) => persistColumns(e.api),
    onGridReady: (e) => restoreColumns(e.api),
  };

  const api = createGrid(el, options);

  el.dataset.mounted = "1";
  el.removeAttribute("hidden");

  const search = document.getElementById("grid-search") as HTMLInputElement | null;
  search?.addEventListener("input", () => api.setGridOption("quickFilterText", search.value));
  if (search?.value) api.setGridOption("quickFilterText", search.value);

  document.querySelectorAll<HTMLButtonElement>("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [group, value] = (btn.dataset.chip ?? "").split(":");
      if (group === "lifecycle") chips.lifecycle = value ?? "all";
      if (group === "status") chips.status = value ?? "all";
      if (group === "class") chips.classification = value ?? "all";
      if (group === "issues") chips.issuesOnly = !chips.issuesOnly;
      syncChips();
      api.onFilterChanged();
      updateCount();
    });
  });

  document.getElementById("grid-reset")?.addEventListener("click", () => {
    Object.assign(chips, { lifecycle: "all", status: "all", classification: "all", issuesOnly: false });
    if (search) search.value = "";
    api.setGridOption("quickFilterText", "");
    api.setFilterModel(null);
    syncChips();
    api.onFilterChanged();
    updateCount();
  });

  document.getElementById("grid-export")?.addEventListener("click", () => {
    api.exportDataAsCsv({ fileName: `frankencoin-collaterals-${new Date().toISOString().slice(0, 10)}.csv`, allColumns: true });
  });

  const menu = document.getElementById("grid-columns-menu");
  if (menu && !menu.childElementCount) {
    for (const col of leafColumns(columnDefs)) {
      const id = col.field as string;
      const label = document.createElement("label");
      label.className = "flex items-center gap-2 ty-small px-3 py-1.5 hover:bg-[var(--color-gray-10)] cursor-pointer whitespace-nowrap";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "accent-[var(--color-brand-swiss)]";
      cb.checked = api.getColumn(id)?.isVisible() ?? !col.hide;
      cb.dataset.col = id;
      cb.addEventListener("change", () => api.setColumnsVisible([id], cb.checked));
      label.append(cb, document.createTextNode(col.headerName ?? id));
      menu.append(label);
    }
    api.addEventListener("columnVisible", () => {
      menu.querySelectorAll<HTMLInputElement>("input[data-col]").forEach((cb) => {
        cb.checked = api.getColumn(cb.dataset.col!)?.isVisible() ?? false;
      });
    });
  }

  api.addEventListener("filterChanged", updateCount);
  syncChips();
  updateCount();

  function syncChips() {
    document.querySelectorAll<HTMLButtonElement>("[data-chip]").forEach((btn) => {
      const [group, value] = (btn.dataset.chip ?? "").split(":");
      const active =
        (group === "lifecycle" && chips.lifecycle === value) ||
        (group === "status" && chips.status === value) ||
        (group === "class" && chips.classification === value) ||
        (group === "issues" && chips.issuesOnly);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function updateCount() {
    const c = document.getElementById("grid-count");
    if (c) c.textContent = `${api.getDisplayedRowCount()} of ${rows.length}`;
  }

  function persistColumns(gridApi: GridApi<CollateralRow>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gridApi.getColumnState().map((c) => ({ colId: c.colId, hide: c.hide }))));
    } catch {
      /* storage unavailable */
    }
  }

  function restoreColumns(gridApi: GridApi<CollateralRow>) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      gridApi.applyColumnState({ state: JSON.parse(raw) as { colId: string; hide: boolean }[] });
    } catch {
      /* ignore */
    }
  }
}
