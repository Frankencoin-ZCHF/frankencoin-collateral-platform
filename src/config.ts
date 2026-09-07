/**
 * Runtime configuration. Read from the environment ONCE, defaults applied, frozen.
 * Nothing is required to boot — a missing secret only degrades the feature that needs it.
 *
 * `process.env` (not `import.meta.env`) so values injected at runtime by the host
 * (Railway, Docker) are picked up by the standalone Node server.
 */

function env(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return !["0", "false", "no", "off"].includes(v.toLowerCase());
}

function envList(name: string): string[] {
  return env(name)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const config = Object.freeze({
  site: env("SITE", "https://collateral.frankencoin.com"),
  /** Production build (Vite sets import.meta.env.PROD at build time). Tightens CSP and the block-fetch allowlist. */
  isProduction: Boolean(import.meta.env?.PROD) || process.env.NODE_ENV === "production",

  /** GitHub token — optional. Enables discussions (GraphQL) and the 5000 req/h REST quota. */
  githubToken: env("GITHUB_TOKEN"),
  assessmentsRepo: env("ASSESSMENTS_REPO", "Frankencoin-ZCHF/frankencoin-collateral-assessments"),
  assessmentsRef: env("ASSESSMENTS_REF", "main"),
  discussionsRepo: env("DISCUSSIONS_REPO", "Frankencoin-ZCHF/Frankencoin"),

  /** CoinGecko Pro key — optional. */
  coingeckoApiKey: env("COINGECKO_API_KEY"),

  /** Host allowlist for author-declared URLs in content blocks. Empty = any public https host. */
  blockFetchAllowedHosts: envList("BLOCK_FETCH_ALLOWED_HOSTS"),

  cacheEnabled: envBool("CACHE_ENABLED", true),
  cacheMaxEntries: 2000,

  /** Upstream fetch defaults. */
  fetchTimeoutMs: 10_000,
  fetchMaxBytes: 5 * 1024 * 1024,
  /** Content-block fetches are stricter. */
  blockFetchTimeoutMs: 5_000,
  blockFetchMaxBytes: 1024 * 1024,
});

export type Config = typeof config;
