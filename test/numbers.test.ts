import { describe, expect, it } from "vitest";
import {
  formatChf,
  formatCompact,
  formatNumber,
  fractionToPercent,
  fromWei,
  isoFromUnix,
  parsePercent,
  ppmToPercent,
  weightedAverage,
} from "@/lib/numbers";

describe("fromWei", () => {
  it("decodes 18-decimal amounts", () => {
    expect(fromWei("1000000000000000000")).toBe(1);
    expect(fromWei("1500000000000000000000")).toBe(1500);
  });
  it("decodes 8-decimal amounts (WBTC)", () => {
    expect(fromWei("12345678", 8)).toBe(0.12345678);
  });
  it("decodes liquidation prices scaled by 36 - decimals", () => {
    // WBTC position price from /positions/list: 36 - 8 = 28 decimals
    expect(fromWei("750000000000000000000000000000000", 28)).toBe(75000);
  });
  it("handles zero / empty / garbage", () => {
    expect(fromWei("0")).toBe(0);
    expect(fromWei("")).toBe(0);
    expect(fromWei(null)).toBe(0);
    expect(fromWei("abc")).toBe(0);
  });
});

describe("percent helpers", () => {
  it("ppmToPercent", () => {
    expect(ppmToPercent(20000)).toBe(2);
    expect(ppmToPercent("100000")).toBe(10);
  });
  it("parsePercent", () => {
    expect(parsePercent("16.98%")).toBeCloseTo(16.98);
    expect(parsePercent("0.25 %")).toBe(0.25);
    expect(parsePercent("n/a")).toBeNull();
    expect(parsePercent("")).toBeNull();
    expect(parsePercent(3)).toBe(3);
  });
  it("fractionToPercent", () => {
    expect(fractionToPercent(0.25)).toBe(25);
    expect(fractionToPercent(0.0075)).toBe(0.75);
    expect(fractionToPercent(25)).toBe(25);
    expect(fractionToPercent(null)).toBeNull();
  });
});

describe("formatting", () => {
  it("uses Swiss apostrophe grouping", () => {
    expect(formatNumber(1234567.891)).toBe("1'234'567.89");
    expect(formatNumber(999, 0)).toBe("999");
    expect(formatChf(12.5)).toBe("12.50 CHF");
    expect(formatCompact(12_345_678)).toBe("12.3M");
    expect(formatNumber(null)).toBe("–");
  });
});

describe("dates", () => {
  it("guards the 2^256 cooldown sentinel", () => {
    expect(isoFromUnix(1.157920892373162e77)).toBeNull();
    expect(isoFromUnix(1752313259)).toBe("2025-07-12T09:40:59.000Z");
  });
});

describe("weightedAverage", () => {
  it("weights by the second element", () => {
    expect(weightedAverage([[10, 1], [20, 3]])).toBe(17.5);
    expect(weightedAverage([])).toBeNull();
  });
});
