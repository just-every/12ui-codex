import type { CreateWorkspace, DesignRun } from '../../shared/types.js';

export type SeedVariationItem = {
  id: string;
  design: DesignRun['designs'][number] | null;
  plannedTitle: string | null;
  plannedPrompt: string | null;
  index: number;
  branchIndex: number;
};

export const buildSeedVariationItems = (args: {
  draftSeedVariationCount: number;
  isSeedRunActive: boolean;
  seedRun: DesignRun;
  workspaceSeedVariationCount?: CreateWorkspace['seedVariationCount'] | null;
}): SeedVariationItem[] => {
  const plannedByBranch = new Map((args.seedRun.plannedDesigns ?? []).map((design) => [design.branchIndex, design]));
  const generatedByBranch = new Map(args.seedRun.designs.map((design) => [design.branchIndex, design]));
  const expected = args.isSeedRunActive
    ? Math.max(args.seedRun.batchSize, args.workspaceSeedVariationCount ?? args.draftSeedVariationCount)
    : Math.max(
      args.seedRun.designs.length,
      args.seedRun.plannedDesigns?.length ?? 0,
      args.seedRun.batchSize,
    );

  return Array.from({ length: expected }, (_, index) => {
    const branchIndex = index + 1;
    const design = generatedByBranch.get(branchIndex) ?? null;
    const planned = plannedByBranch.get(branchIndex);
    return {
      id: design?.id ?? `pending-${branchIndex}`,
      design,
      plannedTitle: planned?.title ?? null,
      plannedPrompt: planned?.prompt ?? null,
      index,
      branchIndex,
    };
  }).filter((item) => args.isSeedRunActive || item.design);
};
