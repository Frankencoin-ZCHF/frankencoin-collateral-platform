import type { SystemBlock } from "@/blocks/types";
import type { LiveCollateral } from "@/types";
import Block from "./Block.astro";

const liveProtocol: SystemBlock<LiveCollateral> = {
  id: "live-protocol",
  title: "On-chain (Ethereum)",
  order: 20,
  span: "half",
  enabled: (ctx) => ctx.record.live !== null,
  load: async (ctx) => ctx.record.live,
  Component: Block,
};

export default liveProtocol;
