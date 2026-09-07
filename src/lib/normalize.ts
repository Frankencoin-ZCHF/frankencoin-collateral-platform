/**
 * RawFrontmatter → AssessmentData. Percent strings become numbers, fractions become
 * percents, "n/a" becomes null. The raw object is kept alongside for the diff view.
 */

import type { AssessmentData, Classification, RawFrontmatter, TailRisk } from "@/types";
import { CLASSIFICATIONS, PROBABILITY_PCT, SEVERITY_PCT, TAIL_RISK_CATEGORIES } from "./constants";
import { fractionToPercent, parsePercent, round, sum } from "./numbers";
import { normalizeAddress } from "./slug";

const LINK_LABELS: Record<string, string> = {
  etherscan: "Etherscan",
  coingecko: "CoinGecko",
  website: "Website",
  docs: "Documentation",
  other: "Other",
  discussion: "Discussion",
};

function classification(v: unknown): Classification {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return (CLASSIFICATIONS.find((c) => c.toLowerCase() === s) as Classification) ?? null;
}

function levelOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s === "" || /^n\/?a$/i.test(s) ? null : s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function httpUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^https?:\/\//i.test(s) ? s : null;
}

/** Discussion URL: explicit `links.discussion`, else any link pointing at the discussions forum. */
function findDiscussionUrl(links: RawFrontmatter["links"]): string | null {
  const explicit = httpUrl(links.discussion);
  if (explicit) return explicit;
  for (const v of Object.values(links)) {
    const u = httpUrl(v);
    if (u && /github\.com\/[^/]+\/[^/]+\/discussions\/\d+/i.test(u)) return u;
  }
  return null;
}

export function normalizeTailRisks(raw: RawFrontmatter["risk_scores"]["tail_risks"]): TailRisk[] {
  const out: TailRisk[] = [];
  for (const category of TAIL_RISK_CATEGORIES) {
    for (const r of raw[category] ?? []) {
      const probability = levelOrNull(r.probability);
      const severity = levelOrNull(r.severity);
      const p = probability ? PROBABILITY_PCT[probability.toLowerCase()] : undefined;
      const s = severity ? SEVERITY_PCT[severity.toLowerCase()] : undefined;
      out.push({
        category,
        name: levelOrNull(r.name) ?? "n/a",
        probability,
        severity,
        compensationPct: parsePercent(r.compensation),
        expectedLossPct: p !== undefined && s !== undefined ? round((p * s) / 100, 4) : null,
      });
    }
  }
  return out;
}

export function normalizeAssessment(raw: RawFrontmatter): AssessmentData {
  const tailRisks = normalizeTailRisks(raw.risk_scores.tail_risks);
  const comps = tailRisks.map((t) => t.compensationPct).filter((c): c is number => c !== null);
  const p = raw.risk_parameters;

  const links = Object.entries(raw.links)
    .filter(([key]) => key !== "discussion")
    .map(([key, v]) => ({ key, label: LINK_LABELS[key] ?? key, url: httpUrl(v) }))
    .filter((l): l is { key: string; label: string; url: string } => l.url !== null);

  return {
    assetName: raw.asset_name.trim(),
    ticker: raw.asset_ticker.trim(),
    address: normalizeAddress(raw.contract_address),
    assessmentDate: raw.assessment_date.trim(),
    author: raw.author.trim(),
    links,
    discussionUrl: findDiscussionUrl(raw.links),
    scores: {
      publicInformation: classification(raw.risk_scores.public_information),
      freeFloat: classification(raw.risk_scores.free_float),
      marketRiskPct: parsePercent(raw.risk_scores.market_risk),
    },
    tailRisks,
    totalCompensationPct: comps.length ? round(sum(comps), 4) : null,
    params: {
      retainedReservePct: fractionToPercent(p.retained_reserve),
      targetInterestRatePct: fractionToPercent(p.target_interest_rate),
      globalMintingLimit: num(p.global_minting_limit),
      liquidationPrice: num(p.liquidation_price),
      maturityMonths: num(p.maturity),
      auctionDurationHours: num(p.auction_duration),
      minimumCollateral: num(p.minimum_collateral),
    },
  };
}
