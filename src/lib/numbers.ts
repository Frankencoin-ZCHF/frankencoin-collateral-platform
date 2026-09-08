/**
 * Number decoding + formatting. Decoding mirrors frankencoin-mcp/src/lib/numbers.js.
 *
 *  - Token amounts from the API/Ponder are BigInt strings → fromWei(v, decimals)
 *  - Position liquidation prices are 36 - decimals scaled → fromWei(price, 36 - decimals)
 *  - riskPremiumPPM / reserveContribution are parts-per-million → ppmToPercent
 *  - Assessment frontmatter mixes "16.98%" strings and 0.25 fractions → parsePercent / fractionToPercent
 */

export function fromWei(value: string | number | bigint | null | undefined, decimals = 18): number {
  if (value === null || value === undefined || value === "") return 0;
  let big: bigint;
  try {
    big = typeof value === "bigint" ? value : BigInt(typeof value === "number" ? Math.trunc(value) : String(value).split(".")[0] ?? "0");
  } catch {
    return 0;
  }
  const neg = big < 0n;
  if (neg) big = -big;
  const s = big.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, s.length - decimals) || "0";
  const fracPart = s.slice(s.length - decimals);
  const n = Number(`${intPart}.${fracPart}`);
  return neg ? -n : n;
}

export function ppmToPercent(ppm: number | string | null | undefined): number {
  return round(Number(ppm ?? 0) / 10_000, 4);
}

export function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** "16.98%" → 16.98 ; "0.25 %" → 0.25 ; "n/a" → null ; 12 → 12 */
export function parsePercent(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s+/g, "").replace("%", "").replace(",", ".");
  if (s === "" || /^n\/?a$/i.test(s) || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Frontmatter fractions (0.25) → percent (25). Values > 1 are assumed to already be percents. */
export function fractionToPercent(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace("%", ""));
  if (!Number.isFinite(n)) return null;
  return round(Math.abs(n) <= 1 ? n * 100 : n, 4);
}

export function isoFromUnix(sec: number | string | null | undefined): string | null {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) return null; // 1e12 guards the "cooldown = 2^256" sentinel
  return new Date(n * 1000).toISOString();
}

export function dateFromUnix(sec: number | string | null | undefined): string | null {
  return isoFromUnix(sec)?.slice(0, 10) ?? null;
}

// ── Formatting (Swiss style: 1'234'567.89) ──────────────────────────────────

export function formatNumber(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  const fixed = n.toFixed(dp);
  const [int, frac] = fixed.split(".");
  const grouped = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return frac !== undefined && dp > 0 ? `${grouped}.${frac}` : grouped;
}

export function formatChf(n: number | null | undefined, dp = 2): string {
  const s = formatNumber(n, dp);
  return s === "–" ? s : `${s} CHF`;
}

export function formatCompact(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${formatNumber(n / 1e9, dp)}B`;
  if (abs >= 1e6) return `${formatNumber(n / 1e6, dp)}M`;
  if (abs >= 1e3) return `${formatNumber(n / 1e3, dp)}k`;
  return formatNumber(n, abs < 1 ? 4 : dp);
}

export function formatPercent(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return `${formatNumber(n, dp)}%`;
}

/** Adaptive precision for token prices: 1234.5 → "1'234.50", 0.0123 → "0.0123". */
export function formatPrice(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  const abs = Math.abs(n);
  const dp = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return formatNumber(n, dp);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return "–";
  const h = seconds / 3600;
  if (h < 48) return `${round(h, 1)} h`;
  return `${round(h / 24, 1)} d`;
}

export function shortAddress(addr: string | null | undefined, chars = 4): string {
  if (!addr) return "–";
  return addr.length > 2 * chars + 2 ? `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}` : addr;
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (typeof v === "number" && Number.isFinite(v) ? v : 0), 0);
}

export function weightedAverage(pairs: Array<[value: number, weight: number]>): number | null {
  const w = sum(pairs.map(([, wt]) => wt));
  if (w <= 0) return null;
  return sum(pairs.map(([v, wt]) => v * wt)) / w;
}
