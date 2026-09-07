import { z } from "zod";
import type { ContentBlockType } from "@/blocks/types";
import { formatValue, VALUE_FORMATS } from "@/lib/format-value";
import { getPath, safeFetchJson } from "@/upstream/generic";
import Block from "./Block.astro";

const formatSchema = z.string().regex(/^(auto|number(:\d+)?|percent(:\d+)?|currency:[A-Z]{3}|compact|text|date|datetime)$/, `one of ${VALUE_FORMATS.join(", ")}`);

const item = z.object({
  label: z.string().min(1).max(80),
  /** Dot-path into the JSON response, e.g. `data.apr` or `items[0].value`. */
  path: z.string().max(200).optional(),
  format: formatSchema.default("auto"),
  unit: z.string().max(20).optional(),
});

export const schema = z
  .object({
    type: z.literal("api"),
    title: z.string().max(120).optional(),
    url: z.url(),
    /** Single value: */
    path: z.string().max(200).optional(),
    label: z.string().max(80).optional(),
    format: formatSchema.default("auto"),
    unit: z.string().max(20).optional(),
    /** …or several values from the same response: */
    items: z.array(item).max(12).optional(),
    source: z.string().max(80).optional(),
    link: z.url().optional(),
  })
  .refine((s) => s.items?.length || s.label || s.path !== undefined, { message: "Provide `path`+`label` or `items`" });

export type ApiSpec = z.infer<typeof schema>;

export interface ApiData {
  title: string;
  values: { label: string; value: string; raw: unknown }[];
  source: string;
  link: string | null;
}

const api: ContentBlockType<ApiSpec, ApiData> = {
  type: "api",
  description: "One or more values read from any public JSON endpoint (https only) via dot-paths.",
  schema,
  load: async (spec) => {
    const json = await safeFetchJson(spec.url);
    const items = spec.items?.length ? spec.items : [{ label: spec.label ?? spec.title ?? "Value", path: spec.path, format: spec.format, unit: spec.unit }];
    const host = new URL(spec.url).hostname;
    return {
      title: spec.title ?? spec.label ?? host,
      values: items.map((it) => {
        const raw = getPath(json, it.path);
        const value = formatValue(raw, it.format);
        return { label: it.label, value: it.unit && value !== "–" ? `${value} ${it.unit}` : value, raw };
      }),
      source: spec.source ?? host,
      link: spec.link ?? null,
    };
  },
  Component: Block,
};

export default api;
