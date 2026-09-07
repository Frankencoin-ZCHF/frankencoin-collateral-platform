/**
 * Flat row shape shared by the overview grid (client), the SSR fallback table and
 * /api/collaterals.json. Keep it JSON-serialisable and flat — AG Grid columns map 1:1.
 */

import type { CollateralRecord } from "@/types";

export interface CollateralRow {
  slug: string;
  url: string;
  ticker: string;
  name: string;
  address: string | null;
  kind: "assessed" | "live-only" | "both";
  status: "draft" | "published" | "deprecated" | "none";
  assessedOn: string | null;
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
  positionsActive: number | null;
  positionsTotal: number | null;
  mintedZchf: number | null;
  collateralAmount: number | null;
  collateralValueChf: number | null;
  availableForMintingZchf: number | null;
  utilizationPct: number | null;
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
}

export function toRow(r: CollateralRecord): CollateralRow {
  const a = r.assessment?.data ?? null;
  const l = r.live;
  return {
    slug: r.slug,
    url: `/collateral/${r.slug}`,
    ticker: r.ticker,
    name: r.name,
    address: r.address,
    kind: r.kind,
    status: r.assessment?.status ?? "none",
    assessedOn: a?.assessmentDate ?? null,
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
    positionsActive: l ? l.positions.active : null,
    positionsTotal: l ? l.positions.total : null,
    mintedZchf: l ? l.totalMintedZchf : null,
    collateralAmount: l ? l.totalCollateral : null,
    collateralValueChf: l?.collateralValueChf ?? null,
    availableForMintingZchf: l ? l.availableForMintingZchf : null,
    utilizationPct: l?.utilizationPct ?? null,
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
  };
}
