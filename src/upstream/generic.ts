/**
 * SSRF-guarded fetch for URLs declared by assessment authors in content blocks.
 *
 *  - https only
 *  - hostname must not be an IP literal in a private/loopback/link-local range, and
 *    must not resolve (A/AAAA) to one
 *  - optional host allowlist (BLOCK_FETCH_ALLOWED_HOSTS)
 *  - short timeout, 1 MB cap, no retry, cached 5 min
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { config } from "@/config";
import { getOrLoad, TTL } from "@/lib/cache";
import { BlockedError } from "@/lib/errors";
import { fetchJson } from "./client";

const SOURCE = "content-block";

function isPrivateV4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224 // multicast / reserved
  );
}

function isPrivateV6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("fe80:") || s.startsWith("fc") || s.startsWith("fd")) return true;
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  return v4 ? isPrivateV4(v4[1]!) : false;
}

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  return kind === 4 ? isPrivateV4(ip) : kind === 6 ? isPrivateV6(ip) : true;
}

/** Validate a URL for outbound fetching. Throws BlockedError. Exported for tests. */
export async function assertSafeUrl(raw: string, { resolve = true }: { resolve?: boolean } = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedError(SOURCE, "Invalid URL");
  }
  if (url.protocol !== "https:") throw new BlockedError(SOURCE, "Only https:// URLs are allowed");
  if (url.username || url.password) throw new BlockedError(SOURCE, "Credentials in URLs are not allowed");

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new BlockedError(SOURCE, "Blocked host");
  }
  if (isIP(host) && isPrivateIp(host)) throw new BlockedError(SOURCE, "Blocked host (private address)");

  const allow = config.blockFetchAllowedHosts;
  if (allow.length && !allow.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new BlockedError(SOURCE, `Host not in allowlist: ${host}`);
  }

  if (resolve && !isIP(host)) {
    let addrs: { address: string }[];
    try {
      addrs = await lookup(host, { all: true });
    } catch {
      throw new BlockedError(SOURCE, `Host could not be resolved: ${host}`);
    }
    if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
      throw new BlockedError(SOURCE, "Blocked host (resolves to a private address)");
    }
  }
  return url;
}

export function safeFetchJson<T = unknown>(raw: string, ttlMs = 5 * TTL.MINUTE): Promise<T> {
  return getOrLoad(`generic:${raw}`, ttlMs, async () => {
    const url = await assertSafeUrl(raw);
    return fetchJson<T>(url.href, {
      source: SOURCE,
      timeoutMs: config.blockFetchTimeoutMs,
      maxBytes: config.blockFetchMaxBytes,
      retry: false,
    });
  }, { swrMs: 15 * TTL.MINUTE });
}

/** Resolve "a.b[0].c" or "a.b.0.c" against an object. */
export function getPath(obj: unknown, path: string | undefined | null): unknown {
  if (!path) return obj;
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}
