import type { SystemBlock } from "@/blocks/types";
import type { Position } from "@/types";
import Block from "./Block.astro";

export interface PositionsData {
  symbol: string;
  decimals: number;
  priceChf: number | null;
  active: Position[];
  inactive: Position[];
}

const positions: SystemBlock<PositionsData> = {
  id: "positions",
  title: "Positions",
  order: 60,
  enabled: (ctx) => (ctx.record.live?.positions.total ?? 0) > 0 && !ctx.record.live?.bridge,
  load: async (ctx) => {
    const l = ctx.record.live!;
    return {
      symbol: l.symbol,
      decimals: l.decimals,
      priceChf: l.price?.chf ?? null,
      active: l.positions.list.filter((p) => p.status === "active"),
      inactive: l.positions.list.filter((p) => p.status !== "active"),
    };
  },
  Component: Block,
};

export default positions;
