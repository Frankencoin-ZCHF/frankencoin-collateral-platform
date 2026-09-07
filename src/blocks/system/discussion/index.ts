import type { SystemBlock } from "@/blocks/types";
import * as discussions from "@/services/discussions";
import Block from "./Block.astro";

const discussion: SystemBlock<discussions.DiscussionResult> = {
  id: "discussion",
  title: "Community discussion",
  order: 80,
  timeoutMs: 8_000,
  load: async (ctx) => discussions.forCollateral(ctx.record.assessment, ctx.record.ticker, ctx.record.name),
  Component: Block,
};

export default discussion;
