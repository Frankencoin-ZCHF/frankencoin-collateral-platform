import type { APIRoute } from "astro";
import * as collaterals from "@/services/collaterals";
import { toRow } from "@/lib/rows";
import { isValidSlug } from "@/lib/slug";
import { safeMessage, describeForLog } from "@/lib/errors";

export const prerender = false;

const json = (body: unknown, status = 200, cache = "public, max-age=60, s-maxage=60") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, "Access-Control-Allow-Origin": "*" },
  });

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug?.toLowerCase();
  if (!isValidSlug(slug)) return json({ ok: false, error: "Invalid collateral" }, 400, "no-store");
  try {
    const record = await collaterals.bySlug(slug);
    if (!record) return json({ ok: false, error: "Unknown collateral" }, 404, "no-store");
    const a = record.assessment;
    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      collateral: toRow(record),
      assessment: a
        ? { status: a.status, path: a.path, ref: a.ref, frontmatter: a.raw, data: a.data, markdown: a.body }
        : null,
      live: record.live,
    });
  } catch (e) {
    console.error(`[api/collateral/${slug}] ${describeForLog(e)}`);
    return json({ ok: false, error: safeMessage(e) }, 503, "no-store");
  }
};
