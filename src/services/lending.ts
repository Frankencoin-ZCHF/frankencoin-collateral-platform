/** Human-facing lending terms. Values are percentage points, never PPM/fractions.
 * PositionV2.annualInterestPPM = base + riskPremiumPPM, charged on gross minted debt.
 * The assessment framework uses (base + premium) / (1 - retained reserve).
 * See Frankencoin contracts/minting/v2/PositionV2.sol:getUsableMint,annualInterestPPM
 * and the assessment framework, §5 Parameter Calibration.
 */
import type { LiveCollateral, Position } from "@/types";
import { formatPercent } from "@/lib/numbers";

export function effectiveInterestPct(p: Pick<Position, "annualInterestPct" | "reserveContributionPct">): number | null {
  const rate = p.annualInterestPct, reserve = p.reserveContributionPct;
  if (rate === null || reserve === null || !Number.isFinite(rate) || !Number.isFinite(reserve) || rate < 0 || reserve < 0 || reserve >= 100) return null;
  return rate / (1 - reserve / 100);
}
export interface TermRange { min: number; max: number; average: number }
export function formatTerm(term: TermRange | null, digits = 2): string {
  if (!term) return "Unavailable";
  return Math.abs(term.max - term.min) < 1e-9
    ? formatPercent(term.min, digits)
    : `${formatPercent(term.min, digits)} – ${formatPercent(term.max, digits)}`;
}
function term(positions: Position[], pick: (p: Position) => number | null, weight: (p: Position) => number): TermRange | null {
  const values = positions.map(pick);
  if (!values.length || values.some((v) => v === null || !Number.isFinite(v))) return null;
  const nums = values as number[];
  const weights = positions.map(weight), total = weights.reduce((s, w) => s + w, 0);
  return { min: Math.min(...nums), max: Math.max(...nums), average: total > 0 ? nums.reduce((s, v, i) => s + v * weights[i]!, 0) / total : nums.reduce((s, v) => s + v, 0) / nums.length };
}
export function lendingTerms(live: LiveCollateral | null) {
  const debt = live?.totalMintedZchf ?? null;
  const active = live?.positions.list.filter((p) => p.status === "active") ?? [];
  const funded = active.filter((p) => p.minted > 0);
  const positions = active;
  const validReserve = (p: Position) => p.reserveContributionPct !== null && Number.isFinite(p.reserveContributionPct) && p.reserveContributionPct >= 0 && p.reserveContributionPct < 100 ? p.reserveContributionPct : null;
  const reserve = live?.bridge ? null : term(positions, validReserve, (p) => p.minted);
  const interest = live?.bridge ? null : term(positions, effectiveInterestPct, (p) => p.minted * (1 - (p.reserveContributionPct ?? 0) / 100));
  const feedDebt = funded.reduce((s, p) => s + p.minted, 0);
  // The stats endpoint truncates ZCHF amounts to integers. Allow at most that rounding
  // (or floating-point noise at large values), never the broader 1% monitoring tolerance.
  const complete = Boolean(live && !live.reconciliation.divergent && debt !== null && Math.abs(feedDebt - debt) <= Math.max(1, debt * 1e-8));
  const reserveRequired = live?.bridge ? 0 : debt === 0 ? 0 : complete && reserve ? debt! * reserve.average / 100 : null;
  const outsideReserve = debt !== null && reserveRequired !== null ? debt - reserveRequired : null;
  const backing = live?.collateralValueChf;
  const collateralisationPct = debt !== null && debt > 0 && backing != null && Number.isFinite(backing) && backing >= 0 ? backing / debt * 100 : null;
  return { debt, reserve, interest, complete, reserveRequired, outsideReserve, collateralisationPct,
    overcollateralisationPct: collateralisationPct === null ? null : collateralisationPct - 100,
    limit: live?.totalLimitZchf ?? null,
    limitUsedPct: debt !== null && live?.totalLimitZchf && live.totalLimitZchf > 0 ? debt / live.totalLimitZchf * 100 : null };
}
