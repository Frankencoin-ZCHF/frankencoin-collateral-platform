/**
 * Overview table island: AG Grid Community fed by the JSON embedded in the page
 * (`#grid-data`). Also wires the toolbar (quick search, chip filters, column
 * visibility menu, CSV export) and hides the SSR fallback table once mounted.
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
  none: "fc-pill-live",
  strong: "fc-pill-strong",
  sufficient: "fc-pill-sufficient",
  insufficient: "fc-pill-insufficient",
};

function pill(value: string | null, labelOverride?: string): string {
  if (!value) return '<span class="text-[var(--color-gray-60)]">–</span>';
  const cls = PILL[value.toLowerCase()] ?? "fc-pill-neutral";
  return `<span class="fc-pill ${cls}">${labelOverride ?? value}</span>`;
}

const columnDefs: (ColDef<CollateralRow> | ColGroupDef<CollateralRow>)[] = [
  {
    headerName: "Asset",
    children: [
      {
        field: "ticker",
        headerName: "Ticker",
        pinned: "left",
        width: 130,
        cellRenderer: (p: ICellRendererParams<CollateralRow>) =>
          `<a href="${p.data?.url}" class="font-bold text-[var(--color-brand-deep-blue)] hover:text-[var(--color-brand-swiss)]">${p.value}</a>`,
      },
      { field: "name", headerName: "Name", width: 200 },
      {
        field: "status",
        headerName: "Assessment",
        width: 130,
        cellRenderer: (p: ICellRendererParams<CollateralRow>) => pill(p.value, p.value === "none" ? "on-chain only" : undefined),
      },
      { field: "assessedOn", headerName: "Assessed on", width: 120, valueFormatter: date, filter: "agDateColumnFilter" },
    ],
  },
  {
    headerName: "Risk assessment",
    children: [
      { field: "freeFloat", headerName: "Free float", width: 120, cellRenderer: (p: ICellRendererParams<CollateralRow>) => pill(p.value) },
      { field: "publicInformation", headerName: "Public info", width: 120, cellRenderer: (p: ICellRendererParams<CollateralRow>) => pill(p.value) },
      { field: "marketRiskPct", headerName: "Market risk", width: 115, type: "num", valueFormatter: pct(2), headerTooltip: "MDD / 99%-VaR over 2× auction duration" },
      { field: "retainedReservePct", headerName: "Retained reserve", width: 135, type: "num", valueFormatter: pct(1) },
      { field: "targetRatePct", headerName: "Target premium", width: 130, type: "num", valueFormatter: pct(2), headerTooltip: "Proposed risk premium (target_interest_rate)" },
      { field: "totalCompensationPct", headerName: "Tail-risk comp.", width: 130, type: "num", valueFormatter: pct(2), headerTooltip: "Sum of tail-risk compensations", hide: true },
      { field: "liquidationPriceAssessed", headerName: "Liq. price (assessed)", width: 150, type: "num", valueFormatter: price, hide: true },
      { field: "auctionDurationHours", headerName: "Auction (h)", width: 110, type: "num", valueFormatter: num(0), hide: true },
      { field: "author", headerName: "Author", width: 150, hide: true },
    ],
  },
  {
    headerName: "On-chain (Ethereum)",
    children: [
      { field: "priceChf", headerName: "Price CHF", width: 120, type: "num", valueFormatter: price },
      { field: "priceUsd", headerName: "Price USD", width: 120, type: "num", valueFormatter: price, hide: true },
      {
        field: "change24hPct",
        headerName: "24h",
        width: 90,
        type: "num",
        valueFormatter: pct(1),
        cellClassRules: { "text-emerald-700": (p) => (p.value ?? 0) > 0, "text-red-700": (p) => (p.value ?? 0) < 0 },
        hide: true,
      },
      { field: "positionsActive", headerName: "Positions", width: 105, type: "num", valueFormatter: num(0), headerTooltip: "Active positions" },
      { field: "mintedZchf", headerName: "Minted ZCHF", width: 125, type: "num", valueFormatter: compact },
      { field: "collateralValueChf", headerName: "Collateral CHF", width: 130, type: "num", valueFormatter: compact },
      { field: "collateralAmount", headerName: "Collateral (units)", width: 140, type: "num", valueFormatter: (p: Num) => (p.value == null ? "–" : formatNumber(p.value, p.value < 10 ? 4 : 2)), hide: true },
      { field: "utilizationPct", headerName: "Utilisation", width: 110, type: "num", valueFormatter: pct(1), headerTooltip: "Minted ÷ collateral value" },
      { field: "riskPremiumAvgPct", headerName: "Risk premium", width: 120, type: "num", valueFormatter: pct(2), headerTooltip: "Minted-weighted average risk premium of active positions" },
      { field: "annualInterestAvgPct", headerName: "Total rate", width: 110, type: "num", valueFormatter: pct(2), headerTooltip: "Minted-weighted average annual borrowing rate", hide: true },
      { field: "reserveContributionAvgPct", headerName: "Reserve", width: 105, type: "num", valueFormatter: pct(1), headerTooltip: "Average reserve contribution", hide: true },
      { field: "liquidationPriceMin", headerName: "Liq. price min", width: 125, type: "num", valueFormatter: price, hide: true },
      { field: "liquidationPriceMax", headerName: "Liq. price max", width: 125, type: "num", valueFormatter: price, hide: true },
      { field: "availableForMintingZchf", headerName: "Mintable ZCHF", width: 130, type: "num", valueFormatter: compact, hide: true },
      { field: "activeChallenges", headerName: "Challenges", width: 110, type: "num", valueFormatter: num(0), headerTooltip: "Active challenges" },
      { field: "nextExpiry", headerName: "Next expiry", width: 120, valueFormatter: date, hide: true },
    ],
  },
];

function leafColumns(defs: typeof columnDefs): ColDef<CollateralRow>[] {
  return defs.flatMap((d) => ("children" in d ? (d.children as ColDef<CollateralRow>[]) : [d]));
}

interface Chips {
  status: string; // all | published | draft | deprecated | none
  liveOnly: boolean;
  classification: string; // all | strong | sufficient | insufficient
}

function mount() {
  const el = document.getElementById("collateral-grid");
  const dataEl = document.getElementById("grid-data");
  if (!el || !dataEl) return;

  let rows: CollateralRow[] = [];
  try {
    rows = JSON.parse(dataEl.textContent ?? "[]");
  } catch {
    return;
  }

  const chips: Chips = { status: "all", liveOnly: false, classification: "all" };
  const STORAGE_KEY = "fc-collaterals-grid-columns-v1";

  const options: GridOptions<CollateralRow> = {
    theme,
    rowData: rows,
    columnDefs,
    columnTypes: { num: { cellClass: "fc-num", filter: "agNumberColumnFilter", headerClass: "ag-right-aligned-header" } },
    defaultColDef: { sortable: true, resizable: true, filter: true, minWidth: 80, suppressHeaderMenuButton: false },
    domLayout: "autoHeight",
    animateRows: false,
    suppressCellFocus: true,
    enableCellTextSelection: true,
    tooltipShowDelay: 300,
    getRowId: (p) => p.data.slug,
    onRowClicked: (e) => {
      const target = e.event?.target as HTMLElement | null;
      if (target?.closest("a")) return; // let the link handle it
      if (e.data) window.location.href = e.data.url;
    },
    rowClass: "cursor-pointer",
    isExternalFilterPresent: () => chips.status !== "all" || chips.liveOnly || chips.classification !== "all",
    doesExternalFilterPass: (node) => {
      const d = node.data;
      if (!d) return false;
      if (chips.status !== "all" && d.status !== chips.status) return false;
      if (chips.liveOnly && !(d.positionsActive && d.positionsActive > 0)) return false;
      if (chips.classification !== "all" && (d.freeFloat ?? "").toLowerCase() !== chips.classification) return false;
      return true;
    },
    onColumnVisible: (e) => persistColumns(e.api),
    onColumnMoved: (e) => persistColumns(e.api),
    onGridReady: (e) => restoreColumns(e.api),
  };

  const api = createGrid(el, options);

  // Hide the SSR fallback table now that the grid owns the data.
  document.querySelector<HTMLElement>("[data-grid-fallback]")?.setAttribute("hidden", "");
  el.removeAttribute("hidden");

  // Toolbar ---------------------------------------------------------------
  const search = document.getElementById("grid-search") as HTMLInputElement | null;
  search?.addEventListener("input", () => api.setGridOption("quickFilterText", search.value));

  document.querySelectorAll<HTMLButtonElement>("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [group, value] = (btn.dataset.chip ?? "").split(":");
      if (group === "status") chips.status = value ?? "all";
      if (group === "class") chips.classification = value ?? "all";
      if (group === "live") chips.liveOnly = !chips.liveOnly;
      syncChips();
      api.onFilterChanged();
      updateCount();
    });
  });

  document.getElementById("grid-reset")?.addEventListener("click", () => {
    chips.status = "all";
    chips.liveOnly = false;
    chips.classification = "all";
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

  // Column visibility menu
  const menu = document.getElementById("grid-columns-menu");
  if (menu) {
    for (const col of leafColumns(columnDefs)) {
      const id = col.field as string;
      const label = document.createElement("label");
      label.className = "flex items-center gap-2 ty-small px-3 py-1.5 hover:bg-[var(--color-gray-10)] cursor-pointer whitespace-nowrap";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "accent-[var(--color-brand-swiss)]";
      cb.checked = !col.hide;
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
  updateCount();

  function syncChips() {
    document.querySelectorAll<HTMLButtonElement>("[data-chip]").forEach((btn) => {
      const [group, value] = (btn.dataset.chip ?? "").split(":");
      const active =
        (group === "status" && chips.status === value) ||
        (group === "class" && chips.classification === value) ||
        (group === "live" && chips.liveOnly);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function updateCount() {
    const el = document.getElementById("grid-count");
    if (el) el.textContent = `${api.getDisplayedRowCount()} of ${rows.length}`;
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
      const state = JSON.parse(raw) as { colId: string; hide: boolean }[];
      gridApi.applyColumnState({ state });
    } catch {
      /* ignore */
    }
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
