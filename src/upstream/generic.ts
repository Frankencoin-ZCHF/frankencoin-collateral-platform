/**
 * SSRF-guarded fetch for URLs declared by assessment authors in content blocks.
 *
 *  - https only, no credentials, no localhost/.internal/.local
 *  - host allowlist: BLOCK_FETCH_ALLOWED_HOSTS, or a built-in list of known public data
 *    hosts in production (open in development)
 *  - private/loopback/link-local/CGNAT addresses are rejected both for IP literals and —
 *    via a custom undici connector — for every address DNS resolves to *at connection
 *    time*, on every hop (closes the DNS-rebinding and resolve-then-connect gaps)
 *  - redirects are NOT followed automatically: each Location is re-validated (max 3 hops)
 *  - short timeout, 1 MB cap, no retry, cached 5 min
 */

import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { config } from "@/config";
import { getOrLoad, TTL } from "@/lib/cache";
import { BlockedError, TimeoutError, UpstreamError } from "@/lib/errors";
import { readBounded } from "./client";

const SOURCE = "content-block";
const MAX_REDIRECTS = 3;

/** Public data hosts allowed by default in production. Extend with BLOCK_FETCH_ALLOWED_HOSTS. */
export const DEFAULT_ALLOWED_HOSTS = [
  "api.frankencoin.com",
  "ponder.frankencoin.com",
  "api.llama.fi",
  "coins.llama.fi",
  "stablecoins.llama.fi",
  "api.coingecko.com",
  "pro-api.coingecko.com",
  "eth-api.lido.fi",
  "api.github.com",
  "raw.githubusercontent.com",
  "api.dune.com",
  "api.etherscan.io",
];

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

export function allowedHosts(): string[] | null {
  if (config.blockFetchAllowedHosts.length) return config.blockFetchAllowedHosts;
  return config.isProduction ? DEFAULT_ALLOWED_HOSTS : null; // null = any public host
}

export function isAllowedHost(host: string): boolean {
  const allow = allowedHosts();
  if (!allow) return true;
  return allow.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Validate a URL for outbound fetching (no DNS — DNS is checked by the connector). Throws BlockedError. */
export function assertSafeUrl(raw: string): URL {
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
  if (!isAllowedHost(host)) throw new BlockedError(SOURCE, `Host not in allowlist: ${host}`);
  return url;
}

/**
 * DNS lookup used by the connector: resolves, then refuses to connect if ANY returned
 * address is private. Honours the `all` option the way net.connect expects.
 */
type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | { address: string; family: number }[], family?: number) => void;

export function guardedLookup(hostname: string, options: { all?: boolean; family?: number; hints?: number }, callback: LookupCb): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return callback(err);
    const list = (Array.isArray(addrs) ? addrs : []) as { address: string; family: number }[];
    if (list.length === 0) return callback(Object.assign(new Error(`no address for ${hostname}`), { code: "ENOTFOUND" }));
    if (list.some((a) => isPrivateIp(a.address))) {
      return callback(Object.assign(new Error(`blocked: ${hostname} resolves to a private address`), { code: "EBLOCKED" }));
    }
    if (options.all) return callback(null, list);
    const first = list[0]!;
    return callback(null, first.address, first.family);
  });
}

const agent = new Agent({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connect: { lookup: guardedLookup as any, timeout: config.blockFetchTimeoutMs },
});

/** Fetch with per-hop validation. Returns the final Response (never followed blindly). */
export async function safeFetch(raw: string): Promise<Response> {
  let url = assertSafeUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = (await undiciFetch(url.href, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "frankencoin-collateral-platform" },
        redirect: "manual",
        dispatcher: agent,
        signal: AbortSignal.timeout(config.blockFetchTimeoutMs),
      })) as unknown as Response;
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      const cause = err.cause?.code ?? err.cause?.message ?? "";
      if (/EBLOCKED|private address/.test(cause) || /private address/.test(err.message)) throw new BlockedError(SOURCE, "Blocked host (resolves to a private address)");
      if (err.name === "TimeoutError" || err.name === "AbortError") throw new TimeoutError(SOURCE);
      throw new UpstreamError(SOURCE, undefined, `${SOURCE}: network error (${cause || err.message})`);
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      res.body?.cancel().catch(() => {});
      if (!loc) throw new UpstreamError(SOURCE, res.status, `${SOURCE}: redirect without location`);
      if (hop === MAX_REDIRECTS) throw new BlockedError(SOURCE, "Too many redirects");
      url = assertSafeUrl(new URL(loc, url).href); // re-validated every hop
      continue;
    }
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw new UpstreamError(SOURCE, res.status, `${SOURCE}: HTTP ${res.status}`);
    }
    return res;
  }
  throw new BlockedError(SOURCE, "Too many redirects");
}

export function safeFetchJson<T = unknown>(raw: string, ttlMs = 5 * TTL.MINUTE): Promise<T> {
  return getOrLoad(`generic:${raw}`, ttlMs, async () => {
    const res = await safeFetch(raw);
    const text = await readBounded(res, config.blockFetchMaxBytes, SOURCE);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new UpstreamError(SOURCE, undefined, `${SOURCE}: response is not JSON`);
    }
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
