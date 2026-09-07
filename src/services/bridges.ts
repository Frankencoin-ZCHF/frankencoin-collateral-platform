/**
 * Stablecoin bridges — the 1:1 minters (VCHF, CHFAU, formerly XCHF).
 *
 * A `StablecoinBridge` mints one ZCHF per unit of a trusted CHF stablecoin deposited into
 * the contract, up to `limit` outstanding, and only until its `horizon` (deployment
 * + 52 weeks). After the horizon minting reverts but burning ZCHF to redeem the source
 * stablecoin keeps working. There is no over-collateralisation, no oracle and no
 * liquidation: the risk is the source stablecoin's issuer / peg / freeze risk, capped at
 * the amount currently minted.
 *
 * Discovery: registered minters on Ethereum whose application message mentions "bridge"
 * (Ponder `frankencoinMinters`), then four eth_calls per bridge. Offline: bridges.json.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "@/config";
import { getOrLoad, TTL } from "@/lib/cache";
import { describeForLog } from "@/lib/errors";
import { fromWei, isoFromUnix, round } from "@/lib/numbers";
import { decodeAddress, decodeUint, ethCall, SELECTORS } from "@/upstream/eth";
import { ponderQuery } from "@/upstream/ponder";
import type { Bridge } from "@/types";

export interface BridgeRaw {
  bridge: string;
  message: string;
  appliedAt: number;
  txHash: string | null;
  ok: boolean;
  horizon: number | null;
  limitRaw: string | null;
  mintedRaw: string | null;
  chf: string | null;
}

interface MinterRow {
  chainId: number;
  minter: string;
  applyMessage: string;
  applyDate: string;
  denyDate: string;
  txHash: string;
}

async function readChain(m: MinterRow): Promise<BridgeRaw> {
  const [h, l, mi, c] = await Promise.all([
    ethCall(m.minter, SELECTORS["horizon()"]),
    ethCall(m.minter, SELECTORS["limit()"]),
    ethCall(m.minter, SELECTORS["minted()"]),
    ethCall(m.minter, SELECTORS["chf()"]),
  ]);
  const horizon = decodeUint(h);
  const limit = decodeUint(l);
  const minted = decodeUint(mi);
  const chf = decodeAddress(c);
  const ok = horizon !== null && limit !== null && minted !== null && chf !== null;
  return { bridge: m.minter.toLowerCase(), message: m.applyMessage, appliedAt: Number(m.applyDate), txHash: m.txHash ?? null, ok, horizon: ok ? Number(horizon) : null, limitRaw: ok ? limit!.toString() : null, mintedRaw: ok ? minted!.toString() : null, chf };
}

/** Raw bridge data: live (Ponder + RPC) or fixture. Cached 5 min. */
export function rawBridges(): Promise<BridgeRaw[]> {
  return getOrLoad("svc:bridges:raw", 5 * TTL.MINUTE, async () => {
    if (config.protocolFixturesDir) {
      return JSON.parse(await readFile(join(config.protocolFixturesDir, "bridges.json"), "utf8")) as BridgeRaw[];
    }
    const q = await ponderQuery<{ frankencoinMinters: { items: MinterRow[] } }>(
      `{ frankencoinMinters(limit: 100) { items { chainId minter applyMessage applyDate denyDate txHash } } }`,
      5 * TTL.MINUTE,
    );
    const minters = q.frankencoinMinters.items.filter((m) => m.chainId === 1 && /bridge/i.test(m.applyMessage) && !(m.denyDate && Number(m.denyDate) > 0));
    return Promise.all(minters.map(readChain));
  }, { swrMs: 30 * TTL.MINUTE });
}

/** Pure: raw → domain, keyed by the source stablecoin address. Exported for tests. */
export function buildBridges(raw: BridgeRaw[], now = Date.now() / 1000): Map<string, Bridge> {
  const out = new Map<string, Bridge>();
  for (const r of raw) {
    if (!r.ok || !r.chf) continue;
    const limit = fromWei(r.limitRaw!);
    const minted = fromWei(r.mintedRaw!);
    const expired = r.horizon !== null && r.horizon < now;
    const daysLeft = r.horizon !== null ? Math.max(0, Math.floor((r.horizon - now) / 86400)) : null;
    const b: Bridge = {
      address: r.bridge,
      name: r.message,
      stablecoin: r.chf,
      appliedAt: isoFromUnix(r.appliedAt),
      horizon: isoFromUnix(r.horizon),
      expired,
      daysLeft: expired ? 0 : daysLeft,
      limitZchf: round(limit, 2),
      mintedZchf: round(minted, 2),
      remainingZchf: expired ? 0 : round(Math.max(0, limit - minted), 2),
      limitUsedPct: limit > 0 ? round((minted / limit) * 100, 1) : null,
    };
    // The newest bridge per stablecoin wins (bridges are replaced after their horizon).
    const existing = out.get(r.chf);
    if (!existing || (existing.expired && !b.expired) || (existing.expired === b.expired && (b.appliedAt ?? "") > (existing.appliedAt ?? ""))) out.set(r.chf, b);
  }
  return out;
}

export async function bridgesByStablecoin(): Promise<Map<string, Bridge>> {
  try {
    return buildBridges(await rawBridges());
  } catch (e) {
    console.error(`[bridges] ${describeForLog(e)}`);
    return new Map();
  }
}
