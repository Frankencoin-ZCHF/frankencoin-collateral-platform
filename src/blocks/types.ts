/**
 * Block plugin interfaces. Two kinds share the runtime:
 *   - system blocks   — defined in code (src/blocks/system/*), always present when their data exists
 *   - content blocks  — declared by assessment authors inside the markdown (```block fences) or the
 *                       frontmatter `blocks` array (src/blocks/content/types/*)
 */

import type { z } from "zod";
import type { Assessment, CollateralRecord, VersionRef } from "@/types";

/** Astro component imported from a .astro file. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AstroComponent = (props: any) => any;

export interface BlockContext {
  record: CollateralRecord;
  /** The assessment being viewed — the latest, or a historical version when `?v=` is set. */
  assessment: Assessment | null;
  isHistorical: boolean;
  version: VersionRef | null;
  versions: VersionRef[];
  /** Absolute origin of this deployment (for canonical links inside blocks). */
  origin: string;
}

export interface SystemBlock<T = unknown> {
  id: string;
  title: string;
  order: number;
  /** "half" blocks are laid out two per row on large screens. */
  span?: "full" | "half";
  /** Skip entirely (no card) when false. */
  enabled?: (ctx: BlockContext) => boolean;
  /** Return null to hide the block; throw to render an "unavailable" card. */
  load: (ctx: BlockContext) => Promise<T | null>;
  /** Per-block timeout in ms (default 6000). */
  timeoutMs?: number;
  Component: AstroComponent;
}

export type BlockStatus = "ok" | "empty" | "error" | "timeout";

export interface BlockResult<T = unknown> {
  block: SystemBlock<T>;
  status: BlockStatus;
  data: T | null;
  error: string | null;
  ms: number;
}

/** A content-block type: YAML spec → validated → loaded → rendered. */
export interface ContentBlockType<S = unknown, D = unknown> {
  type: string;
  /** One-line description shown in docs and error messages. */
  description: string;
  schema: z.ZodType<S>;
  /** Fetch/derive data. Return null for "nothing to show". */
  load: (spec: S, ctx: BlockContext) => Promise<D | null>;
  timeoutMs?: number;
  Component: AstroComponent;
}

export interface ContentBlockSpec {
  index: number;
  /** Where the spec came from. */
  source: "fence" | "frontmatter";
  type: string;
  spec: unknown;
}

export interface ContentBlockResult {
  index: number;
  source: "fence" | "frontmatter";
  type: string;
  status: BlockStatus | "invalid";
  spec: unknown;
  data: unknown;
  error: string | null;
  Component: AstroComponent | null;
}
