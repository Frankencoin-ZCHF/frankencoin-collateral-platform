/** Position safety: collateralisation, liquidation buffers and debt near liquidation over active positions. */

import type { SystemBlock } from "@/blocks/types";
import type { PositionSafety } from "@/types";
import Block from "./Block.astro";

export interface PositionSafetyData {
  safety: PositionSafety;
  totalMintedZchf: number;
  priceChf: number;
  symbol: string;
  /** Debt distribution by liquidation-buffer band (ZCHF). */
  bands: { label: string; minted: number }[];
}

const positionSafety: SystemBlock<PositionSafetyData> = {
  id: "position-safety",
  title: "Position safety",
  order: 25,
  span: "half",
  enabled: (ctx) => Boolean(ctx.record.live?.safety),
  load: async (ctx) => {
    const l = ctx.record.live!;
    const s = l.safety!;
    const price = l.price!.chf;
    const active = l.positions.list.filter((p) => p.status === "active" && p.minted > 0 && p.liquidationPriceZchf > 0);
    const buffer = (liq: number) => ((price - liq) / price) * 100;
    const band = (lo: number, hi: number) => active.filter((p) => buffer(p.liquidationPriceZchf) > lo && buffer(p.liquidationPriceZchf) <= hi).reduce((n, p) => n + p.minted, 0);
    return {
      safety: s,
      totalMintedZchf: l.totalMintedZchf,
      priceChf: price,
      symbol: l.symbol,
      bands: [
        { label: "≤ 5 %", minted: band(-Infinity, 5) },
        { label: "5 – 10 %", minted: band(5, 10) },
        { label: "10 – 20 %", minted: band(10, 20) },
        { label: "20 – 40 %", minted: band(20, 40) },
        { label: "> 40 %", minted: band(40, Infinity) },
      ],
    };
  },
  Component: Block,
};

export default positionSafety;
