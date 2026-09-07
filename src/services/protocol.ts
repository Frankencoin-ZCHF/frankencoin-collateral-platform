/**
 * Live protocol data per collateral.
 *
 * Headline figures (minted, aggregate limit, remaining capacity, position counts, TVL)
 * come from the protocol's authoritative aggregate endpoint, /ecosystem/collateral/stats.
 * The position feed (/positions/list, V1 + V2) is grouped by collateral for the position
 * table and for position-safety metrics, and is reconciled against the aggregate: any
 * material divergence is flagged rather than hidden.
 *
 * Never derive protocol-wide capacity by summing position-level clone fields: every clone
 * repeats its parent's availableForClones, so the sum overstates by the number of clones.
 */

import { APP_URL, chainName } from "@/lib/constants";
import { describeForLog } from "@/lib/errors";
import { fromWei, isoFromUnix, ppmToPercent, round, sum, weightedAverage } from "@/lib/numbers";
import { getOrLoad, TTL } from "@/lib/cache";
import * as api from "@/upstream/frankencoin";
import type { Bridge, Challenge, LiveCollateral, Position, PositionCounts, PositionSafety, Reconciliation } from "@/types";
import { bridgesByStablecoin } from "./bridges";

export interface ProtocolSnapshot {
  byAddress: Map<string, LiveCollateral>;
  fetchedAt: string;
  /** Sources that failed (data for them is degraded, not missing entirely). */
  degraded: string[];
  /** Protocol-wide TVL from the aggregate endpoint. */
  totalValueLockedChf: number | null;
  /** Challenges whose position is not in the position feed (still real liquidation events). */
  unmatchedChallenges: Challenge[];
}

export interface Inputs {
  positions: api.ApiPosition[];
  prices: api.ApiPrice[];
  collaterals: api.ApiCollateral[];
  challenges: api.ApiChallenge[];
  stats: Record<string, api.ApiCollateralStats> | null;
  /** 1:1 stablecoin bridges keyed by source-stablecoin address. */
  bridges?: Map<string, Bridge>;
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

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Exported for tests. */
export function computeSafety(active: Position[], priceChf: number | null): PositionSafety | null {
  if (priceChf === null || priceChf <= 0) return null;
  const considered = active.filter((p) => p.minted > 0 && p.liquidationPriceZchf > 0);
  if (considered.length === 0) return null;
  const buffers = considered.map((p) => ({ p, bufferPct: ((priceChf - p.liquidationPriceZchf) / priceChf) * 100 }));
  const within = (pct: number) => round(sum(buffers.filter((b) => b.bufferPct <= pct).map((b) => b.p.minted)), 2);
  const ratio = weightedAverage(considered.filter((p) => p.collateralRatioPct !== null).map((p) => [p.collateralRatioPct!, p.minted]));
  return {
    weightedCollateralRatioPct: ratio === null ? null : round(ratio, 1),
    minLiquidationBufferPct: round(Math.min(...buffers.map((b) => b.bufferPct)), 1),
    medianLiquidationBufferPct: round(median(buffers.map((b) => b.bufferPct)) ?? 0, 1),
    debtWithin: { pct5: within(5), pct10: within(10), pct20: within(20) },
    positionsConsidered: considered.length,
  };
}

/** Challenges that could not be attributed to a collateral in the last buildSnapshot() (module-level, read by snapshot()). */
export const unmatched: Challenge[] = [];

/** Pure: build the per-collateral map from raw API payloads. Exported for tests. */
export function buildSnapshot({ positions, prices, collaterals, challenges, stats: statsMap, bridges = new Map(), now = Date.now() / 1000 }: Inputs): Map<string, LiveCollateral> {
  const priceMap = new Map<string, api.ApiPrice>();
  for (const p of prices) if (p.chainId === 1 || p.chainId === undefined) priceMap.set(p.address.toLowerCase(), p);

  // Metadata: the aggregate endpoint first, then the list, then whatever the position feed says.
  const meta = new Map<string, api.ApiCollateral>();
  const listed = new Set<string>();
  const statsByAddr = new Map<string, api.ApiCollateralStats>();
  for (const [addr, s] of Object.entries(statsMap ?? {})) {
    const a = addr.toLowerCase();
    statsByAddr.set(a, s);
    meta.set(a, { chainId: s.chainId, address: s.address, name: s.name, symbol: s.symbol, decimals: s.decimals });
    listed.add(a);
  }
  for (const c of collaterals) {
    const a = c.address.toLowerCase();
    if (!meta.has(a)) meta.set(a, c);
    listed.add(a);
  }

  const grouped = new Map<string, api.ApiPosition[]>();
  for (const p of positions) {
    const addr = p.collateral.toLowerCase();
    if (!grouped.has(addr)) grouped.set(addr, []);
    grouped.get(addr)!.push(p);
    if (!meta.has(addr)) meta.set(addr, { chainId: 1, address: p.collateral, name: p.collateralName, symbol: p.collateralSymbol, decimals: p.collateralDecimals });
  }

  const positionToCollateral = new Map<string, string>();
  for (const p of positions) positionToCollateral.set(p.position.toLowerCase(), p.collateral.toLowerCase());
  const challengesByCollateral = new Map<string, api.ApiChallenge[]>();
  unmatched.length = 0;
  for (const c of challenges) {
    const addr = positionToCollateral.get(c.position.toLowerCase());
    if (!addr) {
      unmatched.push(mapChallenge(c, 18, now));
      continue;
    }
    if (!challengesByCollateral.has(addr)) challengesByCollateral.set(addr, []);
    challengesByCollateral.get(addr)!.push(c);
  }

  const out = new Map<string, LiveCollateral>();
  for (const [addr, m] of meta) {
    const decimals = m.decimals ?? 18;
    const s = statsByAddr.get(addr) ?? null;
    const priceEntry = priceMap.get(addr);
    const priceChf = typeof priceEntry?.price?.chf === "number" ? priceEntry.price.chf : typeof s?.price?.chf === "number" ? s.price.chf : null;
    const priceUsd = typeof priceEntry?.price?.usd === "number" ? priceEntry.price.usd : typeof s?.price?.usd === "number" ? s.price.usd : null;

    const bridge = bridges.get(addr) ?? null;
    const list = (grouped.get(addr) ?? [])
      .map((p) => mapPosition(p, decimals, priceChf))
      .sort((a, b) => b.minted - a.minted || b.collateralBalance - a.collateralBalance);
    const active = list.filter((p) => p.status === "active");

    const mintedFromPositions = round(sum(active.map((p) => p.minted)), 2);
    const collateralFromPositions = sum(active.map((p) => p.collateralBalance));

    // Headline figures: aggregate endpoint when present, position feed otherwise.
    // For a 1:1 bridge the contract itself is authoritative (minted / limit / horizon).
    const totalMinted = bridge ? bridge.mintedZchf : s ? s.totalMinted : mintedFromPositions;
    const totalLimit = bridge ? bridge.limitZchf : s ? s.totalLimit : null;
    const totalCollateral = s ? fromWei(s.totalBalanceRaw, decimals) : collateralFromPositions;
    const valueChf = s ? s.totalValueLocked.chf : priceChf !== null ? collateralFromPositions * priceChf : null;

    const counts: PositionCounts | null = s ? { ...s.positions } : null;
    const expected = counts ? counts.open : null;
    // Bridges have no positions in the feed by design — the aggregate models them as one pseudo-position.
    const mintedDiverges = !bridge && s ? Math.abs(s.totalMinted - mintedFromPositions) > Math.max(1, s.totalMinted) * 0.01 : false;
    const countDiverges = !bridge && expected !== null && expected !== active.length;
    const reconciliation: Reconciliation = {
      aggregateSource: s ? "stats" : "positions",
      positionsInFeed: active.length,
      positionsExpected: expected,
      mintedFromPositions,
      mintedFromStats: s ? s.totalMinted : null,
      divergent: mintedDiverges || countDiverges,
      note: countDiverges
        ? `The protocol reports ${expected} open position${expected === 1 ? "" : "s"} but the position feed lists ${active.length}; headline figures use the protocol aggregate.`
        : mintedDiverges
          ? `Minted ZCHF differs between the aggregate (${round(s!.totalMinted, 0)}) and the position feed (${round(mintedFromPositions, 0)}); headline figures use the aggregate.`
          : null,
    };

    const chal = (challengesByCollateral.get(addr) ?? []).map((c) => mapChallenge(c, decimals, now)).sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
    const expiries = active.map((p) => p.expiresAt).filter((d): d is string => d !== null && new Date(d).getTime() / 1000 > now).sort();

    out.set(addr, {
      bridge,
      address: addr,
      chainId: m.chainId ?? 1,
      chainName: chainName(m.chainId ?? 1),
      symbol: m.symbol?.trim() || addr.slice(0, 8),
      name: m.name?.trim() || `Unknown token ${addr.slice(0, 8)}`,
      decimals,
      listed: listed.has(addr),
      price:
        priceChf !== null && priceUsd !== null
          ? { chf: priceChf, usd: priceUsd, source: priceEntry?.source ?? (s ? "protocol-aggregate" : null), timestamp: priceEntry?.timestamp ? new Date(priceEntry.timestamp).toISOString() : null }
          : null,
      positions: {
        total: list.length,
        active: active.length,
        closed: list.filter((p) => p.status === "closed").length,
        denied: list.filter((p) => p.status === "denied").length,
        list,
      },
      counts,
      totalMintedZchf: round(totalMinted, 2),
      totalLimitZchf: totalLimit !== null ? round(totalLimit, 2) : null,
      remainingLimitZchf: bridge ? bridge.remainingZchf : totalLimit !== null ? round(Math.max(0, totalLimit - totalMinted), 2) : null,
      totalCollateral: round(totalCollateral, 6),
      collateralValueChf: valueChf !== null ? round(valueChf, 2) : null,
      utilizationPct: bridge ? null : valueChf && valueChf > 0 ? round((totalMinted / valueChf) * 100, 1) : null,
      reconciliation,
      safety: bridge ? null : computeSafety(active, priceChf),
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

/** Cached snapshot from live endpoints. Positions are required; the rest degrade (stats degrading is flagged loudly). */
export function snapshot(): Promise<ProtocolSnapshot> {
  return getOrLoad("svc:protocol:snapshot", TTL.MINUTE, async () => {
    const [positions, prices, collaterals, challenges, statsRes, bridgesRes] = await Promise.allSettled([
      api.positionList(),
      api.priceList(),
      api.collateralList(),
      api.challengeList(),
      api.collateralStats(),
      bridgesByStablecoin(),
    ]);
    if (positions.status === "rejected") throw positions.reason;

    const degraded: string[] = [];
    const take = <T,>(r: PromiseSettledResult<T>, name: string, fallback: T): T => {
      if (r.status === "fulfilled") return r.value;
      degraded.push(name);
      console.error(`[protocol] ${name} failed: ${describeForLog(r.reason)}`);
      return fallback;
    };

    const statsPayload = take(statsRes, "collateral-stats", null as null | Awaited<ReturnType<typeof api.collateralStats>>);
    const byAddress = buildSnapshot({
      positions: positions.value.list ?? [],
      prices: take(prices, "prices", [] as api.ApiPrice[]),
      collaterals: take(collaterals, "collaterals", { num: 0, list: [] }).list ?? [],
      challenges: take(challenges, "challenges", { num: 0, list: [] }).list ?? [],
      stats: statsPayload?.map ?? null,
      bridges: take(bridgesRes, "bridges", new Map<string, Bridge>()),
    });
    return { byAddress, fetchedAt: new Date().toISOString(), degraded, totalValueLockedChf: statsPayload?.totalValueLocked?.chf ?? null, unmatchedChallenges: [...unmatched] };
  }, { swrMs: 5 * TTL.MINUTE });
}
