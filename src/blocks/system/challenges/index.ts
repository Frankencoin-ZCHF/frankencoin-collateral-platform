import type { SystemBlock } from "@/blocks/types";
import type { Challenge } from "@/types";
import Block from "./Block.astro";

export interface ChallengesData {
  symbol: string;
  list: Challenge[];
}

const challenges: SystemBlock<ChallengesData> = {
  id: "challenges",
  title: "Challenges & liquidations",
  order: 70,
  enabled: (ctx) => (ctx.record.live?.challenges.total ?? 0) > 0,
  load: async (ctx) => ({ symbol: ctx.record.live!.symbol, list: ctx.record.live!.challenges.list.slice(0, 25) }),
  Component: Block,
};

export default challenges;
