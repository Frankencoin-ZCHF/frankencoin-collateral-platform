import type { SystemBlock } from "@/blocks/types";
import * as assessments from "@/services/assessments";
import type { VersionRef } from "@/types";
import Block from "./Block.astro";

export interface VersionsData {
  slug: string;
  versions: VersionRef[];
  current: string | null;
  historyUrl: string;
}

const versions: SystemBlock<VersionsData> = {
  id: "versions",
  title: "Version history",
  order: 90,
  enabled: (ctx) => ctx.record.assessment !== null,
  load: async (ctx) => {
    const all = ctx.versions.length ? ctx.versions : await assessments.versions(ctx.record.slug);
    if (all.length === 0) return null;
    return { slug: ctx.record.slug, versions: all, current: ctx.version?.sha ?? null, historyUrl: assessments.historyUrl(ctx.record.assessment!.path) };
  },
  Component: Block,
};

export default versions;
