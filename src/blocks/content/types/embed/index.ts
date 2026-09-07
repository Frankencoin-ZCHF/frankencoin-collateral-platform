import { z } from "zod";
import type { ContentBlockType } from "@/blocks/types";
import Block from "./Block.astro";

/** Only these hosts may be iframed (mirrored in the CSP frame-src in src/middleware.ts). */
export const EMBED_HOSTS = ["dune.com", "defillama.com", "www.youtube.com", "youtube.com"];

export const schema = z.object({
  type: z.literal("embed"),
  title: z.string().max(120).optional(),
  url: z
    .url()
    .refine((u) => {
      try {
        const { protocol, hostname } = new URL(u);
        return protocol === "https:" && EMBED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
      } catch {
        return false;
      }
    }, `Only https embeds from ${EMBED_HOSTS.join(", ")} are allowed`),
  height: z.number().int().min(120).max(1200).default(420),
});

export type EmbedSpec = z.infer<typeof schema>;

const embed: ContentBlockType<EmbedSpec, EmbedSpec> = {
  type: "embed",
  description: `An iframe embed from an allow-listed host (${EMBED_HOSTS.join(", ")}).`,
  schema,
  load: async (spec) => {
    // youtube.com/watch?v=… → embed URL
    const u = new URL(spec.url);
    if (/youtube\.com$/.test(u.hostname) && u.pathname === "/watch" && u.searchParams.get("v")) {
      return { ...spec, url: `https://www.youtube.com/embed/${u.searchParams.get("v")}` };
    }
    return spec;
  },
  Component: Block,
};

export default embed;
