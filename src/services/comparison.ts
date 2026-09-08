/** Assessment comparisons describe observed settings; publication is not governance approval. */
import { formatCompact, formatDate, formatDuration, formatNumber, formatPercent, formatPrice } from "@/lib/numbers";
import type { AssessmentData, AssessmentStatus, LiveCollateral, Position } from "@/types";

export type Verdict = "matches" | "within-tolerance" | "within-range" | "varies" | "differs" | "not-comparable" | "unavailable";
export function verdictLabel(v: Verdict, _status: AssessmentStatus): string {
  return {
    matches: "Exact match",
    "within-tolerance": "Within stated tolerance",
    "within-range": "More conservative setting",
    varies: "Varies across positions",
    differs: "Different setting",
    "not-comparable": "Not comparable",
    unavailable: "Unavailable",
  }[v];
}
export interface ParamRow {
  key: string;
  label: string;
  hint: string;
  assessed: string;
  onchain: string;
  verdict: Verdict;
  explanation: string;
  positionCount: number;
  differentDebt: number;
  differentPositions: { address: string; url: string; value: string; debt: number }[];
}
const exact = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9;
const relativeDifference = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / Math.abs(b));
const emptyPositionInfo = { positionCount: 0, differentDebt: 0, differentPositions: [] };

type Sample = { value: number; position?: Position };
function numeric(
  status: AssessmentStatus,
  key: string,
  label: string,
  hint: string,
  assessed: number | null,
  samples: Sample[],
  fmt: (n: number) => string,
  tolerancePct = 10,
  direction: "higher" | "lower" | "neutral" = "neutral",
): ParamRow {
  const baseline =
    status === "published" ? "the published assessment" : status === "deprecated" ? "the archived assessment" : "the draft proposal";
  const values = samples.map((s) => s.value).filter(Number.isFinite);
  const min = Math.min(...values),
    max = Math.max(...values);
  const onchain = values.length ? (exact(min, max) ? fmt(min) : `${fmt(min)} – ${fmt(max)}`) : "–";
  const differentPositions =
    assessed === null
      ? []
      : samples
          .filter((s) => s.position && !exact(s.value, assessed))
          .map((s) => ({ address: s.position!.address, url: s.position!.url, value: fmt(s.value), debt: s.position!.minted }));
  const differentDebt = differentPositions.reduce((n, p) => n + p.debt, 0);
  const base = {
    key,
    label,
    hint,
    assessed: assessed === null ? "–" : fmt(assessed),
    onchain,
    differentPositions,
    differentDebt,
    positionCount: samples.filter((s) => s.position).length,
  };
  if (!values.length) return { ...base, verdict: "unavailable", explanation: "No comparable on-chain settings are available." };
  if (assessed === null) return { ...base, verdict: "not-comparable", explanation: "The assessment does not set this parameter." };
  if (values.every((v) => exact(v, assessed)))
    return { ...base, verdict: "matches", explanation: `Every observed setting equals ${baseline}.` };
  const differenceText = differentPositions.length
    ? `${differentPositions.length} of ${base.positionCount} positions, representing ${formatCompact(differentDebt)} ZCHF of debt, use a different value. `
    : "";
  if (!exact(min, max))
    return {
      ...base,
      verdict: "varies",
      explanation: `${differenceText}Compare the individual positions below; a range or weighted average does not establish agreement. Publication does not establish governance approval.`,
    };
  if (relativeDifference(min, assessed) <= tolerancePct / 100)
    return {
      ...base,
      verdict: "within-tolerance",
      explanation: `${differenceText}The setting is within the display tolerance of ${tolerancePct}% relative to ${baseline}, but is not an exact match. This tolerance is not a governance rule.`,
    };
  const safer = direction === "higher" ? min > assessed : direction === "lower" ? min < assessed : false;
  if (safer)
    return {
      ...base,
      verdict: "within-range",
      explanation: `${differenceText}The ${direction} setting is more conservative for this parameter relative to ${baseline}. It is not a rating of the asset's overall risk.`,
    };
  return {
    ...base,
    verdict: "differs",
    explanation: `${differenceText}The setting differs from ${baseline}. Review its rationale; a published document alone does not establish an adopted governance baseline.`,
  };
}

export function compareParameters(p: AssessmentData["params"], l: LiveCollateral | null, status: AssessmentStatus = "draft"): ParamRow[] {
  const active = l?.bridge ? [] : (l?.positions.list.filter((x) => x.status === "active") ?? []);
  const samples = (pick: (p: Position) => number, positions = active) => positions.map((position) => ({ position, value: pick(position) }));
  const rows = [
    numeric(
      status,
      "retained_reserve",
      "Retained reserve",
      "Share of minted ZCHF retained for liquidation outcomes; separate from the collateral's market-price cushion",
      p.retainedReservePct,
      samples((p) => p.reserveContributionPct),
      (n) => formatPercent(n, 1),
      10,
      "higher",
    ),
    numeric(
      status,
      "risk_premium",
      "Risk premium",
      "Interest above the lead rate; V1 positions do not expose a separate premium",
      p.targetInterestRatePct,
      samples(
        (p) => p.riskPremiumPct,
        active.filter((p) => p.version === 2),
      ),
      (n) => formatPercent(n, 2),
      15,
      "higher",
    ),
    numeric(
      status,
      "liquidation_price",
      "Liquidation price",
      "Configured ZCHF price per collateral unit used in the challenge mechanism; no automatic market-price trigger",
      p.liquidationPrice,
      samples((p) => p.liquidationPriceZchf),
      (n) => `${formatPrice(n)} ZCHF`,
      10,
      "lower",
    ),
    numeric(
      status,
      "auction_duration",
      "Auction duration",
      "Configured challenge period; positions can use different durations",
      p.auctionDurationHours === null ? null : p.auctionDurationHours * 3600,
      samples((p) => p.challengePeriodSeconds),
      formatDuration,
      5,
    ),
    numeric(
      status,
      "minimum_collateral",
      "Minimum collateral",
      "Smallest position size in collateral units",
      p.minimumCollateral,
      samples((p) => p.minimumCollateral),
      (n) => formatNumber(n, n < 10 ? 4 : 2),
      1,
    ),
    numeric(
      status,
      "global_minting_limit",
      "Aggregate minting limit",
      "Maximum outstanding ZCHF under the current aggregate limits; not immediately available borrowing capacity",
      p.globalMintingLimit,
      l?.totalLimitZchf != null ? [{ value: l.totalLimitZchf }] : [],
      (n) => `${formatCompact(n)} ZCHF`,
      25,
      "lower",
    ),
  ];
  rows.push({
    key: "maturity",
    label: "Maturity",
    hint: "Proposed position lifetime",
    assessed: p.maturityMonths === null ? "–" : `${formatNumber(p.maturityMonths, 0)} months`,
    onchain: l?.nextExpiry ? `next expiry ${formatDate(l.nextExpiry)}` : "–",
    verdict: "not-comparable",
    explanation: "Individual expiry dates cannot be compared directly with a proposed lifetime.",
    ...emptyPositionInfo,
  });
  return rows;
}
