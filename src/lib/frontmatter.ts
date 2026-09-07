/**
 * Parse an assessment file: a JSON object between `---` delimiters followed by markdown.
 *
 * Delimiter handling mirrors scripts/validate.js in the assessments repo exactly
 * (`indexOf("---", 3)`), so anything that validates upstream parses here.
 * Validation is a zod mirror of schema/collateral-assessment.schema.json, kept loose:
 * unknown keys (e.g. `links.discussion`, top-level `blocks`) are preserved.
 */

import { z } from "zod";
import type { RawFrontmatter } from "@/types";
import { TAIL_RISK_CATEGORIES } from "./constants";

const riskArray = z.array(
  z
    .object({
      name: z.string(),
      probability: z.string(),
      severity: z.string(),
      compensation: z.string(),
    })
    .loose(),
);

const numberOrNull = z.union([z.number(), z.null()]);

export const frontmatterSchema = z
  .object({
    asset_name: z.string(),
    asset_ticker: z.string(),
    contract_address: z.string(),
    assessment_date: z.string(),
    author: z.string(),
    links: z
      .object({
        etherscan: z.string(),
        coingecko: z.string(),
        website: z.string(),
        docs: z.string(),
        other: z.string(),
        discussion: z.string().optional(),
      })
      .loose(),
    risk_scores: z
      .object({
        public_information: z.string(),
        free_float: z.string(),
        market_risk: z.string(),
        tail_risks: z
          .object(Object.fromEntries(TAIL_RISK_CATEGORIES.map((c) => [c, riskArray])) as Record<(typeof TAIL_RISK_CATEGORIES)[number], typeof riskArray>)
          .loose(),
      })
      .loose(),
    risk_parameters: z
      .object({
        retained_reserve: numberOrNull,
        target_interest_rate: numberOrNull,
        global_minting_limit: numberOrNull,
        liquidation_price: numberOrNull,
        maturity: numberOrNull,
        auction_duration: numberOrNull,
        minimum_collateral: numberOrNull,
      })
      .loose(),
    blocks: z.array(z.unknown()).optional(),
  })
  .loose();

export interface ParsedFile {
  frontmatter: RawFrontmatter;
  body: string;
}

export class FrontmatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrontmatterError";
  }
}

/** Split the file into the raw JSON text and the markdown body, exactly like validate.js. */
export function splitFrontmatter(source: string): { json: string; body: string } {
  const content = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!content.startsWith("---")) throw new FrontmatterError("File does not start with '---'");
  const end = content.indexOf("---", 3);
  if (end === -1) throw new FrontmatterError("Closing '---' not found");
  return { json: content.slice(3, end).trim(), body: content.slice(end + 3).replace(/^\n+/, "") };
}

export function parseAssessmentFile(source: string): ParsedFile {
  const { json, body } = splitFrontmatter(source);
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new FrontmatterError(`Frontmatter is not valid JSON: ${(e as Error).message}`);
  }
  const result = frontmatterSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new FrontmatterError(`Frontmatter failed validation — ${issues.join("; ")}`);
  }
  return { frontmatter: result.data as RawFrontmatter, body };
}
