import { describe, expect, it } from 'vitest';

import {
  CREATE_SEED_NODE_ID,
  buildCreateCanvasLayout,
  createPageNodeId,
} from '../create/createCanvasLayout';
import { fitCameraToRects, type CanvasRect } from './sceneLayout';

const visibleBounds = (camera: { x: number; y: number; zoom: number }, rects: CanvasRect[]) => {
  const left = Math.min(...rects.map((rect) => (rect.x * camera.zoom) + camera.x));
  const top = Math.min(...rects.map((rect) => (rect.y * camera.zoom) + camera.y));
  const right = Math.max(...rects.map((rect) => ((rect.x + rect.width) * camera.zoom) + camera.x));
  const bottom = Math.max(...rects.map((rect) => ((rect.y + rect.height) * camera.zoom) + camera.y));
  return { left, top, right, bottom };
};

describe('fitCameraToRects', () => {
  it('relaxes the minimum zoom only when content needs more room to fit', () => {
    const rects = [{ x: 0, y: 0, width: 4000, height: 1000 }];

    const locked = fitCameraToRects({
      rects,
      viewportWidth: 1000,
      viewportHeight: 500,
      padding: 50,
      minZoom: 0.24,
      maxZoom: 0.9,
    });
    const expanded = fitCameraToRects({
      rects,
      viewportWidth: 1000,
      viewportHeight: 500,
      padding: 50,
      minZoom: 0.24,
      maxZoom: 0.9,
      expandMinZoomToFit: true,
    });

    expect(locked.zoom).toBe(0.24);
    expect(expanded.zoom).toBeLessThan(0.24);
    expect(expanded.zoom).toBeCloseTo(0.225);
  });

  it('allows the create workspace zoom floor to cover every canvas node', () => {
    const layout = buildCreateCanvasLayout({
      seedVariations: [
        { id: 'seed-a', imageSize: { width: 1024, height: 1536 } },
        { id: 'seed-b', imageSize: { width: 1024, height: 1536 } },
        { id: 'seed-c', imageSize: { width: 1024, height: 1536 } },
      ],
      pages: [
        {
          id: 'page-1',
          variations: [
            { id: 'page-1-a', imageSize: { width: 1024, height: 1536 } },
            { id: 'page-1-b', imageSize: { width: 1024, height: 1536 } },
            { id: 'page-1-c', imageSize: { width: 1024, height: 1536 } },
          ],
        },
        {
          id: 'page-2',
          variations: [
            { id: 'page-2-a', imageSize: { width: 1536, height: 1024 } },
            { id: 'page-2-b', imageSize: { width: 1536, height: 1024 } },
            { id: 'page-2-c', imageSize: { width: 1536, height: 1024 } },
          ],
        },
      ],
      seedNodeHeight: 920,
      seedNodeWidth: 980,
      selectedSeedVariationId: 'seed-a',
    });
    const seedRect = layout.rects[CREATE_SEED_NODE_ID]!;
    const firstPageRect = layout.rects[createPageNodeId('page-1')]!;
    const allRects = Object.values(layout.rects);
    const viewportWidth = 1440;
    const viewportHeight = 900;
    const padding = 82;

    const focusCamera = fitCameraToRects({
      rects: [seedRect, firstPageRect],
      viewportWidth,
      viewportHeight,
      padding,
      minZoom: 0.24,
      maxZoom: 0.9,
      expandMinZoomToFit: true,
    });
    const overviewCamera = fitCameraToRects({
      rects: allRects,
      viewportWidth,
      viewportHeight,
      padding,
      minZoom: 0.24,
      maxZoom: 0.9,
      expandMinZoomToFit: true,
    });

    const zoomFloor = Math.min(0.24, focusCamera.zoom, overviewCamera.zoom);
    const bounds = visibleBounds(overviewCamera, allRects);

    expect(overviewCamera.zoom).toBeLessThan(focusCamera.zoom);
    expect(zoomFloor).toBe(overviewCamera.zoom);
    expect(bounds.left).toBeGreaterThanOrEqual(padding - 0.001);
    expect(bounds.top).toBeGreaterThanOrEqual(padding - 0.001);
    expect(bounds.right).toBeLessThanOrEqual(viewportWidth - padding + 0.001);
    expect(bounds.bottom).toBeLessThanOrEqual(viewportHeight - padding + 0.001);
  });
});
