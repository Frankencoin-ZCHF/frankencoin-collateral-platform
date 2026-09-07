import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareParameters, verdictLabel } from "@/services/comparison";
import { attentionGroups, attentionItems, itemsFor, summarizeAttention } from "@/services/attention";
import { buildSnapshot, type Inputs } from "@/services/protocol";
import { join } from "@/services/collaterals";
import { buildAssessment } from "@/services/assessments";

const json = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const text = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const inputs: Inputs = { positions: json("positions.json").list, prices: json("prices.json"), collaterals: json("collaterals.json").list, challenges: json("challenges.json").list, stats: json("stats.json").map, now: 1_788_800_000 };
const TODAY = "2026-09-07";

describe("compareParameters", () => {
  const snap = buildSnapshot(inputs);
  const wsteth = buildAssessment(text("wstETH.md"), "assessments/draft/wstETH.md", "draft", "wstETH", null, TODAY);
  const live = snap.get(wsteth.data.address!)!;

  it("returns a named verdict with an explanation for every parameter", () => {
    const rows = compareParameters(wsteth.data.params, live, "draft");
    expect(rows.map((r) => r.key)).toEqual(["retained_reserve", "risk_premium", "liquidation_price", "auction_duration", "minimum_collateral", "global_minting_limit", "maturity"]);
    for (const r of rows) {
      expect(["matches", "within-range", "differs", "not-comparable", "unavailable"]).toContain(r.verdict);
      expect(r.explanation.length).toBeGreaterThan(10);
    }
    expect(rows.find((r) => r.key === "maturity")!.verdict).toBe("not-comparable");
  });

  it("treats a more conservative live value as within range, a less conservative one as differing", () => {
    const params = { ...wsteth.data.params, retainedReservePct: 20 }; // live reserve is 25% → more conservative
    expect(compareParameters(params, live, "draft").find((r) => r.key === "retained_reserve")!.verdict).toBe("within-range");
    const loose = { ...wsteth.data.params, retainedReservePct: 40 }; // live 25% is less conservative
    expect(compareParameters(loose, live, "draft").find((r) => r.key === "retained_reserve")!.verdict).toBe("differs");
  });

  it("never calls a draft comparison 'less conservative'; a published one it does", () => {
    const loose = { ...wsteth.data.params, retainedReservePct: 40 };
    const draft = compareParameters(loose, live, "draft").find((r) => r.key === "retained_reserve")!;
    const pub = compareParameters(loose, live, "published").find((r) => r.key === "retained_reserve")!;
    expect(draft.explanation).not.toMatch(/less conservative/);
    expect(draft.explanation).toMatch(/draft proposal/);
    expect(pub.explanation).toMatch(/less conservative/);
    expect(verdictLabel("differs", "draft")).toBe("Differs from draft proposal");
    expect(verdictLabel("differs", "published")).toBe("Deviates from assessment");
  });

  it("is 'unavailable' without live positions and 'not-comparable' without an assessed value", () => {
    expect(compareParameters(wsteth.data.params, null).find((r) => r.key === "risk_premium")!.verdict).toBe("unavailable");
    expect(compareParameters({ ...wsteth.data.params, targetInterestRatePct: null }, live).find((r) => r.key === "risk_premium")!.verdict).toBe("not-comparable");
  });
});

describe("attention queues", () => {
  const snap = buildSnapshot(inputs);
  const wsteth = buildAssessment(text("wstETH.md"), "assessments/draft/wstETH.md", "draft", "wstETH", null, TODAY);

  it("puts draft-proposal differences in the review queue and integrity/liquidation items in the live queue", () => {
    const records = join([wsteth], snap, TODAY);
    const w = records.find((r) => r.slug === "wsteth")!;
    const items = itemsFor(w);
    expect(items.filter((i) => /differs from draft proposal$/.test(i.title)).every((i) => i.queue === "review")).toBe(true);
    expect(items.some((i) => i.queue === "review" && i.title === "No governance reference linked")).toBe(true);
    const chfau = records.find((r) => r.ticker === "CHFAU")!;
    expect(itemsFor(chfau).map((i) => [i.queue, i.title])).toEqual(
      expect.arrayContaining([
        ["live", "Position feed disagrees with protocol aggregate"],
        ["live", "Live collateral without any assessment"],
      ]),
    );
    expect(attentionGroups(records, "live").every((g) => g.items.every((i) => i.queue === "live"))).toBe(true);
    expect(attentionGroups(records, "review").every((g) => g.items.every((i) => i.queue === "review"))).toBe(true);
  });

  it("a future assessment date is NOT an attention item (separate provenance clocks)", () => {
    const future = buildAssessment(text("wstETH.md").replace('"assessment_date": "2026-08-01"', '"assessment_date": "2027-08-01"'), "assessments/draft/wstETH.md", "draft", "wstETH", null, TODAY);
    const rec = join([future], snap, TODAY).find((r) => r.slug === "wsteth")!;
    expect(rec.issues.map((i) => i.code)).not.toContain("future-date");
    expect(attentionItems([rec]).some((i) => /future/i.test(i.title))).toBe(false);
  });

  it("deviations from a PUBLISHED assessment are live risk, high severity", () => {
    const pub = buildAssessment(text("wstETH.md").replace('"retained_reserve": 0.25', '"retained_reserve": 0.6'), "assessments/published/wstETH.md", "published", "wstETH", null, TODAY);
    const rec = join([pub], snap, TODAY).find((r) => r.slug === "wsteth")!;
    const dev = itemsFor(rec).find((i) => /Retained reserve deviates from the published assessment/.test(i.title))!;
    expect(dev).toBeDefined();
    expect(dev.queue).toBe("live");
    expect(dev.severity).toBe("high");
  });

  it("summarises both queues", () => {
    const s = summarizeAttention(join([wsteth], snap, TODAY));
    expect(s.live.items).toBeGreaterThan(0); // CHFAU divergence + no assessment
    expect(s.live.integrity).toBeGreaterThan(0);
    expect(s.review.draftAssessments).toBe(1);
    expect(s.review.items).toBeGreaterThanOrEqual(1);
    expect(s.live.challenges).toBe(0);
  });
});
