import { z } from "zod";
import type { ContentBlockType } from "@/blocks/types";
import { renderMarkdown } from "@/lib/markdown";
import Block from "./Block.astro";

export const schema = z.object({
  type: z.literal("callout"),
  title: z.string().max(120).optional(),
  text: z.string().min(1).max(4000),
  variant: z.enum(["note", "warning", "success", "danger"]).default("note"),
});

export type CalloutSpec = z.infer<typeof schema>;
export interface CalloutData extends CalloutSpec {
  html: string;
}

const callout: ContentBlockType<CalloutSpec, CalloutData> = {
  type: "callout",
  description: "A highlighted note (markdown allowed in `text`). Variants: note, warning, success, danger.",
  schema,
  load: async (spec) => ({ ...spec, html: renderMarkdown(spec.text).html }),
  Component: Block,
};

export default callout;
