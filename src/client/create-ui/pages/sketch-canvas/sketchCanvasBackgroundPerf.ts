const GRID_SPACING = 30;
const FIRST_LOD_ZOOM = 0.46;
const SECOND_LOD_ZOOM = 0.18;
const MAX_BACKGROUND_DPR = 2;
const SETTLED_DOT_ALPHA = 0.23;

export type SketchCanvasSettledBackground = {
  dotSizePx: number;
  layers: SketchCanvasSettledBackgroundLayer[];
};

export type SketchCanvasSettledBackgroundLayer = {
  cellSizePx: number;
  dotSizePx: number;
  imageUrl: string;
  positionX: number;
  positionY: number;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - (2 * progress));
};

const buildSquareDotTileUrl = (args: {
  cellSizePx: number;
  dotSizePx: number;
  alpha: number;
}): string => {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${args.cellSizePx}" height="${args.cellSizePx}" viewBox="0 0 ${args.cellSizePx} ${args.cellSizePx}">`,
    `<rect width="${args.dotSizePx}" height="${args.dotSizePx}" fill="rgb(47 39 31)" fill-opacity="${args.alpha}"/>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const composeAlphaLayer = (targetAlpha: number, currentAlpha: number): number => {
  if (targetAlpha <= currentAlpha) return 0;
  return 1 - ((1 - targetAlpha) / (1 - currentAlpha));
};

const buildSettledLayer = (args: {
  dotSizePx: number;
  opacity: number;
  screenGridSpacing: number;
  x: number;
  y: number;
}): SketchCanvasSettledBackgroundLayer | null => {
  if (args.opacity <= 0.0001) return null;
  return {
    cellSizePx: args.screenGridSpacing,
    dotSizePx: args.dotSizePx,
    imageUrl: buildSquareDotTileUrl({
      alpha: args.opacity,
      cellSizePx: args.screenGridSpacing,
      dotSizePx: args.dotSizePx,
    }),
    positionX: args.x - (args.dotSizePx / 2),
    positionY: args.y - (args.dotSizePx / 2),
  };
};

export const resolveSketchCanvasGridSpacing = (zoom: number): number => {
  if (zoom <= SECOND_LOD_ZOOM) return GRID_SPACING * 4;
  if (zoom <= FIRST_LOD_ZOOM) return GRID_SPACING * 2;
  return GRID_SPACING;
};

export const resolveSketchCanvasBackgroundDpr = (devicePixelRatio: number): number => (
  Math.min(MAX_BACKGROUND_DPR, Math.max(1, devicePixelRatio || 1))
);

export const resolveSketchCanvasSettledBackground = (camera: {
  x: number;
  y: number;
  zoom: number;
}): SketchCanvasSettledBackground => {
  const dotSizePx = Math.max(2, Math.round(Math.max(2, 1.04 * camera.zoom * 2.7)));
  const firstFade = smoothstep(0.56, 0.46, camera.zoom);
  const secondFade = smoothstep(0.26, 0.18, camera.zoom);
  const denseTargetAlpha = SETTLED_DOT_ALPHA * (1 - firstFade);
  const firstLodTargetAlpha = SETTLED_DOT_ALPHA * (1 - secondFade);
  const secondLodTargetAlpha = SETTLED_DOT_ALPHA;
  const denseLayerAlpha = denseTargetAlpha;
  const firstLodLayerAlpha = composeAlphaLayer(firstLodTargetAlpha, denseTargetAlpha);
  const secondLodLayerAlpha = composeAlphaLayer(secondLodTargetAlpha, firstLodTargetAlpha);
  const layers = [
    buildSettledLayer({
      dotSizePx,
      opacity: denseLayerAlpha,
      screenGridSpacing: GRID_SPACING * camera.zoom,
      x: camera.x,
      y: camera.y,
    }),
    buildSettledLayer({
      dotSizePx,
      opacity: firstLodLayerAlpha,
      screenGridSpacing: GRID_SPACING * 2 * camera.zoom,
      x: camera.x,
      y: camera.y,
    }),
    buildSettledLayer({
      dotSizePx,
      opacity: secondLodLayerAlpha,
      screenGridSpacing: GRID_SPACING * 4 * camera.zoom,
      x: camera.x,
      y: camera.y,
    }),
  ].filter((layer): layer is SketchCanvasSettledBackgroundLayer => layer !== null);

  return {
    dotSizePx,
    layers,
  };
};
