/**
 * Flat row shape shared by the overview grid (client), the SSR fallback table and
 * /api/collaterals.json. Keep it JSON-serialisable and flat — AG Grid columns map 1:1.
 */

import type { CollateralLifecycle, CollateralRecord } from "@/types";
import { itemsFor } from "@/services/attention";

export interface CollateralRow {
  slug: string;
  url: string;
  ticker: string;
  name: string;
  address: string | null;
  kind: "assessed" | "live-only" | "both";
  lifecycle: CollateralLifecycle;
  /** 1:1 stablecoin bridge (no collateral buffer, no liquidation). */
  isBridge: boolean;
  bridgeHorizon: string | null;
  bridgeLimitUsedPct: number | null;
  status: "draft" | "published" | "deprecated" | "none";
  assessmentUnavailable: boolean;
  assessedOn: string | null;
  assessmentSha: string | null;
  author: string | null;
  freeFloat: string | null;
  publicInformation: string | null;
  marketRiskPct: number | null;
  retainedReservePct: number | null;
  targetRatePct: number | null;
  liquidationPriceAssessed: number | null;
  auctionDurationHours: number | null;
  totalCompensationPct: number | null;
  discussionUrl: string | null;
  priceChf: number | null;
  priceUsd: number | null;
  change24hPct: number | null;
  marketCapUsd: number | null;
  positionsOpen: number | null;
  positionsTotal: number | null;
  mintedZchf: number | null;
  totalLimitZchf: number | null;
  remainingLimitZchf: number | null;
  collateralAmount: number | null;
  collateralValueChf: number | null;
  utilizationPct: number | null;
  weightedCollateralRatioPct: number | null;
  minLiquidationBufferPct: number | null;
  debtWithin10Pct: number | null;
  riskPremiumAvgPct: number | null;
  riskPremiumMinPct: number | null;
  riskPremiumMaxPct: number | null;
  annualInterestAvgPct: number | null;
  reserveContributionAvgPct: number | null;
  liquidationPriceMin: number | null;
  liquidationPriceMax: number | null;
  challengePeriodHoursMin: number | null;
  activeChallenges: number | null;
  totalChallenges: number | null;
  nextExpiry: string | null;
  /** Live-risk queue items for this collateral (same list as /attention#live). */
  liveRiskCount: number;
  liveRiskHigh: number;
  liveRisk: string[];
  /** Assessment-review queue items (same list as /attention#review). */
  reviewCount: number;
  review: string[];
  /** Compact live-risk state for the grid: "ok" | "watch" | "risk". */
  liveRiskState: "ok" | "watch" | "risk";
  attentionUrl: string;
}

export function toRow(r: CollateralRecord): CollateralRow {
  const a = r.assessment?.data ?? null;
  const l = r.live;
  const items = itemsFor(r);
  const liveItems = items.filter((i) => i.queue === "live");
  const reviewItems = items.filter((i) => i.queue === "review");
  const liveHigh = liveItems.filter((i) => i.severity === "high").length;
  return {
    slug: r.slug,
    url: `/collateral/${r.slug}`,
    ticker: r.ticker,
    name: r.name,
    address: r.address,
    kind: r.kind,
    lifecycle: r.lifecycle,
    isBridge: Boolean(l?.bridge),
    bridgeHorizon: l?.bridge?.horizon ?? null,
    bridgeLimitUsedPct: l?.bridge?.limitUsedPct ?? null,
    status: r.assessment?.status ?? "none",
    assessmentUnavailable: Boolean(r.assessmentUnavailable),
    assessedOn: a?.assessmentDate ?? null,
    assessmentSha: r.assessment?.ref?.shortSha ?? null,
    author: a?.author ?? null,
    freeFloat: a?.scores.freeFloat ?? null,
    publicInformation: a?.scores.publicInformation ?? null,
    marketRiskPct: a?.scores.marketRiskPct ?? null,
    retainedReservePct: a?.params.retainedReservePct ?? null,
    targetRatePct: a?.params.targetInterestRatePct ?? null,
    liquidationPriceAssessed: a?.params.liquidationPrice ?? null,
    auctionDurationHours: a?.params.auctionDurationHours ?? null,
    totalCompensationPct: a?.totalCompensationPct ?? null,
    discussionUrl: a?.discussionUrl ?? null,
    priceChf: l?.price?.chf ?? null,
    priceUsd: l?.price?.usd ?? null,
    change24hPct: l?.market?.change24hPct ?? null,
    marketCapUsd: l?.market?.marketCapUsd ?? null,
    positionsOpen: l ? l.counts?.open ?? l.positions.active : null,
    positionsTotal: l ? l.counts?.total ?? l.positions.total : null,
    mintedZchf: l ? l.totalMintedZchf : null,
    totalLimitZchf: l?.totalLimitZchf ?? null,
    remainingLimitZchf: l?.remainingLimitZchf ?? null,
    collateralAmount: l ? l.totalCollateral : null,
    collateralValueChf: l?.collateralValueChf ?? null,
    utilizationPct: l?.utilizationPct ?? null,
    weightedCollateralRatioPct: l?.safety?.weightedCollateralRatioPct ?? null,
    minLiquidationBufferPct: l?.safety?.minLiquidationBufferPct ?? null,
    debtWithin10Pct: l?.safety?.debtWithin.pct10 ?? null,
    riskPremiumAvgPct: l?.riskPremiumPct?.weightedAvg ?? null,
    riskPremiumMinPct: l?.riskPremiumPct?.min ?? null,
    riskPremiumMaxPct: l?.riskPremiumPct?.max ?? null,
    annualInterestAvgPct: l?.annualInterestPct?.weightedAvg ?? null,
    reserveContributionAvgPct: l?.reserveContributionPct?.weightedAvg ?? null,
    liquidationPriceMin: l?.liquidationPriceZchf?.min ?? null,
    liquidationPriceMax: l?.liquidationPriceZchf?.max ?? null,
    challengePeriodHoursMin: l?.challengePeriodSeconds ? Math.round(l.challengePeriodSeconds.min / 3600) : null,
    activeChallenges: l ? l.challenges.active : null,
    totalChallenges: l ? l.challenges.total : null,
    nextExpiry: l?.nextExpiry ?? null,
    liveRiskCount: liveItems.length,
    liveRiskHigh: liveHigh,
    liveRisk: liveItems.map((i) => i.title),
    reviewCount: reviewItems.length,
    review: reviewItems.map((i) => i.title),
    liveRiskState: liveHigh > 0 ? "risk" : liveItems.length > 0 ? "watch" : "ok",
    attentionUrl: `/attention#${r.slug}`,
  };
}
