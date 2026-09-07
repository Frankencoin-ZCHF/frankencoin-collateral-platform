/**
 * Ethereum JSON-RPC (public endpoints, first one that answers). Used for the few contract
 * reads the API does not expose (StablecoinBridge horizon/limit/minted/chf). Best effort:
 * failures resolve to null and are negative-cached for a short while.
 */

import { getOrLoad, TTL } from "@/lib/cache";
import { ETH_RPCS } from "@/lib/constants";
import { fetchJson } from "./client";

const SOURCE = "eth";

let preferred: string | null = null;

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const order = preferred ? [preferred, ...ETH_RPCS.filter((u) => u !== preferred)] : ETH_RPCS;
  let lastErr: unknown = null;
  for (const url of order) {
    try {
      const res = await fetchJson<{ result?: unknown; error?: { message: string } }>(url, {
        source: SOURCE,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        timeoutMs: 8_000,
        retry: false,
      });
      if (res.error) throw new Error(res.error.message);
      preferred = url;
      return res.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all RPCs failed");
}

/** eth_call returning the raw hex result, or null on any failure (negative-cached 2 min). */
export function ethCall(to: string, data: string): Promise<string | null> {
  return getOrLoad(`eth:${to.toLowerCase()}:${data}`, 5 * TTL.MINUTE, async () => {
    try {
      const r = await rpc("eth_call", [{ to, data }, "latest"]);
      return typeof r === "string" && r.startsWith("0x") ? r : null;
    } catch {
      return null;
    }
  });
}

/** 4-byte selectors (keccak256 of the signature) — verified by test/bridges.test.ts. */
export const SELECTORS = {
  "horizon()": "0x1ce832b5",
  "limit()": "0xa4d66daf",
  "minted()": "0x4f02c420",
  "chf()": "0x37b272b0",
} as const;

export function decodeUint(hex: string | null): bigint | null {
  return hex && /^0x[0-9a-f]{64}$/i.test(hex) ? BigInt(hex) : null;
}

export function decodeAddress(hex: string | null): string | null {
  return hex && /^0x[0-9a-f]{64}$/i.test(hex) ? `0x${hex.slice(26).toLowerCase()}` : null;
}
