import { z } from "zod";
import type { ContentBlockType } from "@/blocks/types";
import { cgFetch, idFromUrl } from "@/upstream/coingecko";
import Block from "./Block.astro";

export const FIELDS = ["price", "change_24h", "change_7d", "change_30d", "market_cap", "fdv", "volume_24h", "ath", "ath_change", "circulating_supply", "total_supply", "rank"] as const;

export const schema = z.object({
  type: z.literal("coingecko"),
  /** CoinGecko coin id (the slug in coingecko.com/en/coins/<id>). Defaults to the assessment's coingecko link. */
  id: z.string().regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().max(120).optional(),
  show: z.array(z.enum(FIELDS)).min(1).default(["price", "change_24h", "market_cap", "volume_24h", "ath", "ath_change"]),
});

export type CoingeckoSpec = z.infer<typeof schema>;

export interface CoingeckoData {
  id: string;
  name: string;
  symbol: string;
  url: string;
  image: string | null;
  updatedAt: string | null;
  show: (typeof FIELDS)[number][];
  values: Record<string, number | null>;
}

interface CgCoin {
  id: string;
  name: string;
  symbol: string;
  image?: { small?: string; thumb?: string };
  market_cap_rank?: number | null;
  last_updated?: string;
  market_data?: {
    current_price?: { usd?: number; chf?: number };
    price_change_percentage_24h?: number | null;
    price_change_percentage_7d?: number | null;
    price_change_percentage_30d?: number | null;
    market_cap?: { usd?: number };
    fully_diluted_valuation?: { usd?: number };
    total_volume?: { usd?: number };
    ath?: { usd?: number };
    ath_change_percentage?: { usd?: number };
    circulating_supply?: number | null;
    total_supply?: number | null;
  };
}

const coingecko: ContentBlockType<CoingeckoSpec, CoingeckoData> = {
  type: "coingecko",
  description: "Market data for a coin from CoinGecko. `id` defaults to the assessment's CoinGecko link.",
  schema,
  load: async (spec, ctx) => {
    const id = spec.id ?? idFromUrl(ctx.assessment?.data.links.find((l) => l.key === "coingecko")?.url);
    if (!id) return null;
    const c = await cgFetch<CgCoin>(`/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`);
    const m = c.market_data ?? {};
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      id: c.id,
      name: c.name,
      symbol: (c.symbol ?? "").toUpperCase(),
      url: `https://www.coingecko.com/en/coins/${c.id}`,
      image: c.image?.small ?? c.image?.thumb ?? null,
      updatedAt: c.last_updated ?? null,
      show: spec.show,
      values: {
        price: n(m.current_price?.usd),
        price_chf: n(m.current_price?.chf),
        change_24h: n(m.price_change_percentage_24h),
        change_7d: n(m.price_change_percentage_7d),
        change_30d: n(m.price_change_percentage_30d),
        market_cap: n(m.market_cap?.usd),
        fdv: n(m.fully_diluted_valuation?.usd),
        volume_24h: n(m.total_volume?.usd),
        ath: n(m.ath?.usd),
        ath_change: n(m.ath_change_percentage?.usd),
        circulating_supply: n(m.circulating_supply),
        total_supply: n(m.total_supply),
        rank: n(c.market_cap_rank),
      },
    };
  },
  Component: Block,
};

export default coingecko;
