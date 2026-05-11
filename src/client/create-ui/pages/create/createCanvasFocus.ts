import {
  CREATE_EXPORT_NODE_ID,
  CREATE_PLANNER_NODE_ID,
  CREATE_SEED_NODE_ID,
  CREATE_SEED_VARIATION_GROUP_ID,
  createPageNodeId,
  createSeedVariationNodeId,
  createSourceAttachmentNodeId,
  createVariationNodeId,
  resolveCreateCanvasLayoutVariations,
  type CreateCanvasPageLayoutInput,
  type CreateCanvasVariationLayoutInput,
} from './createCanvasLayout';
import type { CanvasRect } from '../sketch-canvas/sceneLayout';

export const CREATE_CANVAS_ALL_FOCUS_ID = 'create-all';
export const CREATE_CANVAS_SOURCE_FOCUS_ID = 'create-source-images';

export type CreateCanvasFocusKind =
  | 'all'
  | 'seed'
  | 'planner'
  | 'source'
  | 'seed-variation-group'
  | 'seed-variation'
  | 'page'
  | 'variation-group'
  | 'variation'
  | 'export';

export type CreateCanvasFocusArea = {
  id: string;
  kind: CreateCanvasFocusKind;
  rect: CanvasRect;
};

export const createPageVariationGroupFocusId = (pageId: string): string => (
  `create-page-${pageId}-variations`
);

export const buildCreateFocusBounds = (rects: readonly CanvasRect[]): CanvasRect | null => {
  if (rects.length === 0) return null;
  const bounds = rects.reduce((current, rect) => ({
    minX: Math.min(current.minX, rect.x),
    minY: Math.min(current.minY, rect.y),
    maxX: Math.max(current.maxX, rect.x + rect.width),
    maxY: Math.max(current.maxY, rect.y + rect.height),
  }), {
    minX: rects[0]!.x,
    minY: rects[0]!.y,
    maxX: rects[0]!.x + rects[0]!.width,
    maxY: rects[0]!.y + rects[0]!.height,
  });

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
};

const isPointInsideRect = (rect: CanvasRect, point: { x: number; y: number }): boolean => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
);

export const resolveCreateFocusAreaAtPoint = (
  areas: readonly CreateCanvasFocusArea[],
  point: { x: number; y: number },
): string | null => {
  const hits = areas
    .filter((area) => area.kind !== 'all' && isPointInsideRect(area.rect, point))
    .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
  return hits[0]?.id ?? null;
};

export const isCreateFocusNavigationBlockedTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest([
    'textarea',
    'input',
    'select',
    'option',
    'button',
    'label',
    'a[href]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="slider"]',
  ].join(', ')));
};

export const buildCreateCanvasFocusAreas = (args: {
  pages: CreateCanvasPageLayoutInput[];
  seedVariations?: CreateCanvasVariationLayoutInput[];
  seedVariationSetCollapsed?: boolean;
  rects: Record<string, CanvasRect>;
  sourceCount: number;
  shouldShowExport: boolean;
  shouldShowPlanner?: boolean;
}): CreateCanvasFocusArea[] => {
  const areas: CreateCanvasFocusArea[] = [];
  const seedRect = args.rects[CREATE_SEED_NODE_ID];
  if (seedRect) {
    areas.push({ id: CREATE_SEED_NODE_ID, kind: 'seed', rect: seedRect });
  }

  if (args.shouldShowPlanner) {
    const plannerRect = args.rects[CREATE_PLANNER_NODE_ID];
    if (plannerRect) {
      areas.push({ id: CREATE_PLANNER_NODE_ID, kind: 'planner', rect: plannerRect });
    }
  }

  const sourceRects = Array.from({ length: Math.max(0, Math.floor(args.sourceCount)) }, (_, index) => (
    args.rects[createSourceAttachmentNodeId(index)]
  )).filter((rect): rect is CanvasRect => Boolean(rect));
  const sourceRect = buildCreateFocusBounds(sourceRects);
  if (sourceRect) {
    areas.push({ id: CREATE_CANVAS_SOURCE_FOCUS_ID, kind: 'source', rect: sourceRect });
  }

  const seedVariationRects = (args.seedVariations ?? [])
    .map((variation) => args.rects[createSeedVariationNodeId(variation.id)])
    .filter((rect): rect is CanvasRect => Boolean(rect));
  const seedVariationGroupRect = buildCreateFocusBounds(seedVariationRects);
  if (seedVariationGroupRect) {
    areas.push({ id: CREATE_SEED_VARIATION_GROUP_ID, kind: 'seed-variation-group', rect: seedVariationGroupRect });
  }
  if (args.seedVariationSetCollapsed !== true) {
    (args.seedVariations ?? []).forEach((variation) => {
      const rect = args.rects[createSeedVariationNodeId(variation.id)];
      if (rect) {
        areas.push({ id: createSeedVariationNodeId(variation.id), kind: 'seed-variation', rect });
      }
    });
  }

  for (const page of args.pages) {
    const pageRect = args.rects[createPageNodeId(page.id)];
    if (pageRect) {
      areas.push({ id: createPageNodeId(page.id), kind: 'page', rect: pageRect });
    }
    const variations = resolveCreateCanvasLayoutVariations(page);
    const variationRects = variations
      .map((variation) => args.rects[createVariationNodeId(page.id, variation.id)])
      .filter((rect): rect is CanvasRect => Boolean(rect));
    const variationGroupRect = buildCreateFocusBounds(variationRects);
    if (variationGroupRect) {
      areas.push({ id: createPageVariationGroupFocusId(page.id), kind: 'variation-group', rect: variationGroupRect });
    }
    if (page.variationsCollapsed !== true) {
      variations.forEach((variation) => {
        const rect = args.rects[createVariationNodeId(page.id, variation.id)];
        if (rect) {
          areas.push({ id: createVariationNodeId(page.id, variation.id), kind: 'variation', rect });
        }
      });
    }
  }

  if (args.shouldShowExport) {
    const exportRect = args.rects[CREATE_EXPORT_NODE_ID];
    if (exportRect) {
      areas.push({ id: CREATE_EXPORT_NODE_ID, kind: 'export', rect: exportRect });
    }
  }

  const allRect = buildCreateFocusBounds(Object.values(args.rects));
  if (allRect) {
    areas.push({ id: CREATE_CANVAS_ALL_FOCUS_ID, kind: 'all', rect: allRect });
  }

  return areas;
};
