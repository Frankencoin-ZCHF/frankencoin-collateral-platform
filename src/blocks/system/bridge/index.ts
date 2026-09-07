/** 1:1 stablecoin bridge: how it works, exposure, horizon, peg — replaces the position-based blocks for bridge minters. */

import type { SystemBlock } from "@/blocks/types";
import { round } from "@/lib/numbers";
import type { Bridge } from "@/types";
import Block from "./Block.astro";

export interface BridgeData {
  bridge: Bridge;
  symbol: string;
  name: string;
  stablecoinDecimals: number;
  /** Source stablecoin price in CHF (1.00 = on peg) and deviation. */
  pegPriceChf: number | null;
  pegDeviationPct: number | null;
  priceSource: string | null;
  priceAt: string | null;
}

const bridge: SystemBlock<BridgeData> = {
  id: "bridge",
  title: "1:1 stablecoin bridge — how it works and what the risk is",
  order: 15,
  enabled: (ctx) => Boolean(ctx.record.live?.bridge),
  load: async (ctx) => {
    const l = ctx.record.live!;
    const b = l.bridge!;
    const price = l.price?.chf ?? null;
    return {
      bridge: b,
      symbol: l.symbol,
      name: l.name,
      stablecoinDecimals: l.decimals,
      pegPriceChf: price,
      pegDeviationPct: price !== null ? round((price - 1) * 100, 2) : null,
      priceSource: l.price?.source ?? null,
      priceAt: l.price?.timestamp ?? null,
    };
  },
  Component: Block,
};

export default bridge;
