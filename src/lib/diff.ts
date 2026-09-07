/**
 * Version diffing: a structured diff of the frontmatter (flattened dotted keys) and a
 * unified text patch of the markdown body (rendered by diff2html in the compare page).
 */

import { createTwoFilesPatch } from "diff";

export interface FieldChange {
  key: string;
  before: unknown;
  after: unknown;
  kind: "added" | "removed" | "changed";
  /** Top-level group (e.g. risk_parameters) for highlighting. */
  group: string;
}

export function flatten(obj: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || typeof obj !== "object") {
    out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) out[prefix] = [];
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) out[prefix] = {};
  for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function structuredDiff(before: unknown, after: unknown): FieldChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const changes: FieldChange[] = [];
  for (const key of keys) {
    const inA = key in a;
    const inB = key in b;
    if (inA && inB && same(a[key], b[key])) continue;
    changes.push({
      key,
      before: inA ? a[key] : undefined,
      after: inB ? b[key] : undefined,
      kind: !inA ? "added" : !inB ? "removed" : "changed",
      group: key.split(/[.[]/)[0] ?? key,
    });
  }
  return changes;
}

export function textPatch(fromName: string, toName: string, before: string, after: string): string {
  return createTwoFilesPatch(fromName, toName, before, after, "", "", { context: 3 });
}

export function formatDiffValue(v: unknown): string {
  if (v === undefined) return "";
  if (v === null) return "null";
  if (typeof v === "string") return v === "" ? '""' : v;
  return JSON.stringify(v);
}
