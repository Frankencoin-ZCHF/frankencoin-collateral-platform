import { z } from "zod";
import type { ContentBlockType } from "@/blocks/types";
import { getPath, safeFetchJson } from "@/upstream/generic";
import Block from "./Block.astro";

export const schema = z
  .object({
    type: z.literal("chart"),
    title: z.string().max(120).optional(),
    kind: z.enum(["line", "bar", "hbar", "donut"]).default("line"),
    /** Inline data points… */
    data: z.array(z.record(z.string(), z.unknown())).max(2000).optional(),
    /** …or fetched: `url` + optional dot-`path` to the array of points. */
    url: z.url().optional(),
    path: z.string().max(200).optional(),
    /** Field holding the category / x value. Use `date` for unix seconds/ms or ISO strings. */
    x: z.string().min(1).max(100),
    /** Field(s) holding the values. Several → several series. */
    y: z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).min(1).max(6)]),
    unit: z.string().max(20).optional(),
    /** Keep only the last N points (after sorting by x). */
    limit: z.number().int().min(2).max(2000).default(365),
    source: z.string().max(80).optional(),
  })
  .refine((s) => s.data?.length || s.url, { message: "Provide `data` or `url`" });

export type ChartSpec = z.infer<typeof schema>;

export interface ChartData {
  title: string | null;
  kind: ChartSpec["kind"];
  payload: { labels: string[]; values: number[]; series?: { name: string; values: number[] }[]; unit?: string };
  source: string | null;
}

function toLabel(v: unknown): string {
  if (typeof v === "number") {
    // unix seconds or ms
    const d = new Date(v < 1e12 ? v * 1000 : v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return String(v ?? "");
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const chart: ContentBlockType<ChartSpec, ChartData> = {
  type: "chart",
  description: "Line/bar/donut chart from inline `data` or a JSON endpoint; `x` and `y` name the fields.",
  schema,
  load: async (spec) => {
    let points: unknown[] = spec.data ?? [];
    if (spec.url) {
      const json = await safeFetchJson(spec.url);
      const arr = getPath(json, spec.path);
      points = Array.isArray(arr) ? arr : [];
    }
    if (points.length === 0) return null;
    const ys = Array.isArray(spec.y) ? spec.y : [spec.y];
    const rows = points
      .map((p) => ({ x: getPath(p, spec.x), ys: ys.map((y) => toNum(getPath(p, y))) }))
      .filter((r) => r.x !== undefined && r.x !== null);
    if (spec.kind === "line") rows.sort((a, b) => (toLabel(a.x) < toLabel(b.x) ? -1 : 1));
    const sliced = rows.slice(-spec.limit);
    return {
      title: spec.title ?? null,
      kind: spec.kind,
      payload: {
        labels: sliced.map((r) => toLabel(r.x)),
        values: sliced.map((r) => r.ys[0] ?? 0),
        series: ys.length > 1 ? ys.map((name, i) => ({ name, values: sliced.map((r) => r.ys[i] ?? 0) })) : undefined,
        unit: spec.unit,
      },
      source: spec.source ?? (spec.url ? new URL(spec.url).hostname : null),
    };
  },
  Component: Block,
};

export default chart;
