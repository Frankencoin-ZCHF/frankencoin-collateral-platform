/**
 * In-memory TTL cache with single-flight coalescing, stale-while-revalidate and an
 * LRU bound. Port of frankencoin-mcp/src/cache.js. Applied at the upstream boundary
 * so one upstream fetch is shared by every page that needs it. Non-authoritative —
 * wiped on restart.
 */

import { config } from "@/config";

interface Entry<T> {
  value: T | undefined;
  expiresAt: number;
  staleUntil: number;
  inflight: Promise<T> | null;
  lastUsed: number;
}

const store = new Map<string, Entry<unknown>>();

const now = () => Date.now();

function evictIfNeeded() {
  const cap = config.cacheMaxEntries;
  while (store.size > cap) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

function lazyPurge() {
  const t = now();
  let checked = 0;
  for (const [key, entry] of store) {
    if (checked++ >= 8) break;
    if (!entry.inflight && t >= entry.expiresAt && t >= entry.staleUntil) store.delete(key);
  }
}

function touch(key: string, entry: Entry<unknown>) {
  entry.lastUsed = now();
  store.delete(key);
  store.set(key, entry);
}

/**
 * Get a fresh cached value or load it.
 *  1. Fresh hit      → value
 *  2. In-flight      → await the existing promise
 *  3. SWR stale      → stale value now, revalidate in background
 *  4. Miss / expired → load (errors are never cached)
 */
export async function getOrLoad<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  { swrMs = 0 }: { swrMs?: number } = {},
): Promise<T> {
  if (!config.cacheEnabled) return loader();

  const t = now();
  const entry = store.get(key) as Entry<T> | undefined;

  if (entry) {
    if (entry.value !== undefined && t < entry.expiresAt) {
      touch(key, entry);
      return entry.value;
    }
    if (entry.inflight) return entry.inflight;
    if (entry.value !== undefined && swrMs > 0 && t < entry.staleUntil) {
      touch(key, entry);
      entry.inflight = loader()
        .then((value) => {
          entry.value = value;
          entry.expiresAt = now() + ttlMs;
          entry.staleUntil = now() + ttlMs + swrMs;
          return value;
        })
        .catch((err) => {
          console.error(`[cache] background revalidate failed for ${key}: ${err?.name ?? err}`);
          return entry.value as T;
        })
        .finally(() => {
          entry.inflight = null;
        });
      return entry.value;
    }
  }

  lazyPurge();

  const rec: Entry<T> = entry ?? { value: undefined, expiresAt: 0, staleUntil: 0, inflight: null, lastUsed: t };
  rec.inflight = loader()
    .then((value) => {
      rec.value = value;
      rec.expiresAt = now() + ttlMs;
      rec.staleUntil = swrMs > 0 ? now() + ttlMs + swrMs : 0;
      return value;
    })
    .finally(() => {
      rec.inflight = null;
    });

  store.set(key, rec);
  touch(key, rec);
  evictIfNeeded();

  return rec.inflight;
}

export function invalidate(key: string) {
  store.delete(key);
}

export function invalidatePrefix(prefix: string) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}

export function clear() {
  store.clear();
}

export function size() {
  return store.size;
}

export const TTL = {
  SECOND: 1_000,
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
} as const;
