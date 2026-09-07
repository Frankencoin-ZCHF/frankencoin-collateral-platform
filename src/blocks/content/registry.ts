/**
 * Content-block registry: maps `type:` → implementation, parses YAML specs from
 * ```block fences / the frontmatter `blocks` array, validates, loads with per-block
 * timeouts and keeps a small ring buffer of recent issues for /health.
 *
 * Adding a type = one folder under ./types + one line in CONTENT_BLOCK_TYPES.
 */

import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { describeForLog, safeMessage } from "@/lib/errors";
import { withTimeout } from "../run";
import type { BlockContext, ContentBlockResult, ContentBlockSpec, ContentBlockType } from "../types";

import documents from "./types/documents";
import callout from "./types/callout";
import coingecko from "./types/coingecko";
import defillama from "./types/defillama";
import api from "./types/api";
import table from "./types/table";
import chart from "./types/chart";
import embed from "./types/embed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CONTENT_BLOCK_TYPES: Record<string, ContentBlockType<any, any>> = {
  [documents.type]: documents,
  links: { ...documents, type: "links", description: "Alias of `documents`." },
  [callout.type]: callout,
  [coingecko.type]: coingecko,
  [defillama.type]: defillama,
  [api.type]: api,
  [table.type]: table,
  [chart.type]: chart,
  [embed.type]: embed,
};

export function contentBlockTypeNames(): string[] {
  return Object.keys(CONTENT_BLOCK_TYPES).sort();
}

// ── Issue log (for /health) ──────────────────────────────────────────────────

export interface BlockIssue {
  at: string;
  collateral: string;
  source: string;
  type: string | null;
  error: string;
}
const issues: BlockIssue[] = [];
const MAX_ISSUES = 50;

function recordIssue(issue: BlockIssue) {
  // De-duplicate identical issues so a broken block on a busy page doesn't flood the log.
  const dup = issues.find((i) => i.collateral === issue.collateral && i.source === issue.source && i.error === issue.error);
  if (dup) {
    dup.at = issue.at;
    return;
  }
  issues.unshift(issue);
  if (issues.length > MAX_ISSUES) issues.length = MAX_ISSUES;
}

export function blockIssues(): BlockIssue[] {
  return [...issues];
}

// ── Parsing ──────────────────────────────────────────────────────────────────

const baseSchema = z.object({ type: z.string().min(1) }).loose();

export type ParsedSpec = { ok: true; type: string; spec: unknown } | { ok: false; error: string };

export function parseBlockYaml(yaml: string): ParsedSpec {
  let raw: unknown;
  try {
    raw = parseYaml(yaml);
  } catch (e) {
    return { ok: false, error: `Invalid YAML: ${(e as Error).message.split("\n")[0]}` };
  }
  return validateSpec(raw);
}

export function validateSpec(raw: unknown): ParsedSpec {
  const base = baseSchema.safeParse(raw);
  if (!base.success) return { ok: false, error: "A block needs a `type:` field" };
  const type = base.data.type.toLowerCase();
  const impl = CONTENT_BLOCK_TYPES[type];
  if (!impl) return { ok: false, error: `Unknown block type "${type}". Known types: ${contentBlockTypeNames().join(", ")}` };
  const parsed = impl.schema.safeParse({ ...base.data, type });
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return { ok: false, error: `Invalid "${type}" block — ${detail}` };
  }
  return { ok: true, type, spec: parsed.data };
}

/** Specs declared in the frontmatter `blocks: []` array. */
export function specsFromFrontmatter(blocks: unknown[] | undefined): ContentBlockSpec[] {
  return (blocks ?? []).map((raw, index) => ({ index, source: "frontmatter" as const, type: typeof (raw as { type?: unknown })?.type === "string" ? String((raw as { type: string }).type) : "?", spec: raw }));
}

// ── Loading ──────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 5_000;

export async function loadContentBlocks(specs: { index: number; source: "fence" | "frontmatter"; raw: unknown | string }[], ctx: BlockContext): Promise<ContentBlockResult[]> {
  const collateral = ctx.record.slug;
  return Promise.all(
    specs.map(async ({ index, source, raw }): Promise<ContentBlockResult> => {
      const parsed = typeof raw === "string" ? parseBlockYaml(raw) : validateSpec(raw);
      const where = `${source}#${index}`;
      if (!parsed.ok) {
        recordIssue({ at: new Date().toISOString(), collateral, source: where, type: null, error: parsed.error });
        return { index, source, type: "?", status: "invalid", spec: raw, data: null, error: parsed.error, Component: null };
      }
      const impl = CONTENT_BLOCK_TYPES[parsed.type]!;
      try {
        const data = await withTimeout(impl.load(parsed.spec, ctx), impl.timeoutMs ?? DEFAULT_TIMEOUT);
        return { index, source, type: parsed.type, status: data === null ? "empty" : "ok", spec: parsed.spec, data, error: null, Component: impl.Component };
      } catch (e) {
        const isTimeout = (e as Error)?.message === "timeout";
        const error = isTimeout ? "Data source timed out" : safeMessage(e);
        console.error(`[content-block:${parsed.type}@${collateral}/${where}] ${isTimeout ? "timeout" : describeForLog(e)}`);
        recordIssue({ at: new Date().toISOString(), collateral, source: where, type: parsed.type, error });
        return { index, source, type: parsed.type, status: isTimeout ? "timeout" : "error", spec: parsed.spec, data: null, error, Component: impl.Component };
      }
    }),
  );
}
