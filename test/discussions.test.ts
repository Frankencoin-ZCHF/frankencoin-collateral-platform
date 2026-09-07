import { describe, expect, it } from "vitest";
import { matchThreads, numberFromUrl } from "@/services/discussions";
import type { DiscussionSummary } from "@/types";

const t = (number: number, title: string, commentCount = 0): DiscussionSummary => ({
  number,
  title,
  url: `https://github.com/Frankencoin-ZCHF/Frankencoin/discussions/${number}`,
  createdAt: `2026-01-${String(number % 28 + 1).padStart(2, "0")}T00:00:00Z`,
  commentCount,
});

// Real titles from the "Acceptable Collaterals" category.
const threads = [
  t(17, "Wrapped Bitcoin (WBTC)", 2),
  t(55, "ERC20 Tokens Serving as Decentralized Bitcoin Collateral", 0),
  t(13, "Boss Info AG", 2),
  t(24, "Quitt (DQTS)", 6),
  t(94, "Proposal: Add BOLD and ysyBOLD (Staked yBOLD) as collateral", 18),
  t(82, "Proposal: Add Paxos Gold (PAXG) as Collateral", 2),
  t(83, "Proposal: Add Tether Gold (XAUt) as Collateral", 1),
  t(15, "Liquid Staked Ether (LSETH)", 0),
  t(79, "Proposal: Add Gnosis (GNO) as Collateral", 1),
  t(116, "Proposal: Add Wrapped Circle xStock (wCRCLx) as collateral", 4),
];

describe("matchThreads", () => {
  it("matches the ticker as a whole word, case-insensitively", () => {
    expect(matchThreads(threads, "WBTC", "Wrapped BTC").map((x) => x.number)).toEqual([17]);
    expect(matchThreads(threads, "LsETH", "Liquid Staked ETH").map((x) => x.number)).toEqual([15]);
    expect(matchThreads(threads, "XAUt", "Tether Gold").map((x) => x.number)).toEqual([83]);
  });

  it("does not match a ticker inside another word", () => {
    expect(matchThreads(threads, "BOLD", "Bold").map((x) => x.number)).toEqual([94]); // "BOLD and ysyBOLD" — BOLD is a whole word there
    expect(matchThreads(threads, "GNO", "Gnosis").map((x) => x.number)).toEqual([79]);
    expect(matchThreads(threads, "AU", "Au")).toEqual([]); // 2-char ticker inside "PAXG"/"XAUt" and a too-short name don't match
    expect(matchThreads(threads, "XAU", "Gold").map((x) => x.number)).toEqual([82, 83]); // generic name → both gold threads, most-discussed first
  });

  it("falls back to the asset name (e.g. Boss Info AG)", () => {
    expect(matchThreads(threads, "BOSS", "Boss Info AG").map((x) => x.number)).toEqual([13]);
    expect(matchThreads(threads, "DQTS", "Quitt").map((x) => x.number)).toEqual([24]);
  });

  it("orders multiple matches by comment count", () => {
    const more = [...threads, t(200, "WBTC follow-up: parameters", 9)];
    expect(matchThreads(more, "WBTC", "Wrapped BTC").map((x) => x.number)).toEqual([200, 17]);
  });
});

describe("numberFromUrl", () => {
  it("extracts the discussion number", () => {
    expect(numberFromUrl("https://github.com/Frankencoin-ZCHF/Frankencoin/discussions/17")).toBe(17);
    expect(numberFromUrl("https://github.com/Frankencoin-ZCHF/Frankencoin/discussions/17#discussioncomment-1")).toBe(17);
    expect(numberFromUrl("https://example.com")).toBeNull();
    expect(numberFromUrl(null)).toBeNull();
  });
});
