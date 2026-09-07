/**
 * "Items requiring attention": deviations and risk events derived from the joined records,
 * grouped per collateral. Pure — the dashboard renders this; nothing here fetches.
 */

import { formatCompact, formatPercent } from "@/lib/numbers";
import type { CollateralLifecycle, CollateralRecord } from "@/types";
import { compareParameters } from "./comparison";

export type Severity = "high" | "medium" | "low";

export interface AttentionItem {
  severity: Severity;
  /** Short label, e.g. "Risk premium differs from assessment". */
  title: string;
  /** One sentence of context. */
  detail: string;
  assessed: string | null;
  live: string | null;
}

export interface AttentionGroup {
  slug: string;
  ticker: string;
  name: string;
  lifecycle: CollateralLifecycle;
  assessmentStatus: string;
  severity: Severity;
  items: AttentionItem[];
}

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const ISSUE_TITLE: Record<string, string> = {
  "address-mismatch": "Contract address mismatch",
  "feed-divergence": "Position feed disagrees with protocol aggregate",
  "future-date": "Assessment dated in the future",
  "live-without-published": "Live without a published assessment",
  "stale-price": "Stale price feed",
  "assessment-unavailable": "Assessment could not be loaded",
};

export function attentionGroups(records: CollateralRecord[]): AttentionGroup[] {
  const groups: AttentionGroup[] = [];
  for (const r of records) {
    const items: AttentionItem[] = [];

    for (const i of r.issues) {
      if (i.severity === "low") continue;
      items.push({ severity: i.severity, title: ISSUE_TITLE[i.code] ?? i.code, detail: i.message, assessed: null, live: null });
    }

    if (r.assessment && r.live && r.lifecycle === "live") {
      for (const row of compareParameters(r.assessment.data.params, r.live)) {
        if (row.verdict !== "differs") continue;
        items.push({
          severity: "medium",
          title: `${row.label} differs from assessment`,
          detail: row.explanation,
          assessed: row.assessed,
          live: row.onchain.replace(/\s*\(positions range[^)]*\)$/, ""), // the range is on the detail page
        });
      }
    }

    const s = r.live?.safety;
    if (s && s.debtWithin.pct10 > 0) {
      items.push({
        severity: s.debtWithin.pct5 > 0 ? "high" : "medium",
        title: "Debt close to liquidation",
        detail: `${formatCompact(s.debtWithin.pct10)} ZCHF sits within 10 % of its liquidation price at the current oracle price.`,
        assessed: null,
        live: `min buffer ${formatPercent(s.minLiquidationBufferPct, 1)}`,
      });
    }

    if (r.live && r.live.challenges.active > 0) {
      const n = r.live.challenges.active;
      items.push({ severity: "medium", title: `${n} challenge${n === 1 ? "" : "s"} in progress`, detail: "A liquidation auction is running against at least one position.", assessed: null, live: null });
    }

    if (items.length === 0) continue;
    items.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
    groups.push({
      slug: r.slug,
      ticker: r.ticker,
      name: r.name,
      lifecycle: r.lifecycle,
      assessmentStatus: r.assessment?.status ?? "none",
      severity: items[0]!.severity,
      items,
    });
  }
  return groups.sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.items.length - a.items.length || a.ticker.localeCompare(b.ticker));
}

/** Flat view (used by tests and the JSON API). */
export function attentionItems(records: CollateralRecord[]): (AttentionItem & { slug: string; ticker: string })[] {
  return attentionGroups(records).flatMap((g) => g.items.map((i) => ({ ...i, slug: g.slug, ticker: g.ticker })));
}
