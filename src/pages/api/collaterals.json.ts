import type { APIRoute } from "astro";
import * as collaterals from "@/services/collaterals";
import { toRow } from "@/lib/rows";
import { safeMessage, describeForLog } from "@/lib/errors";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const set = await collaterals.all();
    const body = {
      ok: true,
      generatedAt: new Date().toISOString(),
      assessmentsHead: set.assessmentsHead ? { sha: set.assessmentsHead.sha, date: set.assessmentsHead.date } : null,
      protocolFetchedAt: set.protocolFetchedAt,
      warnings: set.warnings,
      integrity: set.records.filter((r) => r.issues.some((i) => i.severity !== "low")).map((r) => ({ slug: r.slug, issues: r.issues.filter((i) => i.severity !== "low") })),
      summary: collaterals.summarize(set.records),
      count: set.records.length,
      collaterals: set.records.map(toRow),
    };
    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error(`[api/collaterals] ${describeForLog(e)}`);
    return new Response(JSON.stringify({ ok: false, error: safeMessage(e) }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
};
