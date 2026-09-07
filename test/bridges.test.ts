import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { buildBridges, type BridgeRaw } from "@/services/bridges";
import { SELECTORS, decodeAddress, decodeUint } from "@/upstream/eth";
import { buildSnapshot, type Inputs } from "@/services/protocol";
import { deriveLifecycle, join, summarize } from "@/services/collaterals";
import { itemsFor } from "@/services/attention";

const json = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const raw: BridgeRaw[] = json("bridges.json");
const NOW = 1_788_800_000; // 2026-09-07
const CHFAU = "0xbd4dfc058eb95b8de5ceaf39966a1a70f5556f78";
const VCHF = "0x79d4f0232a66c4c91b89c76362016a1707cfbf4f";

describe("eth selectors", () => {
  it("match keccak256 of the StablecoinBridge signatures", () => {
    for (const [sig, sel] of Object.entries(SELECTORS)) {
      const h = "0x" + Buffer.from(keccak_256(new TextEncoder().encode(sig))).toString("hex").slice(0, 8);
      expect(h, sig).toBe(sel);
    }
    expect(decodeUint("0x" + "1".padStart(64, "0"))).toBe(1n);
    expect(decodeAddress("0x" + "ab".padStart(64, "0"))).toBe("0x00000000000000000000000000000000000000ab");
    expect(decodeUint(null)).toBeNull();
  });
});

describe("buildBridges", () => {
  const bridges = buildBridges(raw, NOW);

  it("keys bridges by their source stablecoin and decodes limit/minted/horizon", () => {
    const chfau = bridges.get(CHFAU)!;
    expect(chfau.name).toMatch(/CHFAU/);
    expect(chfau.limitZchf).toBe(10_000_000);
    expect(chfau.mintedZchf).toBeCloseTo(599_834.3, 0);
    expect(chfau.remainingZchf).toBeCloseTo(10_000_000 - 599_834.3, 0);
    expect(chfau.expired).toBe(false);
    expect(chfau.horizon?.slice(0, 10)).toBe("2027-04-08");
    expect(chfau.daysLeft).toBeGreaterThan(200);
    expect(chfau.limitUsedPct).toBeCloseTo(6, 0);
  });

  it("marks the VCHF 2025 bridge as expired with nothing mintable", () => {
    const vchf = bridges.get(VCHF)!;
    expect(vchf.expired).toBe(true);
    expect(vchf.horizon?.slice(0, 10)).toBe("2026-04-15");
    expect(vchf.remainingZchf).toBe(0);
    expect(vchf.daysLeft).toBe(0);
  });
});

describe("bridges in the snapshot and the join", () => {
  const inputs: Inputs = {
    positions: json("positions.json").list,
    prices: json("prices.json"),
    collaterals: json("collaterals.json").list,
    challenges: json("challenges.json").list,
    stats: json("stats.json").map,
    bridges: buildBridges(raw, NOW),
    now: NOW,
  };
  const snap = buildSnapshot(inputs);

  it("uses the bridge contract for minted/limit, has no safety metrics and no feed divergence", () => {
    const c = snap.get(CHFAU)!;
    expect(c.bridge).not.toBeNull();
    expect(c.totalMintedZchf).toBeCloseTo(599_834.3, 0);
    expect(c.totalLimitZchf).toBe(10_000_000);
    expect(c.safety).toBeNull();
    expect(c.utilizationPct).toBeNull();
    expect(c.reconciliation.divergent).toBe(false); // the pseudo-position is by design
  });

  it("derives bridge lifecycle: live while minted and unexpired, closed once expired", () => {
    expect(deriveLifecycle(snap.get(CHFAU)!)).toBe("live");
    expect(deriveLifecycle(snap.get(VCHF)!)).toBe("closed");
  });

  it("joins bridges as live-only records with bridge-specific wording and counts them in the summary", () => {
    const records = join([], snap, "2026-09-07");
    const chfau = records.find((r) => r.ticker === "CHFAU")!;
    expect(chfau.lifecycle).toBe("live");
    expect(chfau.issues.find((i) => i.code === "no-assessment")?.message).toMatch(/1:1 bridge/);
    expect(itemsFor(chfau).some((i) => /Debt close to liquidation/.test(i.title))).toBe(false);
    const s = summarize(records);
    expect(s.bridgeMintedZchf).toBeCloseTo(599_834, 0);
    expect(s.liveBridges).toBe(1);
  });

  it("flags a bridge stablecoin that is off its peg", () => {
    const offPeg = buildSnapshot({ ...inputs, prices: inputs.prices.map((p) => (p.address.toLowerCase() === CHFAU ? { ...p, price: { chf: 0.95, usd: 1.17 } } : p)) });
    const records = join([], offPeg, "2026-09-07");
    const chfau = records.find((r) => r.ticker === "CHFAU")!;
    const peg = chfau.issues.find((i) => i.code === "bridge-peg")!;
    expect(peg).toBeDefined();
    expect(peg.severity).toBe("high");
    expect(itemsFor(chfau).some((i) => i.queue === "live" && /off its 1:1 peg/.test(i.title))).toBe(true);
  });

  it("raises a review item when a live bridge is within 60 days of its horizon", () => {
    const later = 1_807_188_455 - 30 * 86400; // 30 days before the CHFAU horizon
    const soon = buildSnapshot({ ...inputs, bridges: buildBridges(raw, later), now: later });
    const chfau = join([], soon, "2027-03-09").find((r) => r.ticker === "CHFAU")!;
    expect(itemsFor(chfau).some((i) => i.queue === "review" && /Bridge expires in/.test(i.title))).toBe(true);
  });
});
