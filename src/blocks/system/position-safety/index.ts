/**
 * Position safety: collateralisation, liquidation buffers, debt near liquidation — and the
 * ranked list of positions that produce those numbers, so the operational next step
 * ("which position?") is one click away.
 */

import type { SystemBlock } from "@/blocks/types";
import { round } from "@/lib/numbers";
import type { PositionSafety } from "@/types";
import Block from "./Block.astro";

export interface RankedPosition {
  address: string;
  url: string;
  version: 1 | 2;
  isOriginal: boolean;
  minted: number;
  collateralBalance: number;
  collateralValueChf: number | null;
  liquidationPriceZchf: number;
  bufferPct: number;
  challengeActive: boolean;
}

export interface PositionSafetyData {
  safety: PositionSafety;
  totalMintedZchf: number;
  priceChf: number;
  symbol: string;
  /** Debt distribution by liquidation-buffer band (ZCHF). */
  bands: { label: string; minted: number }[];
  /** Active positions with debt, riskiest first. */
  ranked: RankedPosition[];
}

const positionSafety: SystemBlock<PositionSafetyData> = {
  id: "position-safety",
  title: "Price exposure",
  order: 25,
  span: "full",
  enabled: (ctx) => Boolean(ctx.record.live?.safety),
  load: async (ctx) => {
    const l = ctx.record.live!;
    const s = l.safety!;
    const price = l.price!.chf;
    const challenged = new Set(l.challenges.list.filter((c) => c.isActive).map((c) => c.position.toLowerCase()));
    const active = l.positions.list.filter((p) => p.status === "active" && p.minted > 0 && p.liquidationPriceZchf > 0);
    const buffer = (liq: number) => ((price - liq) / price) * 100;
    const band = (lo: number, hi: number) => active.filter((p) => buffer(p.liquidationPriceZchf) > lo && buffer(p.liquidationPriceZchf) <= hi).reduce((n, p) => n + p.minted, 0);
    const ranked: RankedPosition[] = active
      .map((p) => ({
        address: p.address,
        url: p.url,
        version: p.version,
        isOriginal: p.isOriginal,
        minted: p.minted,
        collateralBalance: p.collateralBalance,
        collateralValueChf: p.collateralValueChf,
        liquidationPriceZchf: p.liquidationPriceZchf,
        bufferPct: round(buffer(p.liquidationPriceZchf), 1),
        challengeActive: challenged.has(p.address.toLowerCase()),
      }))
      .sort((a, b) => a.bufferPct - b.bufferPct);
    return {
      safety: s,
      totalMintedZchf: l.totalMintedZchf,
      priceChf: price,
      symbol: l.symbol,
      bands: [
        { label: "≤ 0%", minted: band(-Infinity, 0) },
        { label: "0 – 5 %", minted: band(0, 5) },
        { label: "5 – 10 %", minted: band(5, 10) },
        { label: "10 – 20 %", minted: band(10, 20) },
        { label: "20 – 40 %", minted: band(20, 40) },
        { label: "> 40 %", minted: band(40, Infinity) },
      ],
      ranked,
    };
  },
  Component: Block,
};

export default positionSafety;
