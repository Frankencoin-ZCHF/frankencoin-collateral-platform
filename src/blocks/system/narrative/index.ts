/**
 * The assessment's markdown narrative, with ```block fences rendered inline as
 * content blocks at the exact position the author put them.
 */

import type { SystemBlock, ContentBlockResult } from "@/blocks/types";
import { loadContentBlocks } from "@/blocks/content/registry";
import { renderMarkdown, splitAtPlaceholders, splitSections } from "@/lib/markdown";
import Block from "./Block.astro";

export interface NarrativeSection {
  id: string | null;
  heading: string | null;
  parts: { html: string; block: ContentBlockResult | null }[];
}

export interface NarrativeData {
  sections: NarrativeSection[];
  headings: { id: string; text: string; level: number }[];
}

const narrative: SystemBlock<NarrativeData> = {
  id: "narrative",
  title: "Analysis & supporting evidence",
  order: 50,
  enabled: (ctx) => ctx.assessment !== null && ctx.assessment.body.trim().length > 0,
  timeoutMs: 8_000,
  load: async (ctx) => {
    const r = renderMarkdown(ctx.assessment!.body, { headingIdPrefix: "assessment-" });
    const results = await loadContentBlocks(
      r.fences.map((f) => ({ index: f.index, source: "fence" as const, raw: f.yaml })),
      ctx,
    );
    const byIndex = new Map(results.map((x) => [x.index, x]));
    const sections = splitSections(r.html).map((s) => ({
      id: s.id,
      heading: s.heading,
      parts: splitAtPlaceholders(s.html).map((p) => ({ html: p.html, block: p.blockIndex !== null ? byIndex.get(p.blockIndex) ?? null : null })),
    }));
    return { sections, headings: r.headings };
  },
  Component: Block,
};

export default narrative;
