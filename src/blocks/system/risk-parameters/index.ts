/**
 * "Assessment vs on-chain": the risk parameters proposed in the assessment side by side
 * with what active positions actually use.
 */

import type { SystemBlock } from "@/blocks/types";
import { formatCompact, formatDuration, formatNumber, formatPercent, formatPrice, formatDate } from "@/lib/numbers";
import Block from "./Block.astro";

export interface ParamRow {
  label: string;
  hint: string;
  assessed: string;
  onchain: string;
  /** "ok" when they agree, "diff" when they don't, null when not comparable. */
  verdict: "ok" | "diff" | null;
  note: string | null;
}

export interface RiskParametersData {
  rows: ParamRow[];
  hasLive: boolean;
}

const near = (a: number, b: number, tolPct = 10) => Math.abs(a - b) <= Math.abs(b) * (tolPct / 100) + 1e-9;

const riskParameters: SystemBlock<RiskParametersData> = {
  id: "risk-parameters",
  title: "Risk parameters — assessed vs on-chain",
  order: 30,
  enabled: (ctx) => ctx.assessment !== null,
  load: async (ctx) => {
    const p = ctx.assessment!.data.params;
    const l = ctx.record.live;
    const price = l?.price?.chf ?? null;
    const rows: ParamRow[] = [];

    const push = (label: string, hint: string, assessed: number | null, onchain: number | null, fmt: (n: number) => string, opts: { tol?: number; note?: string | null } = {}) => {
      const verdict = assessed !== null && onchain !== null ? (near(assessed, onchain, opts.tol ?? 10) ? "ok" : "diff") : null;
      rows.push({ label, hint, assessed: assessed === null ? "–" : fmt(assessed), onchain: onchain === null ? "–" : fmt(onchain), verdict, note: opts.note ?? null });
    };

    push("Retained reserve", "Collateral haircut covering ordinary volatility (MDD/VaR + 2%)", p.retainedReservePct, l?.reserveContributionPct?.weightedAvg ?? null, (n) => formatPercent(n, 1), {
      note: l?.reserveContributionPct && l.reserveContributionPct.min !== l.reserveContributionPct.max ? `on-chain range ${formatPercent(l.reserveContributionPct.min, 1)} – ${formatPercent(l.reserveContributionPct.max, 1)}` : null,
    });
    push("Risk premium", "Interest above the lead rate compensating tail risks", p.targetInterestRatePct, l?.riskPremiumPct?.weightedAvg ?? null, (n) => formatPercent(n, 2), {
      tol: 15,
      note: l?.riskPremiumPct && l.riskPremiumPct.min !== l.riskPremiumPct.max ? `on-chain range ${formatPercent(l.riskPremiumPct.min)} – ${formatPercent(l.riskPremiumPct.max)}` : null,
    });

    const liqOn = l?.liquidationPriceZchf ?? null;
    rows.push({
      label: "Liquidation price",
      hint: "ZCHF per unit of collateral at which a position can be challenged",
      assessed: p.liquidationPrice === null ? "–" : `${formatPrice(p.liquidationPrice)} ZCHF`,
      onchain: liqOn ? (liqOn.min === liqOn.max ? `${formatPrice(liqOn.min)} ZCHF` : `${formatPrice(liqOn.min)} – ${formatPrice(liqOn.max)} ZCHF`) : "–",
      verdict: null,
      note: price !== null && liqOn ? `market ${formatPrice(price)} CHF → ${formatPercent(((price - liqOn.max) / price) * 100, 0)} buffer above highest on-chain liquidation price` : null,
    });

    push("Auction duration", "Challenge period before a liquidation auction settles", p.auctionDurationHours !== null ? p.auctionDurationHours * 3600 : null, l?.challengePeriodSeconds?.min ?? null, formatDuration, {
      note: l?.challengePeriodSeconds && l.challengePeriodSeconds.min !== l.challengePeriodSeconds.max ? `on-chain range ${formatDuration(l.challengePeriodSeconds.min)} – ${formatDuration(l.challengePeriodSeconds.max)}` : null,
    });
    push("Minimum collateral", "Smallest position size (units of collateral)", p.minimumCollateral, l?.minimumCollateral ?? null, (n) => formatNumber(n, n < 10 ? 4 : 2), { tol: 1 });

    const limitOn = l ? l.positions.list.filter((x) => x.status === "active").reduce((n, x) => n + x.limitForClones, 0) : null;
    push("Global minting limit", "Maximum ZCHF mintable against this collateral", p.globalMintingLimit, limitOn && limitOn > 0 ? limitOn : null, (n) => `${formatCompact(n)} ZCHF`, { tol: 25 });

    rows.push({
      label: "Maturity",
      hint: "Proposed position lifetime",
      assessed: p.maturityMonths === null ? "–" : `${formatNumber(p.maturityMonths, 0)} months`,
      onchain: l?.nextExpiry ? `next expiry ${formatDate(l.nextExpiry)}` : "–",
      verdict: null,
      note: null,
    });

    return { rows, hasLive: l !== null && l.positions.active > 0 };
  },
  Component: Block,
};

export default riskParameters;
