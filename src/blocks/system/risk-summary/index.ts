import type { SystemBlock } from "@/blocks/types";
import type { AssessmentData, LiveCollateral } from "@/types";
import Block from "./Block.astro";
export interface RiskSummaryData {
  data: AssessmentData | null;
  live: LiveCollateral | null;
  status: string | null;
  sourceUrl: string | null;
}
const riskSummary: SystemBlock<RiskSummaryData> = {
  id: "risk-summary",
  title: "Lending terms",
  order: 10,
  span: "full",
  enabled: (ctx) => ctx.assessment !== null || ctx.record.live !== null,
  load: async (ctx) => {
    const a = ctx.assessment;
    const { fileUrl } = await import("@/services/assessments");
    return { data: a?.data ?? null, live: ctx.record.live, status: a?.status ?? null, sourceUrl: a ? fileUrl(a.path, a.ref?.sha) : null };
  },
  Component: Block,
};
export default riskSummary;
