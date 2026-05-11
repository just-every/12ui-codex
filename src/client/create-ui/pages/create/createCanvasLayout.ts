import {
  buildCanvasGraphLayout,
  type CanvasGraphEdgeInput,
  type CanvasGraphGroupInput,
  type CanvasGraphNodeInput,
} from '../sketch-canvas/canvasGraphLayout';
import type { CanvasGraphLayout } from '../sketch-canvas/canvasGraphLayout';

export const CREATE_SEED_NODE_ID = 'create-seed';
export const CREATE_PLANNER_NODE_ID = 'create-planner';
export const CREATE_EXPORT_NODE_ID = 'create-export';
export const CREATE_SEED_VARIATION_GROUP_ID = 'create-seed-variations';
const CREATE_VARIATION_COLUMNS = 3;
const CREATE_VARIATION_NODE_WIDTH = 648;
const CREATE_VARIATION_NODE_HEIGHT = 864;
const CREATE_VARIATION_COLUMN_GAP = 124;
const CREATE_VARIATION_ROW_GAP = 172;
const CREATE_VARIATION_TOP_GAP = 192;
const CREATE_VARIATION_STACK_PEEK_OFFSETS = [
  { x: -64, y: -38 },
  { x: 72, y: 46 },
  { x: -52, y: 56 },
  { x: 54, y: -30 },
] as const;
export const CREATE_SEED_NODE_WIDTH = 980;
export const CREATE_SEED_NODE_HEIGHT = 360;
const CREATE_PLANNER_NODE_WIDTH = 720;
const CREATE_PLANNER_NODE_HEIGHT = 560;
const CREATE_PAGE_NODE_WIDTH = 500;
const CREATE_PAGE_NODE_HEIGHT = 294;
const CREATE_EXPORT_NODE_WIDTH = 760;
const CREATE_EXPORT_NODE_HEIGHT = 680;
const CREATE_MAIN_GAP = 180;
const CREATE_MAIN_START = { x: 360, y: 250 };
const CREATE_PAGE_LANE_OFFSETS_Y = [-56, 132] as const;

export const resolveCreateSeedNodeWidth = (viewportWidth?: number): number => {
  if (!viewportWidth || viewportWidth >= 860) return CREATE_SEED_NODE_WIDTH;
  if (viewportWidth >= 640) return 820;
  if (viewportWidth >= 430) return 640;
  return 560;
};

export type CreateCanvasPageLayoutInput = {
  id: string;
  variations?: CreateCanvasVariationLayoutInput[];
  variationIds?: string[];
  selectedVariationId?: string | null;
  variationsCollapsed?: boolean;
};

export type CreateCanvasVariationLayoutInput = {
  id: string;
  imageSize?: {
    width: number;
    height: number;
  } | null;
};

export const createPageNodeId = (pageId: string): string => `create-page-${pageId}`;
export const createVariationNodeId = (pageId: string, outputId: string): string => `create-page-${pageId}-variation-${outputId}`;
export const createSeedVariationNodeId = (outputId: string): string => `create-seed-variation-${outputId}`;
export const createSourceAttachmentNodeId = (index: number): string => `create-source-attachment-${index + 1}`;

const resolveVariationNodeHeight = (variation?: CreateCanvasVariationLayoutInput): number => {
  const width = variation?.imageSize?.width;
  const height = variation?.imageSize?.height;
  if (Number.isFinite(width) && Number.isFinite(height) && width && height && width > 0 && height > 0) {
    return Math.max(1, Math.round(CREATE_VARIATION_NODE_WIDTH * (height / width)));
  }
  return CREATE_VARIATION_NODE_HEIGHT;
};

export const resolveCreateCanvasLayoutVariations = (
  page: CreateCanvasPageLayoutInput,
): CreateCanvasVariationLayoutInput[] => (
  Array.isArray(page.variations)
    ? page.variations
    : Array.isArray(page.variationIds)
      ? page.variationIds.map((id) => ({ id }))
      : []
);

const resolveVariationGroupWidth = (variationCount: number): number => {
  const count = Math.max(0, Math.floor(variationCount));
  if (count <= 0) return 0;
  const columns = Math.min(CREATE_VARIATION_COLUMNS, count);
  return (columns * CREATE_VARIATION_NODE_WIDTH) + (Math.max(0, columns - 1) * CREATE_VARIATION_COLUMN_GAP);
};

const resolveVariationStackOffset = (behindIndex: number): { x: number; y: number } => (
  CREATE_VARIATION_STACK_PEEK_OFFSETS[
    Math.min(Math.max(0, behindIndex), CREATE_VARIATION_STACK_PEEK_OFFSETS.length - 1)
  ] ?? { x: 0, y: 0 }
);

const resolveVariationStackBounds = (
  variationCount: number,
): { minX: number; minY: number; maxX: number; maxY: number } => {
  const count = Math.max(0, Math.floor(variationCount));
  const offsets = [
    { x: 0, y: 0 },
    ...Array.from({ length: Math.max(0, count - 1) }, (_, index) => resolveVariationStackOffset(index)),
  ];
  return offsets.reduce((bounds, offset) => ({
    minX: Math.min(bounds.minX, offset.x),
    minY: Math.min(bounds.minY, offset.y),
    maxX: Math.max(bounds.maxX, offset.x),
    maxY: Math.max(bounds.maxY, offset.y),
  }), { minX: 0, minY: 0, maxX: 0, maxY: 0 });
};

const shouldCollapseVariationSet = (args: {
  collapsed?: boolean;
  selectedVariationId?: string | null;
  variations: readonly CreateCanvasVariationLayoutInput[];
}): boolean => (
  args.collapsed === true
  && Boolean(args.selectedVariationId)
  && args.variations.some((variation) => variation.id === args.selectedVariationId)
);

const resolveVariationConnectorTargets = (args: {
  collapsed?: boolean;
  selectedVariationId?: string | null;
  variations: readonly CreateCanvasVariationLayoutInput[];
}): CreateCanvasVariationLayoutInput[] => {
  if (!shouldCollapseVariationSet(args)) return [...args.variations];
  return args.variations.filter((variation) => variation.id === args.selectedVariationId);
};

const resolveVariationSetWidth = (args: {
  collapsed?: boolean;
  selectedVariationId?: string | null;
  variations: readonly CreateCanvasVariationLayoutInput[];
}): number => {
  const count = args.variations.length;
  if (count <= 0) return 0;
  if (!shouldCollapseVariationSet(args)) return resolveVariationGroupWidth(count);
  const bounds = resolveVariationStackBounds(count);
  return CREATE_VARIATION_NODE_WIDTH + bounds.maxX - bounds.minX;
};

const resolvePageHorizontalFootprint = (
  page: CreateCanvasPageLayoutInput,
): { left: number; right: number } => {
  const variations = resolveCreateCanvasLayoutVariations(page);
  const variationWidth = resolveVariationSetWidth({
    collapsed: page.variationsCollapsed,
    selectedVariationId: page.selectedVariationId,
    variations,
  });
  const variationOverhang = Math.max(0, (variationWidth - CREATE_PAGE_NODE_WIDTH) / 2);
  return {
    left: variationOverhang,
    right: CREATE_PAGE_NODE_WIDTH + variationOverhang,
  };
};

const resolveVariationGroupStart = (args: {
  pageStart: { x: number; y: number };
  variations: CreateCanvasVariationLayoutInput[];
  parentWidth?: number;
  parentHeight?: number;
  collapsed?: boolean;
  selectedVariationId?: string | null;
}): { x: number; y: number } => {
  const variationSetWidth = resolveVariationSetWidth({
    collapsed: args.collapsed,
    selectedVariationId: args.selectedVariationId,
    variations: args.variations,
  });
  const parentWidth = args.parentWidth ?? CREATE_PAGE_NODE_WIDTH;
  const parentHeight = args.parentHeight ?? CREATE_PAGE_NODE_HEIGHT;
  return {
    x: args.pageStart.x + ((parentWidth - variationSetWidth) / 2),
    y: args.pageStart.y + parentHeight + CREATE_VARIATION_TOP_GAP,
  };
};

const resolveMainNodeStarts = (
  pages: readonly CreateCanvasPageLayoutInput[],
  showPlanner: boolean,
  seedNodeWidth: number,
  seedNodeHeight: number,
  seedVariations: CreateCanvasVariationLayoutInput[],
  seedVariationSet?: {
    collapsed?: boolean;
    selectedVariationId?: string | null;
  },
): Record<string, { x: number; y: number }> => {
  const starts: Record<string, { x: number; y: number }> = {
    [CREATE_SEED_NODE_ID]: CREATE_MAIN_START,
  };
  const seedSetCollapsed = shouldCollapseVariationSet({
    collapsed: seedVariationSet?.collapsed,
    selectedVariationId: seedVariationSet?.selectedVariationId,
    variations: seedVariations,
  });
  const seedVariationStart = seedSetCollapsed
    ? resolveVariationGroupStart({
      pageStart: CREATE_MAIN_START,
      variations: seedVariations,
      parentWidth: seedNodeWidth,
      parentHeight: seedNodeHeight,
      collapsed: seedVariationSet?.collapsed,
      selectedVariationId: seedVariationSet?.selectedVariationId,
    })
    : null;
  const seedVariationSetWidth = seedSetCollapsed
    ? resolveVariationSetWidth({
      collapsed: seedVariationSet?.collapsed,
      selectedVariationId: seedVariationSet?.selectedVariationId,
      variations: seedVariations,
    })
    : 0;
  const selectedSeedVariationHeight = seedSetCollapsed
    ? resolveVariationNodeHeight(seedVariations.find((variation) => variation.id === seedVariationSet?.selectedVariationId))
    : 0;
  let previousFootprintRight = seedVariationStart
    ? seedVariationStart.x + seedVariationSetWidth
    : starts[CREATE_SEED_NODE_ID]!.x + seedNodeWidth;
  const seedLaneBaseY = CREATE_MAIN_START.y;
  const selectedSeedVariationLaneBaseY = seedVariationStart
      ? seedVariationStart.y + ((selectedSeedVariationHeight - CREATE_PAGE_NODE_HEIGHT) / 2)
    : CREATE_MAIN_START.y;
  let pageLaneBaseY = selectedSeedVariationLaneBaseY;
  if (showPlanner) {
    const plannerX = starts[CREATE_SEED_NODE_ID]!.x + seedNodeWidth + CREATE_MAIN_GAP;
    const plannerY = seedLaneBaseY + ((seedNodeHeight - CREATE_PLANNER_NODE_HEIGHT) / 2);
    starts[CREATE_PLANNER_NODE_ID] = {
      x: plannerX,
      y: plannerY,
    };
    previousFootprintRight = plannerX + CREATE_PLANNER_NODE_WIDTH;
    pageLaneBaseY = plannerY + ((CREATE_PLANNER_NODE_HEIGHT - CREATE_PAGE_NODE_HEIGHT) / 2);
  }
  for (const [index, page] of pages.entries()) {
    const footprint = resolvePageHorizontalFootprint(page);
    const pageX = previousFootprintRight + CREATE_MAIN_GAP + footprint.left;
    starts[createPageNodeId(page.id)] = {
      x: pageX,
      y: pageLaneBaseY + CREATE_PAGE_LANE_OFFSETS_Y[index % CREATE_PAGE_LANE_OFFSETS_Y.length]!,
    };
    previousFootprintRight = pageX + footprint.right;
  }
  return starts;
};

const resolveVariationNodeStart = (args: {
  pageStart: { x: number; y: number };
  variations: CreateCanvasVariationLayoutInput[];
  index: number;
  parentWidth?: number;
  parentHeight?: number;
  collapsed?: boolean;
  selectedVariationId?: string | null;
}): { x: number; y: number } => {
  const variationCount = args.variations.length;
  const variation = args.variations[args.index];
  const isCollapsed = shouldCollapseVariationSet({
    collapsed: args.collapsed,
    selectedVariationId: args.selectedVariationId,
    variations: args.variations,
  });
  const groupStart = resolveVariationGroupStart({
    pageStart: args.pageStart,
    variations: args.variations,
    parentWidth: args.parentWidth,
    parentHeight: args.parentHeight,
    collapsed: args.collapsed,
    selectedVariationId: args.selectedVariationId,
  });

  if (isCollapsed && variation) {
    const bounds = resolveVariationStackBounds(args.variations.length);
    const selectedStart = {
      x: groupStart.x - bounds.minX,
      y: groupStart.y - bounds.minY,
    };
    if (variation.id === args.selectedVariationId) {
      return selectedStart;
    }
    const behindIndex = args.variations
      .filter((entry) => entry.id !== args.selectedVariationId)
      .findIndex((entry) => entry.id === variation.id);
    const offset = resolveVariationStackOffset(behindIndex);
    return {
      x: selectedStart.x + offset.x,
      y: selectedStart.y + offset.y,
    };
  }

  const columns = Math.min(CREATE_VARIATION_COLUMNS, Math.max(1, Math.floor(variationCount)));
  const row = Math.floor(args.index / CREATE_VARIATION_COLUMNS);
  const column = args.index % CREATE_VARIATION_COLUMNS;
  let previousRowsHeight = 0;
  for (let rowIndex = 0; rowIndex < row; rowIndex += 1) {
    const rowVariations = args.variations.slice(
      rowIndex * CREATE_VARIATION_COLUMNS,
      (rowIndex + 1) * CREATE_VARIATION_COLUMNS,
    );
    previousRowsHeight += Math.max(...rowVariations.map(resolveVariationNodeHeight), CREATE_VARIATION_NODE_HEIGHT);
  }
  return {
    x: groupStart.x + (Math.min(column, columns - 1) * (CREATE_VARIATION_NODE_WIDTH + CREATE_VARIATION_COLUMN_GAP)),
    y: groupStart.y
      + previousRowsHeight
      + (row * CREATE_VARIATION_ROW_GAP),
  };
};

export const buildCreateCanvasLayout = (args: {
  pages: CreateCanvasPageLayoutInput[];
  seedNodeHeight?: number;
  seedNodeWidth?: number;
  seedVariationConnectorStartY?: number;
  seedVariationSetCollapsed?: boolean;
  selectedSeedVariationId?: string | null;
  seedVariations?: CreateCanvasVariationLayoutInput[];
  showExport?: boolean;
  showPlanner?: boolean;
  sourceCount?: number;
}): CanvasGraphLayout => {
  const sourceCount = Math.max(0, Math.floor(args.sourceCount ?? 0));
  const seedVariations = args.seedVariations ?? [];
  const seedNodeWidth = Math.max(1, Math.ceil(args.seedNodeWidth ?? CREATE_SEED_NODE_WIDTH));
  const seedNodeHeight = Math.max(CREATE_SEED_NODE_HEIGHT, Math.ceil(args.seedNodeHeight ?? CREATE_SEED_NODE_HEIGHT));
  const shouldShowExport = args.showExport ?? args.pages.length > 0;
  const showPlanner = args.showPlanner ?? false;
  const plannerSourceSeedVariationId = shouldCollapseVariationSet({
    collapsed: args.seedVariationSetCollapsed,
    selectedVariationId: args.selectedSeedVariationId,
    variations: seedVariations,
  })
    ? args.selectedSeedVariationId ?? null
    : null;
  const firstPageSourceNodeId = plannerSourceSeedVariationId
    ? createSeedVariationNodeId(plannerSourceSeedVariationId)
    : CREATE_SEED_NODE_ID;
  const plannerSourceNodeId = CREATE_SEED_NODE_ID;
  const mainNodeStarts = resolveMainNodeStarts(args.pages, showPlanner, seedNodeWidth, seedNodeHeight, seedVariations, {
    collapsed: args.seedVariationSetCollapsed,
    selectedVariationId: args.selectedSeedVariationId,
  });
  const lastPage = args.pages[args.pages.length - 1] ?? null;
  const lastPageFootprint = lastPage ? resolvePageHorizontalFootprint(lastPage) : null;
  const exportAnchorNodeId = lastPage
    ? createPageNodeId(lastPage.id)
    : showPlanner
      ? CREATE_PLANNER_NODE_ID
      : CREATE_SEED_NODE_ID;
  const exportAnchorStart = mainNodeStarts[exportAnchorNodeId];
  const exportAnchorWidth = lastPage
    ? lastPageFootprint?.right ?? CREATE_PAGE_NODE_WIDTH
    : showPlanner
      ? CREATE_PLANNER_NODE_WIDTH
      : seedNodeWidth;
  const exportAnchorHeight = lastPage
    ? CREATE_PAGE_NODE_HEIGHT
    : showPlanner
      ? CREATE_PLANNER_NODE_HEIGHT
      : seedNodeHeight;
  const nodes: CanvasGraphNodeInput[] = [
    { id: CREATE_SEED_NODE_ID, width: seedNodeWidth, height: seedNodeHeight },
    ...(showPlanner ? [{ id: CREATE_PLANNER_NODE_ID, width: CREATE_PLANNER_NODE_WIDTH, height: CREATE_PLANNER_NODE_HEIGHT }] : []),
    ...Array.from({ length: sourceCount }, (_, index) => ({
      id: createSourceAttachmentNodeId(index),
      width: 128,
      height: 92,
    })),
    ...args.pages.map((page) => ({
      id: createPageNodeId(page.id),
      width: CREATE_PAGE_NODE_WIDTH,
      height: CREATE_PAGE_NODE_HEIGHT,
    })),
    ...args.pages.flatMap((page) => {
      const variations = resolveCreateCanvasLayoutVariations(page);
      return variations.map((variation) => ({
        id: createVariationNodeId(page.id, variation.id),
        width: CREATE_VARIATION_NODE_WIDTH,
        height: resolveVariationNodeHeight(variation),
      }));
    }),
    ...seedVariations.map((variation) => ({
      id: createSeedVariationNodeId(variation.id),
      width: CREATE_VARIATION_NODE_WIDTH,
      height: resolveVariationNodeHeight(variation),
    })),
    ...(shouldShowExport ? [{ id: CREATE_EXPORT_NODE_ID, width: CREATE_EXPORT_NODE_WIDTH, height: CREATE_EXPORT_NODE_HEIGHT }] : []),
  ];

  const groups: CanvasGraphGroupInput[] = [
    {
      id: 'create-seed-main',
      nodeIds: [CREATE_SEED_NODE_ID],
      direction: 'right' as const,
      start: mainNodeStarts[CREATE_SEED_NODE_ID],
    },
    ...(showPlanner ? [{
      id: 'create-planner-main',
      nodeIds: [CREATE_PLANNER_NODE_ID],
      direction: 'right' as const,
      start: mainNodeStarts[CREATE_PLANNER_NODE_ID],
    }] : []),
    ...args.pages.map((page) => ({
      id: `create-main-${page.id}`,
      nodeIds: [createPageNodeId(page.id)],
      direction: 'right' as const,
      start: mainNodeStarts[createPageNodeId(page.id)],
    })),
    ...(sourceCount > 0 ? [{
      id: 'create-source-attachments',
      nodeIds: Array.from({ length: sourceCount }, (_, index) => createSourceAttachmentNodeId(index)),
      direction: 'down' as const,
      gap: 22,
      attachTo: {
        nodeId: CREATE_SEED_NODE_ID,
        edge: 'left' as const,
        gap: 92,
        align: 'center' as const,
      },
    }] : []),
    ...seedVariations.map((variation, index) => ({
      id: `create-seed-variation-${index + 1}`,
      nodeIds: [createSeedVariationNodeId(variation.id)],
      direction: 'right' as const,
      start: resolveVariationNodeStart({
        pageStart: mainNodeStarts[CREATE_SEED_NODE_ID]!,
        variations: seedVariations,
        index,
        parentWidth: seedNodeWidth,
        parentHeight: seedNodeHeight,
        collapsed: args.seedVariationSetCollapsed,
        selectedVariationId: args.selectedSeedVariationId,
      }),
    })),
    ...args.pages.flatMap((page) => {
      const variations = resolveCreateCanvasLayoutVariations(page);
      return variations.map((variation, index) => ({
        id: `create-page-${page.id}-variation-${index + 1}`,
        nodeIds: [createVariationNodeId(page.id, variation.id)],
        direction: 'right' as const,
        start: resolveVariationNodeStart({
          pageStart: mainNodeStarts[createPageNodeId(page.id)]!,
          variations,
          collapsed: page.variationsCollapsed,
          selectedVariationId: page.selectedVariationId,
          index,
        }),
      }));
    }),
    ...(shouldShowExport ? [{
      id: 'create-export',
      nodeIds: [CREATE_EXPORT_NODE_ID],
      direction: 'right' as const,
      start: {
        x: (exportAnchorStart?.x ?? CREATE_MAIN_START.x) + exportAnchorWidth + CREATE_MAIN_GAP,
        y: (exportAnchorStart?.y ?? CREATE_MAIN_START.y) + ((exportAnchorHeight - CREATE_EXPORT_NODE_HEIGHT) / 2),
      },
    }] : []),
  ];

  const edges: CanvasGraphEdgeInput[] = [
    ...(showPlanner ? [{
      id: 'seed-to-planner',
      fromNodeId: plannerSourceNodeId,
      toNodeId: CREATE_PLANNER_NODE_ID,
      fromEdge: 'right' as const,
      toEdge: 'left' as const,
      delayMs: 120,
    }] : []),
    ...args.pages.map((page, index) => ({
      id: index === 0
        ? showPlanner ? 'planner-to-page-1' : 'selected-design-to-page-1'
        : `page-${args.pages[index - 1]!.id}-to-${page.id}`,
      fromNodeId: index === 0
        ? showPlanner ? CREATE_PLANNER_NODE_ID : firstPageSourceNodeId
        : createPageNodeId(args.pages[index - 1]!.id),
      toNodeId: createPageNodeId(page.id),
      fromEdge: 'right' as const,
      toEdge: 'left' as const,
      delayMs: 160 + (index * 70),
    })),
    ...resolveVariationConnectorTargets({
      collapsed: args.seedVariationSetCollapsed,
      selectedVariationId: args.selectedSeedVariationId,
      variations: seedVariations,
    }).map((variation, index) => ({
      id: `seed-to-variation-${variation.id}`,
      fromNodeId: CREATE_SEED_NODE_ID,
      toNodeId: createSeedVariationNodeId(variation.id),
      fromEdge: 'bottom' as const,
      toEdge: 'top' as const,
      emphasis: args.selectedSeedVariationId === variation.id ? 'selected' as const : 'default' as const,
      delayMs: 220 + (index * 40),
    })),
    ...args.pages.flatMap((page) => {
      const variations = resolveCreateCanvasLayoutVariations(page);
      return resolveVariationConnectorTargets({
        collapsed: page.variationsCollapsed,
        selectedVariationId: page.selectedVariationId,
        variations,
      }).map((variation, index) => ({
        id: `page-${page.id}-to-variation-${variation.id}`,
        fromNodeId: createPageNodeId(page.id),
        toNodeId: createVariationNodeId(page.id, variation.id),
        fromEdge: 'bottom' as const,
        toEdge: 'top' as const,
        emphasis: page.selectedVariationId === variation.id ? 'selected' as const : 'default' as const,
        delayMs: 260 + (index * 40),
      }));
    }),
    ...(shouldShowExport ? [{
      id: args.pages.length > 0 ? 'pages-to-export' : 'selected-design-to-export',
      fromNodeId: exportAnchorNodeId,
      toNodeId: CREATE_EXPORT_NODE_ID,
      fromEdge: 'right' as const,
      toEdge: 'left' as const,
      delayMs: 240,
    }] : []),
  ];

  const layout = buildCanvasGraphLayout({
    nodes,
    groups,
    edges,
    worldPadding: 520,
  });

  const seedRect = layout.rects[CREATE_SEED_NODE_ID];
  const seedVariationConnectorStartY = Number(args.seedVariationConnectorStartY);
  if (seedRect && Number.isFinite(seedVariationConnectorStartY) && seedVariationConnectorStartY > 0) {
    const connectorFrom = {
      x: seedRect.x + (seedRect.width / 2),
      y: seedRect.y + Math.min(seedRect.height, seedVariationConnectorStartY),
    };
    return {
      ...layout,
      connectors: layout.connectors.map((connector) => (
        connector.id.startsWith('seed-to-variation-')
          ? { ...connector, from: connectorFrom, fromEdge: 'bottom' as const }
          : connector
      )),
    };
  }

  return layout;
};
