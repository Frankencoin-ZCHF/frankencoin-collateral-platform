/**
 * Attention items derived from the joined records, in two queues:
 *
 *   live   — things that are a risk or an integrity problem *now*: active challenges, debt
 *            close to liquidation, stale/degraded price data, protocol-source divergence,
 *            contract-address mismatch, live collateral with no assessment at all, and
 *            deviations from a PUBLISHED (approved) assessment.
 *   review — assessment-review items: differences against a DRAFT proposal, and a missing
 *            governance reference. Useful, but not live risk and not a breach of anything.
 *
 * Pure — the dashboard, the table and /attention render this; nothing here fetches.
 */

import { formatCompact, formatPercent } from "@/lib/numbers";
import type { CollateralLifecycle, CollateralRecord } from "@/types";
import { compareParameters } from "./comparison";

export type Severity = "high" | "medium" | "low";
export type Queue = "live" | "review";

export interface AttentionItem {
  queue: Queue;
  severity: Severity;
  /** Short label, e.g. "Risk premium differs from draft proposal". */
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
  "no-assessment": "Live collateral without any assessment",
  "stale-price": "Stale price feed",
  "assessment-unavailable": "Assessment could not be loaded",
};

/** All items for one record, both queues. */
export function itemsFor(r: CollateralRecord): AttentionItem[] {
  const items: AttentionItem[] = [];

  // Integrity issues are live-queue by definition (they are computed only for defined defects).
  for (const i of r.issues) {
    if (i.severity === "low") continue;
    items.push({ queue: "live", severity: i.severity, title: ISSUE_TITLE[i.code] ?? i.code, detail: i.message, assessed: null, live: null });
  }

  const s = r.live?.safety;
  if (s && s.debtWithin.pct10 > 0) {
    items.push({
      queue: "live",
      severity: s.debtWithin.pct5 > 0 ? "high" : "medium",
      title: "Debt close to liquidation",
      detail: `${formatCompact(s.debtWithin.pct10)} ZCHF sits within 10 % of its liquidation price at the current oracle price.`,
      assessed: null,
      live: `min buffer ${formatPercent(s.minLiquidationBufferPct, 1)}`,
    });
  }

  if (r.live && r.live.challenges.active > 0) {
    const n = r.live.challenges.active;
    items.push({ queue: "live", severity: "high", title: `${n} challenge${n === 1 ? "" : "s"} in progress`, detail: "A liquidation auction is running against at least one position.", assessed: null, live: null });
  }

  // Parameter comparison: against a published assessment it is live risk; against a draft it is review material.
  if (r.assessment && r.live && r.lifecycle === "live") {
    const published = r.assessment.status === "published";
    for (const row of compareParameters(r.assessment.data.params, r.live, r.assessment.status)) {
      if (row.verdict !== "differs") continue;
      items.push({
        queue: published ? "live" : "review",
        severity: published ? "high" : "low",
        title: published ? `${row.label} deviates from the published assessment` : `${row.label} differs from draft proposal`,
        detail: row.explanation,
        assessed: row.assessed,
        live: row.onchain.replace(/\s*\(positions range[^)]*\)$/, ""),
      });
    }
  }

  if (r.assessment && !r.assessment.data.discussionUrl) {
    items.push({ queue: "review", severity: "low", title: "No governance reference linked", detail: "The assessment does not link a discussion or decision; add `links.discussion` to the assessment to pin it.", assessed: null, live: null });
  }

  return items.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

export function attentionGroups(records: CollateralRecord[], queue?: Queue): AttentionGroup[] {
  const groups: AttentionGroup[] = [];
  for (const r of records) {
    const items = itemsFor(r).filter((i) => !queue || i.queue === queue);
    if (items.length === 0) continue;
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

/** Flat view (tests, JSON API). */
export function attentionItems(records: CollateralRecord[], queue?: Queue): (AttentionItem & { slug: string; ticker: string })[] {
  return attentionGroups(records, queue).flatMap((g) => g.items.map((i) => ({ ...i, slug: g.slug, ticker: g.ticker })));
}

export interface AttentionSummary {
  live: { items: number; collaterals: number; high: number; challenges: number; debtWithin10Pct: number; integrity: number };
  review: { items: number; collaterals: number; parameterDifferences: number; draftAssessments: number };
}

export function summarizeAttention(records: CollateralRecord[]): AttentionSummary {
  const live = attentionGroups(records, "live");
  const review = attentionGroups(records, "review");
  const liveItems = live.flatMap((g) => g.items);
  const reviewItems = review.flatMap((g) => g.items);
  return {
    live: {
      items: liveItems.length,
      collaterals: live.length,
      high: liveItems.filter((i) => i.severity === "high").length,
      challenges: records.reduce((n, r) => n + (r.live?.challenges.active ?? 0), 0),
      debtWithin10Pct: Math.round(records.reduce((n, r) => n + (r.live?.safety?.debtWithin.pct10 ?? 0), 0)),
      integrity: records.reduce((n, r) => n + r.issues.filter((i) => i.severity !== "low").length, 0),
    },
    review: {
      items: reviewItems.length,
      collaterals: review.length,
      parameterDifferences: reviewItems.filter((i) => /differs from draft proposal$/.test(i.title)).length,
      draftAssessments: records.filter((r) => r.assessment?.status === "draft").length,
    },
  };
}
