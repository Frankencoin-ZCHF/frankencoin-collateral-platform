import { beforeEach, describe, expect, it, vi } from "vitest";
import { clear, getOrLoad, size } from "@/lib/cache";

describe("cache", () => {
  beforeEach(() => {
    clear();
    vi.useRealTimers();
  });

  it("coalesces concurrent loads", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return "v";
    };
    const [a, b] = await Promise.all([getOrLoad("k", 1000, loader), getOrLoad("k", 1000, loader)]);
    expect(a).toBe("v");
    expect(b).toBe("v");
    expect(calls).toBe(1);
  });

  it("does not cache errors", async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return "ok";
    };
    await expect(getOrLoad("e", 1000, loader)).rejects.toThrow("boom");
    expect(await getOrLoad("e", 1000, loader)).toBe("ok");
  });

  it("serves stale while revalidating", async () => {
    vi.useFakeTimers();
    let n = 0;
    const loader = async () => ++n;
    expect(await getOrLoad("s", 100, loader, { swrMs: 1000 })).toBe(1);
    vi.advanceTimersByTime(150);
    expect(await getOrLoad("s", 100, loader, { swrMs: 1000 })).toBe(1); // stale, triggers refresh
    await vi.runAllTimersAsync();
    expect(await getOrLoad("s", 100, loader, { swrMs: 1000 })).toBe(2);
    expect(size()).toBe(1);
  });
});
