import type { CollateralRow } from "@/lib/rows";
import { collateralView, matchesFilters, collateralSort, sortRows } from "@/lib/collateral-filters";
const data = document.getElementById("grid-data");
if (data) {
  const rows = JSON.parse(data.textContent ?? "[]") as CollateralRow[];
  const query = document.getElementById("overview-search") as HTMLInputElement | null;
  const group = document.getElementById("overview-group") as HTMLSelectElement | null;
  const sort = document.getElementById("overview-sort") as HTMLSelectElement | null;
  let view = collateralView(new URL(location.href).searchParams.get("view"));
  function filter(updateUrl = true) {
    let count = 0;
    const tbody = document.querySelector("[data-overview-table] tbody");
    const elements = new Map(Array.from(document.querySelectorAll<HTMLElement>("[data-collateral-row]")).map(el => [el.dataset.collateralRow, el]));
    for (const row of sortRows(rows, collateralSort(sort?.value ?? null))) { const el = elements.get(row.slug); if (el) tbody?.append(el); }
    document.querySelectorAll<HTMLAnchorElement>("[data-overview-category]").forEach(el => { if (el.dataset.overviewCategory === group?.value) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current"); });
    const visible = new Set(rows.filter((r) => matchesFilters(r, view, query?.value, group?.value)).map((r) => r.slug));
    document.querySelectorAll<HTMLElement>("[data-collateral-row]").forEach((el) => {
      el.hidden = !visible.has(el.dataset.collateralRow!);
      if (!el.hidden) count++;
    });
    document.querySelectorAll<HTMLAnchorElement>("[data-overview-view]").forEach((el) => {
      if (el.dataset.overviewView === view) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    const viewInput = document.querySelector<HTMLInputElement>('#overview-form input[name="view"]');
    if (viewInput) viewInput.value = view;
    const output = document.getElementById("overview-count");
    if (output) output.textContent = `${count} asset${count === 1 ? "" : "s"}`;
    const empty = document.getElementById("overview-empty");
    if (empty) empty.hidden = count !== 0;
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set("view", view);
      if (sort?.value && sort.value !== "exposure") url.searchParams.set("sort", sort.value); else url.searchParams.delete("sort");
      if (query?.value) url.searchParams.set("q", query.value);
      else url.searchParams.delete("q");
      if (group?.value !== "all" && group?.value) url.searchParams.set("group", group.value);
      else url.searchParams.delete("group");
      history.replaceState(null, "", url);
    }
  }
  document.querySelectorAll<HTMLAnchorElement>("[data-overview-view]").forEach((a) =>
    a.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      view = collateralView(a.dataset.overviewView ?? null);
      filter();
    }),
  );
  document.querySelectorAll<HTMLAnchorElement>("[data-overview-category]").forEach(a => a.addEventListener("click", e => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); view = "current";
    if (group) group.value = a.dataset.overviewCategory!;
    if (query) query.value = "";
    filter(); document.getElementById("collaterals")?.scrollIntoView({ block: "start" });
  }));
  sort?.addEventListener("change", () => filter());
  query?.addEventListener("input", () => filter());
  group?.addEventListener("change", () => filter());
  document.getElementById("overview-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    filter();
  });
  window.addEventListener("popstate", () => {
    const params = new URL(location.href).searchParams;
    view = collateralView(params.get("view"));
    if (sort) sort.value = collateralSort(params.get("sort"));
    if (query) query.value = params.get("q") ?? "";
    if (group) {
      const requested = params.get("group");
      group.value = Array.from(group.options).some((o) => o.value === requested) ? requested! : "all";
    }
    filter(false);
  });
  filter(false);
}
