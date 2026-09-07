/**
 * ponder.frankencoin.com GraphQL client (on-chain indexed data). No auth.
 * Queries are fixed strings built in services — never from request input.
 * Ponder entities have no `id` field; use the entity-specific primary key.
 */

import { getOrLoad, TTL } from "@/lib/cache";
import { PONDER_BASE } from "@/lib/constants";
import { UpstreamError } from "@/lib/errors";
import { fetchJson } from "./client";

const SOURCE = "ponder";

export function ponderQuery<T = unknown>(query: string, ttlMs = TTL.MINUTE): Promise<T> {
  const key = `ponder:${hash(query)}`;
  return getOrLoad(key, ttlMs, async () => {
    const res = await fetchJson<{ data?: T; errors?: { message: string }[] }>(PONDER_BASE, {
      source: SOURCE,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      retry: false,
    });
    if (res.errors?.length) throw new UpstreamError(SOURCE, undefined, `ponder: ${res.errors.map((e) => e.message).join("; ")}`);
    if (!res.data) throw new UpstreamError(SOURCE, undefined, "ponder: empty response");
    return res.data;
  }, { swrMs: 5 * TTL.MINUTE });
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
