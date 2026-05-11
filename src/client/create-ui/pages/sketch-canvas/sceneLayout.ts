export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasConnector = {
  id: string;
  from: CanvasPoint;
  to: CanvasPoint;
  fromEdge?: 'top' | 'right' | 'bottom' | 'left';
  toEdge?: 'top' | 'right' | 'bottom' | 'left';
  emphasis?: 'default' | 'selected';
  delayMs?: number;
};

export type CanvasConnectorJunction = {
  id: string;
  center: CanvasPoint;
  emphasis?: 'default' | 'selected';
  delayMs?: number;
};

export type CanvasConnectorLayout = {
  connectors: CanvasConnector[];
  junctions: CanvasConnectorJunction[];
};

export type InfiniteCanvasCamera = {
  x: number;
  y: number;
  zoom: number;
};

const DRAFT_NODE_PORTRAIT_WIDTH = 540;
const DRAFT_NODE_LANDSCAPE_WIDTH = 840;
const DRAFT_NODE_CHROME_HEIGHT = 148;
const DRAFT_NODE_GAP = 124;
const DRAFT_NODE_COUNT = 3;
const DRAFT_NODE_PREVIEW_TOP_OFFSET = 64;
const DRAFT_NODE_PORTRAIT_TOP_GAP = 260;
const EXPORT_NODE_PORTRAIT_WIDTH = 1024;
const EXPORT_NODE_LANDSCAPE_WIDTH = 1280;
const EXPORT_NODE_CHROME_HEIGHT = 0;
const EXPORT_NODE_PREVIEW_TOP_OFFSET = 0;
const EXPORT_NODE_PORTRAIT_TOP_GAP = 280;
export const SKETCH_NODE_DEFAULT_WIDTH = 980;
export const SKETCH_NODE_DEFAULT_HEIGHT = 820;
export const SKETCH_NODE_PADDING_X = 32;
export const SKETCH_NODE_PADDING_Y = 24;
export const SKETCH_NODE_HEADER_HEIGHT = 56;
export const SKETCH_NODE_COMPOSER_GAP = 12;
const SKETCH_NODE_GRID_GAP = 12;
const SKETCH_NODE_CONTENT_GAP = 16;
const SKETCH_NODE_PROMPT_HEIGHT = 170;
const SKETCH_NODE_CONTROLS_HEIGHT = 52;
export const SKETCH_CANVAS_ASPECT_WIDTH = 1200;
export const SKETCH_CANVAS_ASPECT_HEIGHT = 504;

export const resolveSketchNodeWidth = (viewportWidth?: number): number => {
  if (!viewportWidth || viewportWidth >= 860) return SKETCH_NODE_DEFAULT_WIDTH;
  if (viewportWidth >= 640) return 820;
  if (viewportWidth >= 430) return 640;
  return 560;
};

const normalizeSketchNodeCanvasHeight = (height: number | undefined): number => (
  Number.isFinite(height) && height && height > 0 ? height : SKETCH_CANVAS_ASPECT_HEIGHT
);

const resolveSketchNodeHeight = (
  width: number,
  options?: {
    promptHeight?: number;
    sketchCanvasHeight?: number;
  },
): number => {
  const innerWidth = Math.max(1, width - (SKETCH_NODE_PADDING_X * 2));
  const sketchCanvasHeight = innerWidth * (
    normalizeSketchNodeCanvasHeight(options?.sketchCanvasHeight) / SKETCH_CANVAS_ASPECT_WIDTH
  );
  const promptHeight = Number.isFinite(options?.promptHeight) && options?.promptHeight && options.promptHeight > 0
    ? options.promptHeight
    : SKETCH_NODE_PROMPT_HEIGHT;
  const contentHeight = (
    SKETCH_NODE_HEADER_HEIGHT
    + SKETCH_NODE_COMPOSER_GAP
    + sketchCanvasHeight
    + SKETCH_NODE_CONTENT_GAP
    + promptHeight
    + SKETCH_NODE_GRID_GAP
    + SKETCH_NODE_CONTROLS_HEIGHT
  );
  return Math.max(560, Math.round(contentHeight + (SKETCH_NODE_PADDING_Y * 2) + 84));
};

const buildDraftPreviewRect = (rect: CanvasRect): CanvasRect => ({
  x: rect.x,
  y: rect.y + DRAFT_NODE_PREVIEW_TOP_OFFSET,
  width: rect.width,
  height: Math.max(1, rect.height - DRAFT_NODE_CHROME_HEIGHT),
});

const buildExportPreviewRect = (rect: CanvasRect): CanvasRect => ({
  x: rect.x,
  y: rect.y + EXPORT_NODE_PREVIEW_TOP_OFFSET,
  width: rect.width,
  height: Math.max(1, rect.height - EXPORT_NODE_CHROME_HEIGHT),
});

export const buildSketchCanvasSceneLayout = (
  displayAspect: number,
  options?: {
    promptHeight?: number;
    sketchCanvasHeight?: number;
    viewportWidth?: number;
  },
) => {
  const safeAspect = Number.isFinite(displayAspect) && displayAspect > 0 ? displayAspect : 3 / 4;
  const isPortrait = safeAspect < 1;
  const draftNodeWidth = isPortrait ? DRAFT_NODE_PORTRAIT_WIDTH : DRAFT_NODE_LANDSCAPE_WIDTH;
  const draftPreviewHeight = draftNodeWidth / safeAspect;
  const draftNodeHeight = draftPreviewHeight + DRAFT_NODE_CHROME_HEIGHT;

  const sketchNodeWidth = resolveSketchNodeWidth(options?.viewportWidth);
  const sketchRect: CanvasRect = {
    x: 720,
    y: 560,
    width: sketchNodeWidth,
    height: sketchNodeWidth === SKETCH_NODE_DEFAULT_WIDTH
      && !options?.promptHeight
      && !options?.sketchCanvasHeight
      ? SKETCH_NODE_DEFAULT_HEIGHT
      : resolveSketchNodeHeight(sketchNodeWidth, options),
  };
  const infoRect: CanvasRect = {
    x: 160,
    y: 620,
    width: 360,
    height: 420,
  };
  const waitlistRect: CanvasRect = {
    x: 840,
    y: 70,
    width: 740,
    height: 360,
  };
  const portraitDraftRowWidth = (DRAFT_NODE_COUNT * draftNodeWidth) + ((DRAFT_NODE_COUNT - 1) * DRAFT_NODE_GAP);
  const portraitDraftStartX = sketchRect.x + ((sketchRect.width - portraitDraftRowWidth) / 2);

  const draftRects: CanvasRect[] = isPortrait
    ? Array.from({ length: DRAFT_NODE_COUNT }, (_, index) => ({
      x: portraitDraftStartX + (index * (draftNodeWidth + DRAFT_NODE_GAP)),
      y: sketchRect.y + sketchRect.height + DRAFT_NODE_PORTRAIT_TOP_GAP,
      width: draftNodeWidth,
      height: draftNodeHeight,
    }))
    : Array.from({ length: DRAFT_NODE_COUNT }, (_, index) => ({
      x: 2120,
      y: 260 + (index * (draftNodeHeight + DRAFT_NODE_GAP)),
      width: draftNodeWidth,
      height: draftNodeHeight,
    }));

  const exportNodeWidth = isPortrait ? EXPORT_NODE_PORTRAIT_WIDTH : EXPORT_NODE_LANDSCAPE_WIDTH;
  const exportNodeHeight = (exportNodeWidth / safeAspect) + EXPORT_NODE_CHROME_HEIGHT;
  const draftRowBounds = {
    minX: Math.min(...draftRects.map((rect) => rect.x)),
    maxX: Math.max(...draftRects.map((rect) => rect.x + rect.width)),
    maxY: Math.max(...draftRects.map((rect) => rect.y + rect.height)),
  };
  const extractRect: CanvasRect = isPortrait
    ? {
      x: draftRowBounds.minX + (((draftRowBounds.maxX - draftRowBounds.minX) - exportNodeWidth) / 2),
      y: draftRowBounds.maxY + EXPORT_NODE_PORTRAIT_TOP_GAP,
      width: exportNodeWidth,
      height: exportNodeHeight,
    }
    : {
      x: 3040,
      y: 810,
      width: exportNodeWidth,
      height: exportNodeHeight,
    };

  const worldWidth = Math.max(4500, extractRect.x + extractRect.width + 520);
  const worldHeight = Math.max(
    2500,
    Math.max(
      sketchRect.y + sketchRect.height,
      extractRect.y + extractRect.height,
      ...draftRects.map((rect) => rect.y + rect.height),
    ) + 360,
  );

  return {
    infoRect,
    waitlistRect,
    sketchRect,
    draftRects,
    extractRect,
    worldWidth,
    worldHeight,
  };
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const rectCenter = (rect: CanvasRect): CanvasPoint => ({
  x: rect.x + (rect.width / 2),
  y: rect.y + (rect.height / 2),
});

export const rectAnchor = (
  rect: CanvasRect,
  edge: 'top' | 'right' | 'bottom' | 'left',
  ratio = 0.5,
  inset = 0,
): CanvasPoint => ({
  x: edge === 'left'
    ? rect.x + inset
    : edge === 'right'
      ? rect.x + rect.width - inset
      : rect.x + (rect.width * ratio),
  y: edge === 'top'
    ? rect.y + inset
    : edge === 'bottom'
      ? rect.y + rect.height - inset
      : rect.y + (rect.height * ratio),
});

const resolveHandlePoint = (
  point: CanvasPoint,
  edge: 'top' | 'right' | 'bottom' | 'left',
  distance: number,
): CanvasPoint => {
  if (edge === 'top') return { x: point.x, y: point.y - distance };
  if (edge === 'bottom') return { x: point.x, y: point.y + distance };
  if (edge === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
};

const oppositeEdge = (
  edge: 'top' | 'right' | 'bottom' | 'left',
): 'top' | 'right' | 'bottom' | 'left' => {
  if (edge === 'top') return 'bottom';
  if (edge === 'right') return 'left';
  if (edge === 'bottom') return 'top';
  return 'right';
};

export const buildConnectorPath = (connector: CanvasConnector): string => {
  const deltaX = connector.to.x - connector.from.x;
  const deltaY = connector.to.y - connector.from.y;
  const fromEdge = connector.fromEdge ?? 'right';
  const toEdge = connector.toEdge ?? 'left';
  const fromHandleDistance = Math.max(160, Math.min(520, Math.abs(deltaX) * 0.36));
  const toHandleDistance = Math.max(140, Math.min(420, (
    toEdge === 'top' || toEdge === 'bottom'
      ? Math.abs(deltaY) * 0.58
      : Math.abs(deltaX) * 0.38
  )));
  const fromHandle = resolveHandlePoint(connector.from, fromEdge, fromHandleDistance);
  const toHandle = resolveHandlePoint(connector.to, toEdge, toHandleDistance);
  return `M ${connector.from.x} ${connector.from.y} C ${fromHandle.x} ${fromHandle.y}, ${toHandle.x} ${toHandle.y}, ${connector.to.x} ${connector.to.y}`;
};

const averagePoint = (points: CanvasPoint[]): CanvasPoint => {
  const total = points.reduce((current, point) => ({
    x: current.x + point.x,
    y: current.y + point.y,
  }), { x: 0, y: 0 });
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
};

const buildFanoutJunctionPoint = (
  from: CanvasPoint,
  fromEdge: 'top' | 'right' | 'bottom' | 'left',
  targets: CanvasPoint[],
): CanvasPoint => {
  const targetCenter = averagePoint(targets);
  if (fromEdge === 'right' || fromEdge === 'left') {
    const direction = fromEdge === 'right' ? 1 : -1;
    const distance = clamp(Math.abs(targetCenter.x - from.x) * 0.28, 220, 420);
    return {
      x: from.x + (direction * distance),
      y: targetCenter.y,
    };
  }

  const direction = fromEdge === 'bottom' ? 1 : -1;
  const distance = clamp(Math.abs(targetCenter.y - from.y) * 0.28, 180, 360);
  return {
    x: targetCenter.x,
    y: from.y + (direction * distance),
  };
};

const buildFanoutConnectors = (args: {
  id: string;
  from: CanvasPoint;
  fromEdge: 'top' | 'right' | 'bottom' | 'left';
  destinations: Array<{
    id: string;
    to: CanvasPoint;
    toEdge: 'top' | 'right' | 'bottom' | 'left';
    emphasis?: 'default' | 'selected';
    delayMs?: number;
  }>;
  delayMs?: number;
}): CanvasConnectorLayout => {
  if (args.destinations.length <= 1) {
    return {
      connectors: args.destinations.map((destination) => ({
        id: destination.id,
        from: args.from,
        fromEdge: args.fromEdge,
        to: destination.to,
        toEdge: destination.toEdge,
        emphasis: destination.emphasis,
        delayMs: destination.delayMs,
      })),
      junctions: [],
    };
  }

  const junctionPoint = buildFanoutJunctionPoint(
    args.from,
    args.fromEdge,
    args.destinations.map((destination) => destination.to),
  );
  const isSelected = args.destinations.some((destination) => destination.emphasis === 'selected');
  const junction: CanvasConnectorJunction = {
    id: `${args.id}:junction`,
    center: junctionPoint,
    emphasis: isSelected ? 'selected' : 'default',
    delayMs: (args.delayMs ?? 0) + 90,
  };

  return {
    connectors: [
      {
        id: `${args.id}:trunk`,
        from: args.from,
        fromEdge: args.fromEdge,
        to: junctionPoint,
        toEdge: oppositeEdge(args.fromEdge),
        emphasis: junction.emphasis,
        delayMs: args.delayMs,
      },
      ...args.destinations.map((destination) => ({
        id: destination.id,
        from: junctionPoint,
        fromEdge: args.fromEdge,
        to: destination.to,
        toEdge: destination.toEdge,
        emphasis: destination.emphasis,
        delayMs: destination.delayMs,
      })),
    ],
    junctions: [junction],
  };
};

export const fitCameraToRects = (args: {
  rects: CanvasRect[];
  viewportWidth: number;
  viewportHeight: number;
  padding: number;
  minZoom: number;
  maxZoom: number;
  expandMinZoomToFit?: boolean;
}): InfiniteCanvasCamera => {
  const viewportWidth = Math.max(1, args.viewportWidth);
  const viewportHeight = Math.max(1, args.viewportHeight);
  const padding = Math.max(0, args.padding);
  const bounds = args.rects.reduce<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>((current, rect) => {
    if (!current) {
      return {
        minX: rect.x,
        minY: rect.y,
        maxX: rect.x + rect.width,
        maxY: rect.y + rect.height,
      };
    }
    return {
      minX: Math.min(current.minX, rect.x),
      minY: Math.min(current.minY, rect.y),
      maxX: Math.max(current.maxX, rect.x + rect.width),
      maxY: Math.max(current.maxY, rect.y + rect.height),
    };
  }, null);

  if (!bounds) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, viewportWidth - (padding * 2));
  const availableHeight = Math.max(1, viewportHeight - (padding * 2));
  const fitZoom = Math.min(
    availableWidth / contentWidth,
    availableHeight / contentHeight,
  );
  const minZoom = args.expandMinZoomToFit === true
    ? Math.min(args.minZoom, fitZoom)
    : args.minZoom;
  const zoom = clamp(fitZoom, minZoom, args.maxZoom);

  const centeredX = (viewportWidth / 2) - ((bounds.minX + (contentWidth / 2)) * zoom);
  const centeredY = (viewportHeight / 2) - ((bounds.minY + (contentHeight / 2)) * zoom);

  return {
    x: centeredX,
    y: centeredY,
    zoom,
  };
};

export const buildSketchCanvasConnectorLayout = (args: {
  sketchRect: CanvasRect;
  draftRects: CanvasRect[];
  extractRect: CanvasRect;
  displayAspect: number;
  showDrafts: boolean;
  selectedDraftIndex: number | null;
}): CanvasConnectorLayout => {
  if (!args.showDrafts) return { connectors: [], junctions: [] };

  const isPortrait = args.displayAspect < 1;
  const sketchAnchor = isPortrait
    ? rectAnchor(args.sketchRect, 'bottom', 0.5, 18)
    : rectAnchor(args.sketchRect, 'right', 0.74, 42);
  const sketchEdge = isPortrait ? 'bottom' : 'right';

  const draftFanout = buildFanoutConnectors({
    id: 'sketch-to-drafts',
    from: sketchAnchor,
    fromEdge: sketchEdge,
    delayMs: 120,
    destinations: args.draftRects.map((rect, index) => {
      const previewRect = buildDraftPreviewRect(rect);
      return {
        id: `sketch-to-draft-${index + 1}`,
        to: isPortrait
          ? rectAnchor(previewRect, 'top', 0.5, 0)
          : rectAnchor(previewRect, 'left', 0.16, 18),
        toEdge: isPortrait ? 'top' : 'left',
        emphasis: args.selectedDraftIndex === index ? 'selected' : 'default',
        delayMs: 250 + (index * 110),
      };
    }),
  });

  if (args.selectedDraftIndex === null) {
    return draftFanout;
  }

  const selectedRect = args.draftRects[args.selectedDraftIndex] ?? null;
  if (!selectedRect) {
    return draftFanout;
  }
  const selectedPreviewRect = buildDraftPreviewRect(selectedRect);
  const exportPreviewRect = buildExportPreviewRect(args.extractRect);
  const isExtractBelow = args.extractRect.y > selectedRect.y + selectedRect.height;
  return {
    connectors: [
      ...draftFanout.connectors,
      {
        id: 'draft-to-extract',
        from: isExtractBelow
          ? rectAnchor(selectedPreviewRect, 'bottom', 0.5, 0)
          : rectAnchor(selectedPreviewRect, 'right', 0.5, 0),
        fromEdge: isExtractBelow ? 'bottom' : 'right',
        to: isExtractBelow
          ? rectAnchor(exportPreviewRect, 'top', 0.5, 0)
          : rectAnchor(exportPreviewRect, 'left', 0.5, 0),
        toEdge: isExtractBelow ? 'top' : 'left',
        emphasis: 'selected',
        delayMs: 420,
      },
    ],
    junctions: draftFanout.junctions,
  };
};

export const buildExtractToHandoffConnector = (args: {
  extractRect: CanvasRect;
  handoffRect: CanvasRect;
  fromBottomInset?: number;
  toTopInset?: number;
  delayMs?: number;
}): CanvasConnector => ({
  id: 'extract-to-handoff',
  from: rectAnchor(args.extractRect, 'bottom', 0.5, args.fromBottomInset ?? 0),
  fromEdge: 'bottom',
  to: rectAnchor(args.handoffRect, 'top', 0.5, args.toTopInset ?? 0),
  toEdge: 'top',
  delayMs: args.delayMs,
});
