import type { SystemBlock } from "@/blocks/types";
import { TAIL_RISK_CATEGORIES, TAIL_RISK_LABELS } from "@/lib/constants";
import type { TailRisk } from "@/types";
import Block from "./Block.astro";

export interface TailRisksData {
  groups: { category: string; label: string; risks: TailRisk[] }[];
  totalCompensationPct: number | null;
}

const tailRisks: SystemBlock<TailRisksData> = {
  id: "tail-risks",
  title: "Tail risks",
  order: 40,
  enabled: (ctx) => ctx.assessment !== null,
  load: async (ctx) => {
    const d = ctx.assessment!.data;
    const groups = TAIL_RISK_CATEGORIES.map((category) => ({
      category,
      label: TAIL_RISK_LABELS[category],
      risks: d.tailRisks.filter((t) => t.category === category),
    }));
    return { groups, totalCompensationPct: d.totalCompensationPct };
  },
  Component: Block,
};

export default tailRisks;
