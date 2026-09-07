/**
 * Ordered registry of system blocks rendered on the collateral detail page.
 * Add a block = create src/blocks/system/<id>/{index.ts,Block.astro} and list it here.
 */

import type { SystemBlock } from "./types";

import riskSummary from "./system/risk-summary";
import bridge from "./system/bridge";
import liveProtocol from "./system/live-protocol";
import positionSafety from "./system/position-safety";
import riskParameters from "./system/risk-parameters";
import tailRisks from "./system/tail-risks";
import narrative from "./system/narrative";
import extraBlocks from "./system/extra-blocks";
import positions from "./system/positions";
import challenges from "./system/challenges";
import discussion from "./system/discussion";
import versions from "./system/versions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SYSTEM_BLOCKS: SystemBlock<any>[] = [
  riskSummary,
  bridge,
  liveProtocol,
  positionSafety,
  riskParameters,
  tailRisks,
  narrative,
  extraBlocks,
  positions,
  challenges,
  discussion,
  versions,
];

export { runBlocks } from "./run";
export type { BlockContext, BlockResult, SystemBlock } from "./types";
