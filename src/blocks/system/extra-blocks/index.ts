/** Content blocks declared in the frontmatter `blocks: []` array — rendered as an "Additional data" section. */

import type { SystemBlock, ContentBlockResult } from "@/blocks/types";
import { loadContentBlocks } from "@/blocks/content/registry";
import Block from "./Block.astro";

const extraBlocks: SystemBlock<ContentBlockResult[]> = {
  id: "extra-blocks",
  title: "Additional data",
  order: 55,
  enabled: (ctx) => Array.isArray(ctx.assessment?.raw.blocks) && ctx.assessment!.raw.blocks.length > 0,
  timeoutMs: 8_000,
  load: async (ctx) => {
    const specs = (ctx.assessment!.raw.blocks ?? []).map((raw, index) => ({ index, source: "frontmatter" as const, raw }));
    const results = await loadContentBlocks(specs, ctx);
    return results.length ? results : null;
  },
  Component: Block,
};

export default extraBlocks;
