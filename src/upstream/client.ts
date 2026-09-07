/**
 * The one fetch wrapper. Timeout, single bounded retry on transient failures,
 * response-size cap, typed errors. Every upstream module goes through here.
 */

import { config } from "@/config";
import { TimeoutError, UpstreamError, NotFoundError } from "@/lib/errors";

export interface FetchOptions {
  source: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  retry?: boolean;
  /** Called with the raw Response before the body is consumed (rate-limit headers etc.). */
  onResponse?: (res: Response) => void;
}

/** Last-seen rate-limit info per source, for /health. */
export const rateLimits: Record<string, { remaining: number; reset: string | null; seenAt: string }> = {};

async function readBounded(res: Response, maxBytes: number, source: string): Promise<string> {
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new UpstreamError(source, res.status, `${source}: response too large (${len} bytes)`);
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel().catch(() => {});
      throw new UpstreamError(source, res.status, `${source}: response exceeded ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(concat(chunks, total));
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export async function fetchText(url: string, opts: FetchOptions): Promise<string> {
  const { source, method = "GET", headers = {}, body, timeoutMs = config.fetchTimeoutMs, maxBytes = config.fetchMaxBytes, retry = true } = opts;

  const attempt = async (): Promise<string> => {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { "User-Agent": "frankencoin-collateral-platform", ...headers },
        body,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
    } catch (e) {
      if ((e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError") throw new TimeoutError(source);
      throw new UpstreamError(source, undefined, `${source}: network error (${(e as Error)?.message ?? e})`);
    }

    const rem = res.headers.get("x-ratelimit-remaining");
    if (rem !== null) {
      const reset = res.headers.get("x-ratelimit-reset");
      rateLimits[source] = {
        remaining: Number(rem),
        reset: reset ? new Date(Number(reset) * 1000).toISOString() : null,
        seenAt: new Date().toISOString(),
      };
    }
    opts.onResponse?.(res);

    if (res.status === 404) throw new NotFoundError(source, url.split("?")[0]?.split("/").slice(-2).join("/"));
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw new UpstreamError(source, res.status, `${source}: HTTP ${res.status}`);
    }
    return readBounded(res, maxBytes, source);
  };

  try {
    return await attempt();
  } catch (e) {
    const transient = e instanceof TimeoutError || (e instanceof UpstreamError && (e.status === undefined || e.status >= 500));
    if (retry && transient && method === "GET") return attempt();
    throw e;
  }
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions): Promise<T> {
  const text = await fetchText(url, { ...opts, headers: { Accept: "application/json", ...(opts.headers ?? {}) } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(opts.source, undefined, `${opts.source}: response is not JSON`);
  }
}
