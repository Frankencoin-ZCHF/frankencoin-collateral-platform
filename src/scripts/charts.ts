/**
 * ECharts island. Any element with `data-chart="<kind>"` and a JSON payload in
 * `data-series` is turned into a chart. Kinds: bar | donut | line | hbar.
 * Kept generic so content blocks (`type: chart`) reuse the same runtime.
 */

import { init, use } from "echarts/core";
import type { EChartsOption } from "echarts";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent, DataZoomComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);

const PALETTE = ["#092f62", "#0f80f0", "#5d647b", "#8b92a8", "#065dc1", "#b7bfd1", "#272b38", "#94a2b8", "#1f2a3d", "#ced1da", "#4f566e", "#d9dbe9"];
const FONT = "Avenir, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial";

export interface SeriesPayload {
  labels: string[];
  values: number[];
  /** Optional additional series (line/bar). */
  series?: { name: string; values: number[] }[];
  unit?: string;
  name?: string;
  /** Optional per-label link targets (same order as labels); clicking a data point navigates there. */
  links?: (string | null)[];
}

function fmt(v: number, unit?: string): string {
  const abs = Math.abs(v);
  const s = abs >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : abs >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : abs < 1 && abs > 0 ? v.toFixed(4) : v.toFixed(abs >= 100 ? 0 : 2);
  return unit ? `${s} ${unit}` : s;
}

function build(kind: string, d: SeriesPayload): EChartsOption {
  const base: EChartsOption = { color: PALETTE, textStyle: { fontFamily: FONT }, animationDuration: 400 };
  if (kind === "donut") {
    return {
      ...base,
      tooltip: { trigger: "item", valueFormatter: (v: unknown) => fmt(Number(v), d.unit) },
      legend: { bottom: 0, type: "scroll", textStyle: { fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: ["45%", "72%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          label: { show: false },
          emphasis: { label: { show: true, fontWeight: "bold", formatter: "{b}\n{d}%" } },
          data: d.labels.map((name, i) => ({ name, value: d.values[i] ?? 0 })),
        },
      ],
    };
  }
  const horizontal = kind === "hbar";
  const series = d.series?.length ? d.series : [{ name: d.name ?? "", values: d.values }];
  return {
    ...base,
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => fmt(Number(v), d.unit) },
    legend: series.length > 1 ? { top: 0, textStyle: { fontSize: 11 } } : undefined,
    grid: { left: horizontal ? 90 : 48, right: 16, top: series.length > 1 ? 32 : 12, bottom: horizontal ? 24 : 56, containLabel: false },
    [horizontal ? "yAxis" : "xAxis"]: {
      type: "category",
      data: d.labels,
      inverse: horizontal,
      axisLabel: { fontSize: 11, rotate: horizontal ? 0 : 35, color: "#5d647b" },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#dfe0e6" } },
    },
    [horizontal ? "xAxis" : "yAxis"]: {
      type: "value",
      axisLabel: { fontSize: 11, color: "#5d647b", formatter: (v: number) => fmt(v) },
      splitLine: { lineStyle: { color: "#eeeef2" } },
    },
    dataZoom: kind === "line" && d.labels.length > 60 ? [{ type: "inside" }] : undefined,
    series: series.map((s) => ({
      name: s.name,
      type: kind === "line" ? "line" : "bar",
      data: s.values,
      smooth: kind === "line",
      showSymbol: false,
      areaStyle: kind === "line" ? { opacity: 0.08 } : undefined,
      barMaxWidth: 36,
      itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    })),
  } as EChartsOption;
}

export function mountCharts(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-chart]").forEach((el) => {
    if (el.dataset.mounted) return;
    let payload: SeriesPayload;
    try {
      payload = JSON.parse(el.dataset.series ?? "{}");
    } catch {
      return;
    }
    if (!payload.labels?.length) return;
    el.dataset.mounted = "1";
    const chart = init(el, undefined, { renderer: "canvas" });
    chart.setOption(build(el.dataset.chart ?? "bar", payload));
    if (payload.links?.some(Boolean)) {
      chart.on("click", (params) => {
        const url = payload.links?.[params.dataIndex];
        if (url) window.location.href = url;
      });
      chart.on("mouseover", (params) => {
        chart.getZr().setCursorStyle(payload.links?.[params.dataIndex] ? "pointer" : "default");
      });
    }
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountCharts());
else mountCharts();
