import { z } from "zod";
import type { ContentBlockType } from "@/blocks/types";
import Block from "./Block.astro";

export const schema = z.object({
  type: z.enum(["documents", "links"]),
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        url: z.url(),
        description: z.string().max(500).optional(),
        date: z.string().max(40).optional(),
        kind: z.enum(["pdf", "web", "audit", "legal", "report", "code", "other"]).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export type DocumentsSpec = z.infer<typeof schema>;

const documents: ContentBlockType<DocumentsSpec, DocumentsSpec> = {
  type: "documents",
  description: "A titled list of links to documents (audits, legal opinions, reports, dashboards).",
  schema,
  load: async (spec) => spec,
  Component: Block,
};

export default documents;
