/**
 * Block runner: loads every enabled block concurrently, each with its own timeout,
 * and never lets one failure take the page down.
 */

import { describeForLog, safeMessage } from "@/lib/errors";
import type { BlockContext, BlockResult, SystemBlock } from "./types";

const DEFAULT_TIMEOUT = 6_000;

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

export async function runBlocks(blocks: SystemBlock[], ctx: BlockContext): Promise<BlockResult[]> {
  const enabled = blocks.filter((b) => (b.enabled ? b.enabled(ctx) : true)).sort((a, b) => a.order - b.order);

  const results = await Promise.all(
    enabled.map(async (block): Promise<BlockResult> => {
      const started = Date.now();
      try {
        const data = await withTimeout(block.load(ctx), block.timeoutMs ?? DEFAULT_TIMEOUT);
        return { block, status: data === null ? "empty" : "ok", data, error: null, ms: Date.now() - started };
      } catch (e) {
        const isTimeout = (e as Error)?.message === "timeout";
        console.error(`[block:${block.id}] ${isTimeout ? "timed out" : describeForLog(e)}`);
        return { block, status: isTimeout ? "timeout" : "error", data: null, error: isTimeout ? "Data source timed out" : safeMessage(e), ms: Date.now() - started };
      }
    }),
  );

  return results.filter((r) => r.status !== "empty");
}
