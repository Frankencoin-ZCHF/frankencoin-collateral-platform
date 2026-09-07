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
  title: "Risk parameters — assessed vs on-chain",
  order: 30,
  enabled: (ctx) => ctx.assessment !== null,
  load: async (ctx) => {
    const rows = compareParameters(ctx.assessment!.data.params, ctx.record.live, ctx.assessment!.status);
    return { rows, hasLive: (ctx.record.live?.positions.active ?? 0) > 0, differs: rows.filter((r) => r.verdict === "differs").length, status: ctx.assessment!.status };
  },
  Component: Block,
};

export default riskParameters;
