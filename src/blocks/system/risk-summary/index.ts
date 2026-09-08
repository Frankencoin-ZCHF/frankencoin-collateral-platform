import type { SystemBlock } from "@/blocks/types";
import type { AssessmentData } from "@/types";
import Block from "./Block.astro";

export interface RiskSummaryData {
  data: AssessmentData;
  status: string;
  sourceUrl: string;
}

const riskSummary: SystemBlock<RiskSummaryData> = {
  id: "risk-summary",
  title: "Risk assessment",
  order: 10,
  span: "full",
  enabled: (ctx) => ctx.assessment !== null,
  load: async (ctx) => {
    const a = ctx.assessment!;
    const { fileUrl } = await import("@/services/assessments");
    return { data: a.data, status: a.status, sourceUrl: fileUrl(a.path, a.ref?.sha) };
  },
  Component: Block,
};

export default riskSummary;
