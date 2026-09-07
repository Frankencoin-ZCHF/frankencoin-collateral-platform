/**
 * Live protocol data per collateral, computed by grouping every minting position
 * (V1 + V2, from /positions/list) by collateral address and joining prices and
 * challenges. Ponder's aggregates are per chain, so this grouping is the only way to
 * get per-collateral figures.
 */

import { APP_URL } from "@/lib/constants";
import { chainName } from "@/lib/constants";
import { describeForLog } from "@/lib/errors";
import { fromWei, isoFromUnix, ppmToPercent, round, sum, weightedAverage } from "@/lib/numbers";
import { getOrLoad, TTL } from "@/lib/cache";
import * as api from "@/upstream/frankencoin";
import type { Challenge, LiveCollateral, Position } from "@/types";

export interface ProtocolSnapshot {
  byAddress: Map<string, LiveCollateral>;
  fetchedAt: string;
  /** Sources that failed (data for them is degraded, not missing entirely). */
  degraded: string[];
}

interface Inputs {
  positions: api.ApiPosition[];
  prices: api.ApiPrice[];
  collaterals: api.ApiCollateral[];
  challenges: api.ApiChallenge[];
  now?: number;
}

export function positionUrl(address: string): string {
  return `${APP_URL}/monitoring/${address}`;
}

function mapPosition(p: api.ApiPosition, decimals: number, priceChf: number | null): Position {
  const balance = fromWei(p.collateralBalance, decimals);
  const minted = fromWei(p.minted);
  const valueChf = priceChf !== null ? balance * priceChf : null;
  return {
    address: p.position,
    version: p.version,
    owner: p.owner,
    status: p.closed ? "closed" : p.denied ? "denied" : "active",
    isOriginal: Boolean(p.isOriginal),
    collateralBalance: balance,
    minted,
    availableForMinting: fromWei(p.availableForMinting ?? p.availableForPosition ?? "0"),
    availableForClones: fromWei(p.availableForClones),
    limitForClones: fromWei(p.limitForClones),
    liquidationPriceZchf: fromWei(p.price, 36 - decimals),
    riskPremiumPct: ppmToPercent(p.riskPremiumPPM ?? p.annualInterestPPM ?? 0),
    annualInterestPct: ppmToPercent(p.annualInterestPPM ?? p.riskPremiumPPM ?? 0),
    reserveContributionPct: ppmToPercent(p.reserveContribution),
    challengePeriodSeconds: Number(p.challengePeriod ?? 0),
    minimumCollateral: fromWei(p.minimumCollateral, decimals),
    createdAt: isoFromUnix(p.created),
    startAt: isoFromUnix(p.start),
    cooldownUntil: isoFromUnix(p.cooldown),
    expiresAt: isoFromUnix(p.expiration),
    collateralValueChf: valueChf !== null ? round(valueChf, 2) : null,
    collateralRatioPct: valueChf !== null && minted > 0 ? round((valueChf / minted) * 100, 1) : null,
    url: positionUrl(p.position),
  };
}

function mapChallenge(c: api.ApiChallenge, decimals: number, now: number): Challenge {
  const start = Number(c.start);
  const end = start + Number(c.duration);
  const status = c.status ?? "";
  const finished = /success|averted|ended|closed/i.test(status) || end < now;
  return {
    id: c.id ?? `${c.position}-challenge-${c.number}`,
    position: c.position,
    number: Number(c.number),
    challenger: c.challenger,
    status,
    version: c.version,
    startedAt: isoFromUnix(start),
    expiresAt: isoFromUnix(end),
    isActive: !finished,
    size: fromWei(c.size, decimals),
    filledSize: fromWei(c.filledSize, decimals),
    liquidationPriceZchf: fromWei(c.liqPrice, 36 - decimals),
    bids: Number(c.bids ?? 0),
    txHash: c.txHash,
  };
}

/** min/max plus a minted-weighted average (plain mean when nothing is minted yet). */
function stats(positions: Position[], pick: (p: Position) => number): { min: number; max: number; weightedAvg: number } | null {
  if (positions.length === 0) return null;
  const withMint = positions.filter((p) => p.minted > 0);
  const avg = withMint.length ? weightedAverage(withMint.map((p) => [pick(p), p.minted])) : sum(positions.map(pick)) / positions.length;
  return { ...range(positions.map(pick))!, weightedAvg: round(avg ?? 0, 3) };
}

function range(values: number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Pure: build the per-collateral map from raw API payloads. Exported for tests. */
export function buildSnapshot({ positions, prices, collaterals, challenges, now = Date.now() / 1000 }: Inputs): Map<string, LiveCollateral> {
  const priceMap = new Map<string, api.ApiPrice>();
  for (const p of prices) if (p.chainId === 1 || p.chainId === undefined) priceMap.set(p.address.toLowerCase(), p);

  const collateralMeta = new Map<string, api.ApiCollateral>();
  const listed = new Set<string>();
  for (const c of collaterals) {
    collateralMeta.set(c.address.toLowerCase(), c);
    listed.add(c.address.toLowerCase());
  }

  // Group positions by collateral; pick up metadata for collaterals the list doesn't know.
  const grouped = new Map<string, api.ApiPosition[]>();
  for (const p of positions) {
    const addr = p.collateral.toLowerCase();
    if (!grouped.has(addr)) grouped.set(addr, []);
    grouped.get(addr)!.push(p);
    if (!collateralMeta.has(addr)) {
      collateralMeta.set(addr, { chainId: 1, address: p.collateral, name: p.collateralName, symbol: p.collateralSymbol, decimals: p.collateralDecimals });
    }
  }

  const positionToCollateral = new Map<string, string>();
  for (const p of positions) positionToCollateral.set(p.position.toLowerCase(), p.collateral.toLowerCase());

  const challengesByCollateral = new Map<string, api.ApiChallenge[]>();
  for (const c of challenges) {
    const addr = positionToCollateral.get(c.position.toLowerCase());
    if (!addr) continue;
    if (!challengesByCollateral.has(addr)) challengesByCollateral.set(addr, []);
    challengesByCollateral.get(addr)!.push(c);
  }

  const out = new Map<string, LiveCollateral>();
  for (const [addr, meta] of collateralMeta) {
    const decimals = meta.decimals ?? 18;
    const priceEntry = priceMap.get(addr);
    const priceChf = typeof priceEntry?.price?.chf === "number" ? priceEntry.price.chf : null;
    const priceUsd = typeof priceEntry?.price?.usd === "number" ? priceEntry.price.usd : null;

    const list = (grouped.get(addr) ?? [])
      .map((p) => mapPosition(p, decimals, priceChf))
      .sort((a, b) => b.minted - a.minted || b.collateralBalance - a.collateralBalance);
    const active = list.filter((p) => p.status === "active");

    const totalCollateral = sum(active.map((p) => p.collateralBalance));
    const totalMinted = sum(active.map((p) => p.minted));
    const valueChf = priceChf !== null ? totalCollateral * priceChf : null;

    const chal = (challengesByCollateral.get(addr) ?? []).map((c) => mapChallenge(c, decimals, now)).sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));

    const expiries = active.map((p) => p.expiresAt).filter((d): d is string => d !== null && new Date(d).getTime() / 1000 > now).sort();

    out.set(addr, {
      address: addr,
      chainId: meta.chainId ?? 1,
      chainName: chainName(meta.chainId ?? 1),
      symbol: meta.symbol?.trim() || addr.slice(0, 8),
      name: meta.name?.trim() || `Unknown token ${addr.slice(0, 8)}`,
      decimals,
      listed: listed.has(addr),
      price:
        priceChf !== null && priceUsd !== null
          ? { chf: priceChf, usd: priceUsd, source: priceEntry?.source ?? null, timestamp: priceEntry?.timestamp ? new Date(priceEntry.timestamp).toISOString() : null }
          : null,
      positions: {
        total: list.length,
        active: active.length,
        closed: list.filter((p) => p.status === "closed").length,
        denied: list.filter((p) => p.status === "denied").length,
        list,
      },
      totalMintedZchf: round(totalMinted, 2),
      totalCollateral: round(totalCollateral, 6),
      collateralValueChf: valueChf !== null ? round(valueChf, 2) : null,
      availableForMintingZchf: round(sum(active.map((p) => p.availableForClones + p.availableForMinting)), 2),
      utilizationPct: valueChf && valueChf > 0 ? round((totalMinted / valueChf) * 100, 1) : null,
      riskPremiumPct: stats(active, (p) => p.riskPremiumPct),
      annualInterestPct: stats(active, (p) => p.annualInterestPct),
      reserveContributionPct: stats(active, (p) => p.reserveContributionPct),
      liquidationPriceZchf: range(active.map((p) => p.liquidationPriceZchf).filter((v) => v > 0)),
      challengePeriodSeconds: range(active.map((p) => p.challengePeriodSeconds).filter((v) => v > 0)),
      minimumCollateral: active.length ? Math.min(...active.map((p) => p.minimumCollateral)) : null,
      nextExpiry: expiries[0] ?? null,
      challenges: { total: chal.length, active: chal.filter((c) => c.isActive).length, list: chal },
      market: null,
    });
  }
  return out;
}

/** Cached snapshot from live endpoints. Positions are required; the rest degrade. */
export function snapshot(): Promise<ProtocolSnapshot> {
  return getOrLoad("svc:protocol:snapshot", TTL.MINUTE, async () => {
    const [positions, prices, collaterals, challenges] = await Promise.allSettled([
      api.positionList(),
      api.priceList(),
      api.collateralList(),
      api.challengeList(),
    ]);
    if (positions.status === "rejected") throw positions.reason;

    const degraded: string[] = [];
    const take = <T,>(r: PromiseSettledResult<T>, name: string, fallback: T): T => {
      if (r.status === "fulfilled") return r.value;
      degraded.push(name);
      console.error(`[protocol] ${name} failed: ${describeForLog(r.reason)}`);
      return fallback;
    };

    const byAddress = buildSnapshot({
      positions: positions.value.list ?? [],
      prices: take(prices, "prices", [] as api.ApiPrice[]),
      collaterals: take(collaterals, "collaterals", { num: 0, list: [] }).list ?? [],
      challenges: take(challenges, "challenges", { num: 0, list: [] }).list ?? [],
    });
    return { byAddress, fetchedAt: new Date().toISOString(), degraded };
  }, { swrMs: 5 * TTL.MINUTE });
}
