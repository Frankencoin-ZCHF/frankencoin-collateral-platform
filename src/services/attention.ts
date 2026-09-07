/**
 * "Items requiring attention": deviations and risk events derived from the joined records.
 * Pure — the dashboard renders this list; nothing here fetches.
 */

import { formatCompact, formatPercent } from "@/lib/numbers";
import type { CollateralRecord } from "@/types";
import { compareParameters } from "./comparison";

export type Severity = "high" | "medium" | "low";

export interface AttentionItem {
  slug: string;
  ticker: string;
  lifecycle: string;
  assessmentStatus: string;
  kind: string;
  message: string;
  assessed: string | null;
  live: string | null;
  severity: Severity;
}

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function attentionItems(records: CollateralRecord[]): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const r of records) {
    const base = { slug: r.slug, ticker: r.ticker, lifecycle: r.lifecycle, assessmentStatus: r.assessment?.status ?? "none" };

    for (const i of r.issues) {
      if (i.severity === "low") continue;
      out.push({ ...base, kind: i.code.replace(/-/g, " "), message: i.message, assessed: null, live: null, severity: i.severity });
    }

    if (r.assessment && r.live && r.lifecycle === "live") {
      for (const row of compareParameters(r.assessment.data.params, r.live)) {
        if (row.verdict === "differs") {
          out.push({ ...base, kind: `parameter · ${row.label.toLowerCase()}`, message: row.explanation, assessed: row.assessed, live: row.onchain, severity: "medium" });
        }
      }
    }

    const s = r.live?.safety;
    if (s && s.debtWithin.pct10 > 0) {
      out.push({
        ...base,
        kind: "positions near liquidation",
        message: `${formatCompact(s.debtWithin.pct10)} ZCHF of debt sits within 10 % of liquidation (min buffer ${formatPercent(s.minLiquidationBufferPct, 1)}).`,
        assessed: null,
        live: formatPercent(s.minLiquidationBufferPct, 1),
        severity: s.debtWithin.pct5 > 0 ? "high" : "medium",
      });
    }

    if (r.live && r.live.challenges.active > 0) {
      out.push({ ...base, kind: "active challenge", message: `${r.live.challenges.active} challenge${r.live.challenges.active === 1 ? "" : "s"} in progress.`, assessed: null, live: String(r.live.challenges.active), severity: "medium" });
    }
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.ticker.localeCompare(b.ticker));
}
