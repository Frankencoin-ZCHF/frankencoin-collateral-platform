/**
 * CoinGecko. With COINGECKO_API_KEY → Pro API; without → the public API, which is
 * rate-limited (~30 req/min) but fine behind a 5-minute cache. Never throws on
 * enrichment failures — callers get `null`.
 */

import { config } from "@/config";
import { getOrLoad, TTL } from "@/lib/cache";
import { CG_PRO_BASE, CG_PUBLIC_BASE } from "@/lib/constants";
import { describeForLog } from "@/lib/errors";
import { fetchJson } from "./client";

const SOURCE = "coingecko";

function base() {
  return config.coingeckoApiKey ? CG_PRO_BASE : CG_PUBLIC_BASE;
}

function headers(): Record<string, string> {
  return config.coingeckoApiKey ? { "x-cg-pro-api-key": config.coingeckoApiKey } : {};
}

export function cgFetch<T = unknown>(path: string, ttlMs = 5 * TTL.MINUTE): Promise<T> {
  return getOrLoad(`cg:${path}`, ttlMs, () => fetchJson<T>(`${base()}${path}`, { source: SOURCE, headers: headers() }), {
    swrMs: 30 * TTL.MINUTE,
  });
}

export interface SimplePrice {
  usd?: number;
  chf?: number;
  usd_market_cap?: number;
  usd_24h_change?: number;
  usd_24h_vol?: number;
}

/** Batch price lookup by CoinGecko ids. Returns {} on any failure. */
export async function simplePrice(ids: string[]): Promise<Record<string, SimplePrice>> {
  const unique = [...new Set(ids.filter(Boolean))].sort();
  if (unique.length === 0) return {};
  try {
    return await cgFetch<Record<string, SimplePrice>>(
      `/simple/price?ids=${encodeURIComponent(unique.join(","))}&vs_currencies=usd,chf&include_market_cap=true&include_24hr_change=true&include_24hr_vol=true`,
    );
  } catch (e) {
    console.error(`[coingecko] simple/price failed: ${describeForLog(e)}`);
    return {};
  }
}

/** Extract the coin id from a coingecko.com/en/coins/<id> URL. */
export function idFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /coingecko\.com\/[a-z]{2}\/coins\/([a-z0-9-]+)/i.exec(url);
  return m ? m[1]!.toLowerCase() : null;
}
