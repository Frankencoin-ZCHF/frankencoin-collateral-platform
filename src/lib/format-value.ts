/**
 * Declarative value formatting for content blocks (`format:` in api/table/chart specs).
 *   number | percent | currency:CHF | currency:USD | compact | text | date | auto
 */

import { formatCompact, formatDate, formatDateTime, formatNumber, formatPercent, formatPrice } from "./numbers";

export type ValueFormat = "number" | "percent" | "currency:CHF" | "currency:USD" | "compact" | "text" | "date" | "datetime" | "auto" | `number:${number}` | `percent:${number}`;

export const VALUE_FORMATS = ["auto", "number", "number:0", "number:4", "percent", "percent:1", "currency:CHF", "currency:USD", "compact", "text", "date", "datetime"] as const;

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,%\s']/g, ""));
    return Number.isFinite(n) && v.trim() !== "" ? n : null;
  }
  return null;
}

export function formatValue(v: unknown, format: string = "auto"): string {
  if (v === null || v === undefined || v === "") return "–";
  const [kind, arg] = format.split(":");
  const n = toNumber(v);
  switch (kind) {
    case "number":
      return n === null ? String(v) : formatNumber(n, arg !== undefined ? Number(arg) : Math.abs(n) < 1 ? 4 : 2);
    case "percent":
      return n === null ? String(v) : formatPercent(n, arg !== undefined ? Number(arg) : 2);
    case "currency":
      return n === null ? String(v) : `${Math.abs(n) < 1 ? formatPrice(n) : formatNumber(n, 2)} ${arg ?? ""}`.trim();
    case "compact":
      return n === null ? String(v) : formatCompact(n);
    case "date":
      return formatDate(typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v).toISOString() : String(v));
    case "datetime":
      return formatDateTime(typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v).toISOString() : String(v));
    case "text":
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    default: {
      if (typeof v === "boolean") return v ? "Yes" : "No";
      if (n !== null && typeof v === "number") return Math.abs(n) >= 1e6 ? formatCompact(n) : formatNumber(n, Number.isInteger(n) ? 0 : Math.abs(n) < 1 ? 4 : 2);
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    }
  }
}
