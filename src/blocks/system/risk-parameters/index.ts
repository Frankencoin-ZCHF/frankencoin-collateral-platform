/** "Assessed vs on-chain": the risk parameters proposed in the assessment next to what active positions actually use, with named verdicts. */

import type { SystemBlock } from "@/blocks/types";
import { compareParameters, type ParamRow } from "@/services/comparison";
import Block from "./Block.astro";

export interface RiskParametersData {
  rows: ParamRow[];
  hasLive: boolean;
  differs: number;
  status: import("@/types").AssessmentStatus;
}

const riskParameters: SystemBlock<RiskParametersData> = {
  id: "risk-parameters",
  title: "Inspect individual settings",
  order: 30,
  enabled: (ctx) => ctx.assessment !== null && !ctx.record.live?.bridge,
  load: async (ctx) => {
    const rows = compareParameters(ctx.assessment!.data.params, ctx.record.live, ctx.assessment!.status);
    return { rows, hasLive: (ctx.record.live?.positions.active ?? 0) > 0, differs: rows.filter((r) => ["differs", "varies", "within-tolerance", "within-range"].includes(r.verdict)).length, status: ctx.assessment!.status };
  },
  Component: Block,
};

export default riskParameters;
