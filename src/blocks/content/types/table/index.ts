import { z } from "zod";
import type { ContentBlockType } from "@/blocks/types";
import { formatValue } from "@/lib/format-value";
import { getPath, safeFetchJson } from "@/upstream/generic";
import Block from "./Block.astro";

const column = z.object({
  key: z.string().min(1).max(100),
  label: z.string().max(80).optional(),
  format: z.string().max(30).default("auto"),
  align: z.enum(["left", "right"]).optional(),
});

export const schema = z
  .object({
    type: z.literal("table"),
    title: z.string().max(120).optional(),
    columns: z.array(column).min(1).max(12),
    /** Inline rows… */
    rows: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
    /** …or fetched: `url` + optional dot-`path` to the array. */
    url: z.url().optional(),
    path: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    source: z.string().max(80).optional(),
  })
  .refine((s) => s.rows?.length || s.url, { message: "Provide `rows` or `url`" });

export type TableSpec = z.infer<typeof schema>;

export interface TableData {
  title: string | null;
  columns: { key: string; label: string; align: "left" | "right" }[];
  rows: string[][];
  source: string | null;
}

const table: ContentBlockType<TableSpec, TableData> = {
  type: "table",
  description: "A small table from inline `rows` or from a JSON endpoint (`url` + `path` to an array).",
  schema,
  load: async (spec) => {
    let raw: unknown[] = spec.rows ?? [];
    if (spec.url) {
      const json = await safeFetchJson(spec.url);
      const arr = getPath(json, spec.path);
      raw = Array.isArray(arr) ? arr : [];
    }
    const rows = raw.slice(0, spec.limit).map((r) => spec.columns.map((c) => formatValue(getPath(r, c.key), c.format)));
    if (rows.length === 0) return null;
    return {
      title: spec.title ?? null,
      columns: spec.columns.map((c) => ({ key: c.key, label: c.label ?? c.key, align: c.align ?? (/number|percent|currency|compact/.test(c.format) ? "right" : "left") })),
      rows,
      source: spec.source ?? (spec.url ? new URL(spec.url).hostname : null),
    };
  },
  Component: Block,
};

export default table;
