/**
 * Assessed vs on-chain parameter comparison with named, explained verdicts.
 * Shared by the risk-parameters block and the attention list.
 */

import { formatCompact, formatDate, formatDuration, formatNumber, formatPercent, formatPrice } from "@/lib/numbers";
import type { AssessmentData, LiveCollateral } from "@/types";

export type Verdict = "matches" | "within-range" | "differs" | "not-comparable" | "unavailable";

export const VERDICT_LABEL: Record<Verdict, string> = {
  matches: "Matches assessment",
  "within-range": "Within assessed range",
  differs: "Differs from assessment",
  "not-comparable": "Not comparable",
  unavailable: "Unavailable",
};

export interface ParamRow {
  key: string;
  label: string;
  hint: string;
  assessed: string;
  onchain: string;
  verdict: Verdict;
  explanation: string;
}

const relDiff = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / Math.abs(b));

function numeric(
  key: string,
  label: string,
  hint: string,
  assessed: number | null,
  onchain: { value: number; min?: number; max?: number } | null,
  fmt: (n: number) => string,
  opts: { tolPct?: number; direction?: "higher-is-safer" | "lower-is-safer" | "neutral" } = {},
): ParamRow {
  const tol = (opts.tolPct ?? 10) / 100;
  if (assessed === null && onchain === null) return { key, label, hint, assessed: "–", onchain: "–", verdict: "unavailable", explanation: "Neither the assessment nor the protocol provides this value." };
  if (assessed === null) return { key, label, hint, assessed: "–", onchain: fmt(onchain!.value), verdict: "not-comparable", explanation: "The assessment does not set this parameter." };
  if (onchain === null) return { key, label, hint, assessed: fmt(assessed), onchain: "–", verdict: "unavailable", explanation: "No active on-chain positions yet — nothing to compare against." };

  const rangeTxt = onchain.min !== undefined && onchain.max !== undefined && onchain.min !== onchain.max ? ` (positions range ${fmt(onchain.min)} – ${fmt(onchain.max)})` : "";
  const onchainTxt = fmt(onchain.value) + rangeTxt;

  if (relDiff(onchain.value, assessed) <= tol) {
    return { key, label, hint, assessed: fmt(assessed), onchain: onchainTxt, verdict: "matches", explanation: `Live value is within ${opts.tolPct ?? 10} % of the assessed value.` };
  }
  const safer = opts.direction === "higher-is-safer" ? onchain.value > assessed : opts.direction === "lower-is-safer" ? onchain.value < assessed : false;
  if (safer) {
    return { key, label, hint, assessed: fmt(assessed), onchain: onchainTxt, verdict: "within-range", explanation: `Live value is more conservative than assessed (${opts.direction === "higher-is-safer" ? "higher" : "lower"} is safer).` };
  }
  return { key, label, hint, assessed: fmt(assessed), onchain: onchainTxt, verdict: "differs", explanation: `Live value deviates ${formatPercent(relDiff(onchain.value, assessed) * 100, 0)} from the assessed value${opts.direction !== "neutral" ? " in the less conservative direction" : ""}.` };
}

export function compareParameters(p: AssessmentData["params"], l: LiveCollateral | null): ParamRow[] {
  const active = l?.positions.list.filter((x) => x.status === "active") ?? [];
  const has = active.length > 0;
  const price = l?.price?.chf ?? null;
  const rows: ParamRow[] = [];

  rows.push(
    numeric("retained_reserve", "Retained reserve", "Collateral haircut covering ordinary volatility (observed downside + 2 %)", p.retainedReservePct, has && l?.reserveContributionPct ? { value: l.reserveContributionPct.weightedAvg, min: l.reserveContributionPct.min, max: l.reserveContributionPct.max } : null, (n) => formatPercent(n, 1), { direction: "higher-is-safer" }),
  );
  rows.push(
    numeric("risk_premium", "Risk premium", "Interest above the lead rate that compensates tail risks", p.targetInterestRatePct, has && l?.riskPremiumPct ? { value: l.riskPremiumPct.weightedAvg, min: l.riskPremiumPct.min, max: l.riskPremiumPct.max } : null, (n) => formatPercent(n, 2), { tolPct: 15, direction: "higher-is-safer" }),
  );

  // Liquidation price: compare the assessed figure with the highest live liquidation price relative to the market price.
  const liq = l?.liquidationPriceZchf ?? null;
  if (p.liquidationPrice === null && !liq) rows.push({ key: "liquidation_price", label: "Liquidation price", hint: "ZCHF per collateral unit at which a position can be challenged", assessed: "–", onchain: "–", verdict: "unavailable", explanation: "Not set in the assessment and no active positions." });
  else if (p.liquidationPrice === null) rows.push({ key: "liquidation_price", label: "Liquidation price", hint: "ZCHF per collateral unit at which a position can be challenged", assessed: "–", onchain: liq!.min === liq!.max ? `${formatPrice(liq!.min)} ZCHF` : `${formatPrice(liq!.min)} – ${formatPrice(liq!.max)} ZCHF`, verdict: "not-comparable", explanation: "The assessment does not propose a liquidation price." });
  else if (!liq) rows.push({ key: "liquidation_price", label: "Liquidation price", hint: "ZCHF per collateral unit at which a position can be challenged", assessed: `${formatPrice(p.liquidationPrice)} ZCHF`, onchain: "–", verdict: "unavailable", explanation: "No active on-chain positions yet." });
  else {
    const buffer = price !== null ? ((price - liq.max) / price) * 100 : null;
    const r = numeric("liquidation_price", "Liquidation price", "ZCHF per collateral unit at which a position can be challenged", p.liquidationPrice, { value: liq.max, min: liq.min, max: liq.max }, (n) => `${formatPrice(n)} ZCHF`, { tolPct: 10, direction: "lower-is-safer" });
    if (buffer !== null) r.explanation += ` Market price ${formatPrice(price!)} CHF leaves a ${formatPercent(buffer, 0)} buffer above the highest live liquidation price.`;
    rows.push(r);
  }

  rows.push(
    numeric("auction_duration", "Auction duration", "Challenge period before a liquidation auction settles", p.auctionDurationHours !== null ? p.auctionDurationHours * 3600 : null, has && l?.challengePeriodSeconds ? { value: l.challengePeriodSeconds.min, min: l.challengePeriodSeconds.min, max: l.challengePeriodSeconds.max } : null, formatDuration, { tolPct: 5, direction: "neutral" }),
  );
  rows.push(numeric("minimum_collateral", "Minimum collateral", "Smallest position size (collateral units)", p.minimumCollateral, has && l?.minimumCollateral !== null && l?.minimumCollateral !== undefined ? { value: l.minimumCollateral } : null, (n) => formatNumber(n, n < 10 ? 4 : 2), { tolPct: 1, direction: "neutral" }));
  rows.push(numeric("global_minting_limit", "Global minting limit", "Maximum ZCHF mintable against this collateral across all positions", p.globalMintingLimit, l?.totalLimitZchf ? { value: l.totalLimitZchf } : null, (n) => `${formatCompact(n)} ZCHF`, { tolPct: 25, direction: "lower-is-safer" }));

  rows.push({
    key: "maturity",
    label: "Maturity",
    hint: "Proposed position lifetime",
    assessed: p.maturityMonths === null ? "–" : `${formatNumber(p.maturityMonths, 0)} months`,
    onchain: l?.nextExpiry ? `next expiry ${formatDate(l.nextExpiry)}` : "–",
    verdict: "not-comparable",
    explanation: "Positions carry individual expiry dates; a proposed maturity is not a protocol parameter.",
  });

  return rows;
}
