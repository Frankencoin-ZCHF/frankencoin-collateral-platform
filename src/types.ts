/** Shared domain types. */

import type { TAIL_RISK_CATEGORIES } from "@/lib/constants";

export type AssessmentStatus = "draft" | "published" | "deprecated";
export type TailRiskCategory = (typeof TAIL_RISK_CATEGORIES)[number];
export type Classification = "Strong" | "Sufficient" | "Insufficient" | null;

/** Verbatim frontmatter shape (after zod validation, unknown extra keys preserved). */
export interface RawTailRisk {
  name: string;
  probability: string;
  severity: string;
  compensation: string;
}

export interface RawFrontmatter {
  asset_name: string;
  asset_ticker: string;
  contract_address: string;
  assessment_date: string;
  author: string;
  links: { etherscan: string; coingecko: string; website: string; docs: string; other: string; discussion?: string } & Record<string, unknown>;
  risk_scores: {
    public_information: string;
    free_float: string;
    market_risk: string;
    tail_risks: Record<TailRiskCategory, RawTailRisk[]>;
  };
  risk_parameters: {
    retained_reserve: number | null;
    target_interest_rate: number | null;
    global_minting_limit: number | null;
    liquidation_price: number | null;
    maturity: number | null;
    auction_duration: number | null;
    minimum_collateral: number | null;
  };
  blocks?: unknown[];
  [key: string]: unknown;
}

export interface TailRisk {
  category: TailRiskCategory;
  name: string;
  probability: string | null;
  severity: string | null;
  compensationPct: number | null;
  /** Framework-derived expected annual loss, probability × severity, in %. Null if either is n/a. */
  expectedLossPct: number | null;
}

export interface AssessmentData {
  assetName: string;
  ticker: string;
  address: string | null;
  assessmentDate: string;
  author: string;
  links: { label: string; key: string; url: string }[];
  discussionUrl: string | null;
  scores: {
    publicInformation: Classification;
    freeFloat: Classification;
    marketRiskPct: number | null;
  };
  tailRisks: TailRisk[];
  totalCompensationPct: number | null;
  params: {
    retainedReservePct: number | null;
    targetInterestRatePct: number | null;
    globalMintingLimit: number | null;
    liquidationPrice: number | null;
    maturityMonths: number | null;
    auctionDurationHours: number | null;
    minimumCollateral: number | null;
  };
}

export interface VersionRef {
  sha: string;
  shortSha: string;
  date: string;
  author: string;
  authorLogin: string | null;
  message: string;
  path: string;
  url: string;
}

export interface Assessment {
  ticker: string;
  slug: string;
  status: AssessmentStatus;
  path: string;
  /** Commit this content was read at (null when read from the moving ref without commit info). */
  ref: VersionRef | null;
  raw: RawFrontmatter;
  data: AssessmentData;
  body: string;
  /** Markdown source of the whole file — used by the diff view. */
  source: string;
}

export interface ParseFailure {
  path: string;
  error: string;
}

// ── Protocol (live) ──────────────────────────────────────────────────────────

export interface Position {
  address: string;
  version: 1 | 2;
  owner: string;
  status: "active" | "closed" | "denied";
  isOriginal: boolean;
  collateralBalance: number;
  minted: number;
  availableForMinting: number;
  availableForClones: number;
  limitForClones: number;
  liquidationPriceZchf: number;
  /** Risk premium above the lead rate (V2 riskPremiumPPM). V1 has no split — equals annualInterestPct. */
  riskPremiumPct: number;
  /** Total annual borrowing rate (annualInterestPPM on both versions). */
  annualInterestPct: number;
  reserveContributionPct: number;
  challengePeriodSeconds: number;
  minimumCollateral: number;
  createdAt: string | null;
  startAt: string | null;
  cooldownUntil: string | null;
  expiresAt: string | null;
  collateralValueChf: number | null;
  collateralRatioPct: number | null;
  url: string;
}

export interface Challenge {
  id: string;
  position: string;
  number: number;
  challenger: string;
  status: string;
  version: number;
  startedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  size: number;
  filledSize: number;
  liquidationPriceZchf: number;
  bids: number;
  txHash: string;
}

export interface LiveCollateral {
  address: string;
  chainId: number;
  chainName: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Present in /ecosystem/collateral/list (the protocol's official collateral list). */
  listed: boolean;
  price: { chf: number; usd: number; source: string | null; timestamp: string | null } | null;
  positions: { total: number; active: number; closed: number; denied: number; list: Position[] };
  totalMintedZchf: number;
  totalCollateral: number;
  collateralValueChf: number | null;
  availableForMintingZchf: number;
  utilizationPct: number | null;
  riskPremiumPct: { min: number; max: number; weightedAvg: number } | null;
  annualInterestPct: { min: number; max: number; weightedAvg: number } | null;
  reserveContributionPct: { min: number; max: number; weightedAvg: number } | null;
  liquidationPriceZchf: { min: number; max: number } | null;
  challengePeriodSeconds: { min: number; max: number } | null;
  minimumCollateral: number | null;
  nextExpiry: string | null;
  challenges: { total: number; active: number; list: Challenge[] };
  market: { change24hPct: number | null; marketCapUsd: number | null } | null;
}

export type CollateralKind = "assessed" | "live-only" | "both";

export interface CollateralRecord {
  slug: string;
  ticker: string;
  name: string;
  address: string | null;
  kind: CollateralKind;
  assessment: Assessment | null;
  live: LiveCollateral | null;
  /** Set when the assessment's contract_address differs from the on-chain token it was matched to by symbol. */
  addressMismatch: { assessed: string | null; onchain: string } | null;
}

// ── Discussions ──────────────────────────────────────────────────────────────

export interface DiscussionComment {
  id: string;
  url: string;
  author: string | null;
  authorAvatar: string | null;
  createdAt: string;
  html: string;
  upvotes: number;
  replies: DiscussionComment[];
}

export interface Discussion {
  number: number;
  title: string;
  url: string;
  category: string;
  author: string | null;
  authorAvatar: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  upvotes: number;
  html: string;
  comments: DiscussionComment[];
  /** How the thread was linked: declared in the assessment, or matched by title. */
  matchedBy: "declared" | "heuristic";
}

export interface DiscussionSummary {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  commentCount: number;
}
