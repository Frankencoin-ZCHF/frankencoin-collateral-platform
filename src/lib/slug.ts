/** Ticker ⇄ URL slug and route-parameter validation. */

export function slugFromTicker(ticker: string): string {
  return ticker.trim().toLowerCase();
}

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/;
const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

export function isValidSlug(v: unknown): v is string {
  return typeof v === "string" && SLUG_RE.test(v);
}

export function isValidSha(v: unknown): v is string {
  return typeof v === "string" && SHA_RE.test(v);
}

export function normalizeAddress(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const a = v.trim().toLowerCase();
  return ADDRESS_RE.test(a) ? a : null;
}

export function normalizeSha(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return SHA_RE.test(s) ? s : null;
}
