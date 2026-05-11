import { describe, expect, it } from 'vitest';

import {
  CREATE_PLANNER_NODE_ID,
  CREATE_SEED_NODE_ID,
  CREATE_SEED_VARIATION_GROUP_ID,
  buildCreateCanvasLayout,
  createPageNodeId,
  createSeedVariationNodeId,
  createVariationNodeId,
} from './createCanvasLayout';
import {
  CREATE_CANVAS_ALL_FOCUS_ID,
  CREATE_CANVAS_SOURCE_FOCUS_ID,
  buildCreateCanvasFocusAreas,
  createPageVariationGroupFocusId,
  resolveCreateFocusAreaAtPoint,
} from './createCanvasFocus';

describe('buildCreateCanvasFocusAreas', () => {
  it('creates stable focus zones for input, source images, design groups, individual designs, and overview', () => {
    const pages = [
      { id: 'pricing', variations: [{ id: 'branch-1' }, { id: 'branch-2' }] },
      { id: 'features', variations: [{ id: 'branch-1' }] },
    ];
    const seedVariations = [{ id: 'seed-1' }, { id: 'seed-2' }];
    const layout = buildCreateCanvasLayout({ sourceCount: 2, seedVariations, pages, showExport: false });

    expect(buildCreateCanvasFocusAreas({
      pages,
      seedVariations,
      rects: layout.rects,
      sourceCount: 2,
      shouldShowExport: false,
    }).map((area) => area.id)).toEqual([
      CREATE_SEED_NODE_ID,
      CREATE_CANVAS_SOURCE_FOCUS_ID,
      CREATE_SEED_VARIATION_GROUP_ID,
      createSeedVariationNodeId('seed-1'),
      createSeedVariationNodeId('seed-2'),
      createPageNodeId('pricing'),
      createPageVariationGroupFocusId('pricing'),
      createVariationNodeId('pricing', 'branch-1'),
      createVariationNodeId('pricing', 'branch-2'),
      createPageNodeId('features'),
      createPageVariationGroupFocusId('features'),
      createVariationNodeId('features', 'branch-1'),
      CREATE_CANVAS_ALL_FOCUS_ID,
    ]);
  });

  it('keeps focus zones working with the variationIds page shape', () => {
    const pages = [{ id: 'pricing', variationIds: ['branch-1'] }];
    const layout = buildCreateCanvasLayout({ pages, showExport: false });

    expect(buildCreateCanvasFocusAreas({
      pages,
      rects: layout.rects,
      sourceCount: 0,
      shouldShowExport: false,
    }).map((area) => area.id)).toContain(createVariationNodeId('pricing', 'branch-1'));
  });

  it('places the planner between the selected design and first page when shown', () => {
    const pages = [{ id: 'research', variations: [{ id: 'branch-1' }] }];
    const layout = buildCreateCanvasLayout({ pages, showPlanner: true, showExport: false });

    expect(layout.rects[CREATE_PLANNER_NODE_ID]).toBeTruthy();
    expect(layout.rects[CREATE_PLANNER_NODE_ID]!.x).toBeGreaterThan(layout.rects[CREATE_SEED_NODE_ID]!.x);
    expect(layout.rects[createPageNodeId('research')]!.x).toBeGreaterThan(layout.rects[CREATE_PLANNER_NODE_ID]!.x);
    const seedToPlanner = layout.connectors.find((connector) => connector.id === 'seed-to-planner');
    expect(seedToPlanner?.from.x).toBe(layout.rects[CREATE_SEED_NODE_ID]!.x + layout.rects[CREATE_SEED_NODE_ID]!.width);
    expect(seedToPlanner?.from.y).toBe(layout.rects[CREATE_SEED_NODE_ID]!.y + (layout.rects[CREATE_SEED_NODE_ID]!.height / 2));
    expect(layout.connectors.map((connector) => connector.id)).toEqual([
      'seed-to-planner',
      'planner-to-page-1',
      'page-research-to-variation-branch-1',
    ]);

    expect(buildCreateCanvasFocusAreas({
      pages,
      rects: layout.rects,
      sourceCount: 0,
      shouldShowPlanner: true,
      shouldShowExport: false,
    }).map((area) => area.id)).toContain(CREATE_PLANNER_NODE_ID);
  });

  it('keeps selected page designs spread out when the page is not collapsed', () => {
    const pages = [{
      id: 'pricing',
      selectedVariationId: 'branch-1',
      variationsCollapsed: false,
      variations: [{ id: 'branch-1' }, { id: 'branch-2' }, { id: 'branch-3' }],
    }];
    const layout = buildCreateCanvasLayout({ pages, showExport: false });
    const firstVariation = layout.rects[createVariationNodeId('pricing', 'branch-1')]!;
    const secondVariation = layout.rects[createVariationNodeId('pricing', 'branch-2')]!;
    const thirdVariation = layout.rects[createVariationNodeId('pricing', 'branch-3')]!;

    expect(secondVariation.x).toBeGreaterThan(firstVariation.x + firstVariation.width);
    expect(thirdVariation.x).toBeGreaterThan(secondVariation.x + secondVariation.width);
  });

  it('uses only the seed design group focus zone when the seed stack is collapsed', () => {
    const seedVariations = [{ id: 'seed-1' }, { id: 'seed-2' }];
    const layout = buildCreateCanvasLayout({
      seedVariations,
      seedVariationSetCollapsed: true,
      selectedSeedVariationId: 'seed-1',
      pages: [],
      showExport: false,
    });

    const focusIds = buildCreateCanvasFocusAreas({
      pages: [],
      seedVariations,
      seedVariationSetCollapsed: true,
      rects: layout.rects,
      sourceCount: 0,
      shouldShowExport: false,
    }).map((area) => area.id);

    expect(focusIds).toContain(CREATE_SEED_VARIATION_GROUP_ID);
    expect(focusIds).not.toContain(createSeedVariationNodeId('seed-1'));
    expect(focusIds).not.toContain(createSeedVariationNodeId('seed-2'));
  });

  it('returns individual seed design focus zones when the seed stack is expanded', () => {
    const seedVariations = [{ id: 'seed-1' }, { id: 'seed-2' }];
    const layout = buildCreateCanvasLayout({
      seedVariations,
      seedVariationSetCollapsed: false,
      selectedSeedVariationId: 'seed-1',
      pages: [],
      showExport: false,
    });

    const focusIds = buildCreateCanvasFocusAreas({
      pages: [],
      seedVariations,
      seedVariationSetCollapsed: false,
      rects: layout.rects,
      sourceCount: 0,
      shouldShowExport: false,
    }).map((area) => area.id);

    expect(focusIds).toContain(CREATE_SEED_VARIATION_GROUP_ID);
    expect(focusIds).toContain(createSeedVariationNodeId('seed-1'));
    expect(focusIds).toContain(createSeedVariationNodeId('seed-2'));
  });

  it('uses only the page design group focus zone when a page variation stack is collapsed', () => {
    const pages = [{
      id: 'pricing',
      selectedVariationId: 'branch-1',
      variationsCollapsed: true,
      variations: [{ id: 'branch-1' }, { id: 'branch-2' }],
    }];
    const layout = buildCreateCanvasLayout({ pages, showExport: false });

    const focusIds = buildCreateCanvasFocusAreas({
      pages,
      rects: layout.rects,
      sourceCount: 0,
      shouldShowExport: false,
    }).map((area) => area.id);

    expect(focusIds).toContain(createPageVariationGroupFocusId('pricing'));
    expect(focusIds).not.toContain(createVariationNodeId('pricing', 'branch-1'));
    expect(focusIds).not.toContain(createVariationNodeId('pricing', 'branch-2'));
  });
});

describe('resolveCreateFocusAreaAtPoint', () => {
  it('prefers the smallest matching focus zone', () => {
    const pages = [{ id: 'pricing', variations: [{ id: 'branch-1' }, { id: 'branch-2' }] }];
    const layout = buildCreateCanvasLayout({ pages, showExport: false });
    const areas = buildCreateCanvasFocusAreas({
      pages,
      rects: layout.rects,
      sourceCount: 0,
      shouldShowExport: false,
    });
    const variationRect = layout.rects[createVariationNodeId('pricing', 'branch-2')]!;

    expect(resolveCreateFocusAreaAtPoint(areas, {
      x: variationRect.x + 10,
      y: variationRect.y + 10,
    })).toBe(createVariationNodeId('pricing', 'branch-2'));
  });

  it('resolves a collapsed page design hit to the group zone', () => {
    const pages = [{
      id: 'pricing',
      selectedVariationId: 'branch-1',
      variationsCollapsed: true,
      variations: [{ id: 'branch-1' }, { id: 'branch-2' }],
    }];
    const layout = buildCreateCanvasLayout({ pages, showExport: false });
    const areas = buildCreateCanvasFocusAreas({
      pages,
      rects: layout.rects,
      sourceCount: 0,
      shouldShowExport: false,
    });
    const variationRect = layout.rects[createVariationNodeId('pricing', 'branch-1')]!;

    expect(resolveCreateFocusAreaAtPoint(areas, {
      x: variationRect.x + 10,
      y: variationRect.y + 10,
    })).toBe(createPageVariationGroupFocusId('pricing'));
  });
});
