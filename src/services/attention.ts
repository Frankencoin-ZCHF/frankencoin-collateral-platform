/** One set of findings, separated into financial monitoring, data quality and assessment review. */
import { formatCompact, formatPercent } from "@/lib/numbers";
import type { CollateralLifecycle, CollateralRecord } from "@/types";
import { compareParameters } from "./comparison";
import { hasCurrentExposure, monitoringComplete, nearDebtDescription, priceQuality } from "./monitoring";

export type Severity = "high" | "medium" | "low";
/** `live` and `review` keep existing deep links/API names; data reliability has its own queue. */
export type Queue = "live" | "data" | "review";
export interface AttentionItem {
  queue: Queue;
  severity: Severity;
  title: string;
  detail: string;
  assessed: string | null;
  live: string | null;
  affectedDebt?: number;
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
  "feed-divergence": "Position data incomplete",
  "no-assessment": "Assessment missing",
  "stale-price": "Price data outdated",
  "price-unavailable": "Reference price unavailable",
  "price-time-invalid": "Price timestamp unverified",
  "protocol-unavailable": "Protocol monitoring incomplete",
  "assessment-unavailable": "Assessment could not be loaded",
  "bridge-peg": "Bridge stablecoin off its 1:1 peg",
  "bridge-expired": "Bridge minting has ended",
};

export function itemsFor(r: CollateralRecord): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const issue of r.issues) {
    const queue: Queue =
      issue.code === "bridge-peg" ? "live" : ["no-assessment", "bridge-expired"].includes(issue.code) ? "review" : "data";
    items.push({
      queue,
      severity: issue.severity,
      title: ISSUE_TITLE[issue.code] ?? issue.code,
      detail: issue.message,
      assessed: null,
      live: null,
    });
  }
  const l = r.live;
  // Re-evaluate source age when a cached record is presented, so a stale snapshot cannot say current.
  if (l && hasCurrentExposure(r)) {
    const quality = priceQuality(l);
    if (
      quality.state !== "current" &&
      !items.some((i) => /Price data outdated|Reference price unavailable|Price timestamp unverified/.test(i.title))
    )
      items.push({ queue: "data", severity: "medium", title: quality.label, detail: quality.detail, assessed: null, live: null });
    if (
      !l.bridge &&
      (!l.safety || l.safety.positionsConsidered < l.positions.list.filter((p) => p.status === "active" && p.minted > 0).length) &&
      !items.some((i) => i.title === "Position data incomplete")
    )
      items.push({
        queue: "data",
        severity: "medium",
        title: "Position monitoring unavailable",
        detail: "Outstanding debt cannot be evaluated against complete, priced positions.",
        assessed: null,
        live: null,
      });
  }
  if (l?.safety && l.safety.debtWithin.pct10 > 0) {
    items.push({
      queue: "live",
      severity: l.safety.debtWithin.pct5 > 0 ? "high" : "medium",
      title: "Debt near a liquidation price",
      detail: nearDebtDescription(l),
      assessed: null,
      live: `${formatPercent(l.safety.minLiquidationBufferPct, 1)} nearest price cushion`,
      affectedDebt: l.safety.debtWithin.pct10,
    });
  }
  if (l && l.challenges.active > 0) {
    items.push({
      queue: "live",
      severity: "high",
      title: `${l.challenges.active} active challenge${l.challenges.active === 1 ? "" : "s"}`,
      detail: "A challenge is in progress. Inspect the auction state and affected positions.",
      assessed: null,
      live: null,
    });
  }
  if (r.assessment && l && r.lifecycle === "live" && !l.bridge) {
    for (const row of compareParameters(r.assessment.data.params, l, r.assessment.status)) {
      if (!["differs", "varies", "within-tolerance", "within-range"].includes(row.verdict)) continue;
      items.push({
        queue: "review",
        severity: row.verdict === "differs" && r.assessment.status === "published" ? "medium" : "low",
        title: `${row.label} differs from ${r.assessment.status === "draft" ? "draft proposal" : "assessment"}`,
        detail: row.explanation,
        assessed: row.assessed,
        live: row.onchain,
        affectedDebt: row.differentDebt,
      });
    }
  }
  const b = l?.bridge;
  if (b && !b.expired && b.daysLeft !== null && b.daysLeft <= 60) {
    items.push({
      queue: "review",
      severity: "low",
      title: `Bridge expires in ${b.daysLeft} days`,
      detail: `Minting ends on ${b.horizon?.slice(0, 10)}. Redemption remains available under the contract terms. Continuing minting requires a replacement bridge.`,
      assessed: null,
      live: `${formatCompact(b.mintedZchf)} ZCHF outstanding`,
    });
  }
  if (r.assessment && !r.assessment.data.discussionUrl) {
    items.push({
      queue: "review",
      severity: "low",
      title: "No governance reference linked",
      detail:
        "No discussion or governance decision is linked to this assessment. Publication alone does not establish governance approval.",
      assessed: null,
      live: null,
    });
  }
  return items.sort((a, b) => RANK[a.severity] - RANK[b.severity] || (b.affectedDebt ?? 0) - (a.affectedDebt ?? 0));
}

export function monitoringStatus(r: CollateralRecord) {
  const items = itemsFor(r);
  const financial = items.filter((i) => i.queue === "live");
  const data = items.filter((i) => i.queue === "data");
  if (financial.some((i) => i.severity === "high"))
    return { state: "risk" as const, label: financial[0]!.title, detail: financial[0]!.detail };
  if (data.length) return { state: "unknown" as const, label: data[0]!.title, detail: data[0]!.detail };
  if (financial.length) return { state: "watch" as const, label: financial[0]!.title, detail: financial[0]!.detail };
  if (!r.live)
    return {
      state: "inactive" as const,
      label: "No protocol positions",
      detail: "An assessment does not establish current on-chain exposure.",
    };
  if (!hasCurrentExposure(r))
    return {
      state: "inactive" as const,
      label: "No outstanding ZCHF",
      detail: "This asset has no outstanding issuance in the available snapshot.",
    };
  return {
    state: "ok" as const,
    label: "No financial alerts observed",
    detail: "No active challenges or configured monitoring alerts were detected. Asset and issuer risks still apply.",
  };
}

export function attentionGroups(records: CollateralRecord[], queue?: Queue): AttentionGroup[] {
  return records
    .flatMap((r) => {
      const items = itemsFor(r).filter((i) => !queue || i.queue === queue);
      return items.length
        ? [
            {
              slug: r.slug,
              ticker: r.ticker,
              name: r.name,
              lifecycle: r.lifecycle,
              assessmentStatus: r.assessment?.status ?? "none",
              severity: items[0]!.severity,
              items,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        RANK[a.severity] - RANK[b.severity] ||
        Math.max(0, ...b.items.map((i) => i.affectedDebt ?? 0)) - Math.max(0, ...a.items.map((i) => i.affectedDebt ?? 0)) ||
        a.ticker.localeCompare(b.ticker),
    );
}
export function attentionItems(records: CollateralRecord[], queue?: Queue) {
  return attentionGroups(records, queue).flatMap((g) => g.items.map((i) => ({ ...i, slug: g.slug, ticker: g.ticker })));
}
export function summarizeAttention(records: CollateralRecord[], unattributedActiveChallenges = 0) {
  const live = attentionGroups(records, "live"),
    data = attentionGroups(records, "data"),
    review = attentionGroups(records, "review");
  const liveItems = live.flatMap((g) => g.items),
    reviewItems = review.flatMap((g) => g.items);
  return {
    live: {
      items: liveItems.length + unattributedActiveChallenges,
      collaterals: live.length,
      high: liveItems.filter((i) => i.severity === "high").length + unattributedActiveChallenges,
      challenges: records.reduce((n, r) => n + (r.live?.challenges.active ?? 0), unattributedActiveChallenges),
      debtWithin10Pct: records.filter((r) => monitoringComplete(r)).reduce((n, r) => n + (r.live?.safety?.debtWithin.pct10 ?? 0), 0),
      integrity: data.reduce((n, g) => n + g.items.length, 0),
    },
    data: { items: data.reduce((n, g) => n + g.items.length, 0), collaterals: data.length },
    review: {
      items: reviewItems.length,
      collaterals: review.length,
      parameterDifferences: reviewItems.filter((i) => /differs from (draft proposal|assessment)$/.test(i.title)).length,
      draftAssessments: records.filter((r) => r.assessment?.status === "draft").length,
    },
  };
}
export type AttentionSummary = ReturnType<typeof summarizeAttention>;
