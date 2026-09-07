/**
 * api.frankencoin.com REST client. No auth. Cached at this boundary so one
 * /positions/list fetch serves every page in the TTL window.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "@/config";
import { getOrLoad, TTL } from "@/lib/cache";
import { API_BASE } from "@/lib/constants";
import { fetchJson } from "./client";

/** Offline / test environment: serve JSON fixtures (test/fixtures) instead of the live API. */
const FIXTURE_FILES: Record<string, string> = {
  "/ecosystem/collateral/list": "collaterals.json",
  "/ecosystem/collateral/stats": "stats.json",
  "/prices/list": "prices.json",
  "/positions/list": "positions.json",
  "/challenges/list": "challenges.json",
};

async function fixture<T>(path: string): Promise<T> {
  const file = FIXTURE_FILES[path];
  if (!file) throw new Error(`no fixture for ${path}`);
  return JSON.parse(await readFile(join(config.protocolFixturesDir, file), "utf8")) as T;
}

const SOURCE = "frankencoin-api";

const TTLS: Record<string, { ttl: number; swr: number }> = {
  "/ecosystem/collateral/list": { ttl: TTL.HOUR, swr: 6 * TTL.HOUR },
};
const DEFAULT_TTL = { ttl: TTL.MINUTE, swr: 5 * TTL.MINUTE };

export function apiFetch<T = unknown>(path: string): Promise<T> {
  if (config.protocolFixturesDir) return fixture<T>(path);
  const { ttl, swr } = TTLS[path] ?? DEFAULT_TTL;
  return getOrLoad(`fc:${path}`, ttl, () => fetchJson<T>(`${API_BASE}${path}`, { source: SOURCE }), { swrMs: swr });
}

// ── Response shapes (only the fields we use) ────────────────────────────────

export interface ApiCollateral {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface ApiPrice {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: { chf?: number; usd?: number } | null;
  source: string | null;
  timestamp: number | null;
}

export interface ApiPosition {
  version: 1 | 2;
  position: string;
  owner: string;
  zchf: string;
  collateral: string;
  price: string;
  created: number;
  isOriginal: boolean;
  isClone: boolean;
  denied: boolean;
  denyDate: number;
  closed: boolean;
  original: string;
  minimumCollateral: string;
  riskPremiumPPM?: number;
  annualInterestPPM?: number;
  reserveContribution: number;
  start: number;
  cooldown: number;
  expiration: number;
  challengePeriod: number;
  collateralName: string;
  collateralSymbol: string;
  collateralDecimals: number;
  collateralBalance: string;
  limitForClones: string;
  availableForClones: string;
  availableForPosition?: string;
  availableForMinting?: string;
  minted: string;
}

export interface ApiChallenge {
  id?: string;
  position: string;
  number: string;
  txHash: string;
  challenger: string;
  start: string;
  created: string;
  duration: string;
  size: string;
  liqPrice: string;
  bids: string;
  filledSize: string;
  acquiredCollateral: string;
  status: string;
  version: number;
}

/** Authoritative per-collateral aggregates (/ecosystem/collateral/stats). */
export interface ApiCollateralStats {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  positions: { total: number; open: number; requested: number; closed: number; denied: number; originals: number; clones: number };
  totalMinted: number;
  totalLimit: number;
  totalBalanceRaw: string;
  totalValueLocked: { usd: number; chf: number };
  price: { usd: number; chf: number };
}

export const collateralList = () => apiFetch<{ num: number; list: ApiCollateral[] }>("/ecosystem/collateral/list");
export const collateralStats = () =>
  apiFetch<{ num: number; addresses: string[]; totalValueLocked: { usd: number; chf: number }; map: Record<string, ApiCollateralStats> }>("/ecosystem/collateral/stats");
export const priceList = () => apiFetch<ApiPrice[]>("/prices/list");
export const positionList = () => apiFetch<{ num: number; list: ApiPosition[] }>("/positions/list");
export const challengeList = () => apiFetch<{ num: number; list: ApiChallenge[] }>("/challenges/list");
