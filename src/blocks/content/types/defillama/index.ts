import { z } from "zod";
import type { ContentBlockType } from "@/blocks/types";
import { getOrLoad, TTL } from "@/lib/cache";
import { DEFILLAMA_BASE } from "@/lib/constants";
import { fetchJson } from "@/upstream/client";
import Block from "./Block.astro";

export const schema = z.object({
  type: z.literal("defillama"),
  /** DefiLlama protocol slug (defillama.com/protocol/<slug>). */
  protocol: z.string().regex(/^[a-z0-9.-]+$/),
  title: z.string().max(120).optional(),
});

export type DefillamaSpec = z.infer<typeof schema>;

export interface DefillamaData {
  slug: string;
  name: string;
  url: string;
  category: string | null;
  tvlUsd: number | null;
  chains: { chain: string; tvlUsd: number }[];
  logo: string | null;
}

interface LlamaProtocol {
  name?: string;
  category?: string;
  logo?: string;
  currentChainTvls?: Record<string, number>;
  tvl?: { date: number; totalLiquidityUSD: number }[];
}

/** /protocol/<slug> can be several MB (full history) — allow up to 8 MB, cache 15 min. */
async function fetchProtocol(slug: string): Promise<LlamaProtocol> {
  return getOrLoad(`llama:protocol:${slug}`, 15 * TTL.MINUTE, () =>
    fetchJson<LlamaProtocol>(`${DEFILLAMA_BASE}/protocol/${encodeURIComponent(slug)}`, { source: "defillama", maxBytes: 8 * 1024 * 1024, timeoutMs: 8_000 }),
    { swrMs: TTL.HOUR },
  );
}

const defillama: ContentBlockType<DefillamaSpec, DefillamaData> = {
  type: "defillama",
  description: "Current TVL and chain breakdown of a protocol from DefiLlama.",
  schema,
  timeoutMs: 9_000,
  load: async (spec) => {
    const p = await fetchProtocol(spec.protocol);
    const chains = Object.entries(p.currentChainTvls ?? {})
      .filter(([k, v]) => typeof v === "number" && v > 0 && !/borrowed|staking|pool2|vesting|offers|treasury/i.test(k))
      .map(([chain, tvlUsd]) => ({ chain, tvlUsd }))
      .sort((a, b) => b.tvlUsd - a.tvlUsd);
    const last = p.tvl?.at(-1)?.totalLiquidityUSD;
    const tvlUsd = typeof last === "number" ? last : chains.reduce((n, c) => n + c.tvlUsd, 0) || null;
    return {
      slug: spec.protocol,
      name: p.name ?? spec.protocol,
      url: `https://defillama.com/protocol/${spec.protocol}`,
      category: p.category ?? null,
      tvlUsd,
      chains: chains.slice(0, 8),
      logo: p.logo ?? null,
    };
  },
  Component: Block,
};

export default defillama;
