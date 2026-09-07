import type { APIRoute } from "astro";
import { config } from "@/config";
import { size as cacheSize } from "@/lib/cache";
import { describeForLog } from "@/lib/errors";
import { rateLimits } from "@/upstream/client";
import * as github from "@/upstream/github";
import * as assessments from "@/services/assessments";
import * as protocol from "@/services/protocol";
import { blockIssues } from "@/blocks/content/registry";
import * as collaterals from "@/services/collaterals";

export const prerender = false;

export const GET: APIRoute = async () => {
  const started = Date.now();
  const [idx, snap, joined] = await Promise.allSettled([assessments.index(), protocol.snapshot(), collaterals.all()]);

  const sources = {
    github: idx.status === "fulfilled" ? (config.assessmentsLocalPath ? "local-clone" : "ok") : "error",
    frankencoinApi: snap.status === "fulfilled" ? (config.protocolFixturesDir ? "fixtures" : snap.value.degraded.length ? "degraded" : "ok") : "error",
    discussions: github.hasToken() ? (config.assessmentsLocalPath ? "configured (offline mode: short timeout)" : "configured") : "no-token",
    mode: config.assessmentsLocalPath || config.protocolFixturesDir ? "offline" : "live",
    coingecko: config.coingeckoApiKey ? "pro" : "public",
  };
  const ok = sources.github === "ok" && sources.frankencoinApi !== "error";

  const body = {
    ok,
    status: ok ? "ok" : "degraded",
    version: "0.1.0",
    uptimeSeconds: Math.round(process.uptime()),
    latencyMs: Date.now() - started,
    sources,
    assessments:
      idx.status === "fulfilled"
        ? { count: idx.value.items.length, head: idx.value.head?.sha ?? null, fetchedAt: idx.value.fetchedAt, failures: idx.value.failures }
        : { error: describeForLog(idx.reason).split(":")[0] },
    protocol:
      snap.status === "fulfilled"
        ? { collaterals: snap.value.byAddress.size, fetchedAt: snap.value.fetchedAt, degraded: snap.value.degraded }
        : { error: describeForLog(snap.reason).split(":")[0] },
    integrity:
      joined.status === "fulfilled"
        ? joined.value.records.filter((r) => r.issues.some((i) => i.severity !== "low")).map((r) => ({ slug: r.slug, lifecycle: r.lifecycle, issues: r.issues.filter((i) => i.severity !== "low") }))
        : { error: "join failed" },
    contentBlockIssues: blockIssues(),
    rateLimits,
    cache: { enabled: config.cacheEnabled, entries: cacheSize() },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: ok ? 200 : 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
};
