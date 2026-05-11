export const SKETCH_COMPOSER_CANVAS_WIDTH = 1200;
export const SKETCH_COMPOSER_DEFAULT_CANVAS_HEIGHT = 504;
export const SKETCH_COMPOSER_MIN_CANVAS_HEIGHT = 240;
export const SKETCH_COMPOSER_MAX_CANVAS_HEIGHT = 1800;

export const normalizeSketchComposerCanvasHeight = (height: number): number => {
  if (!Number.isFinite(height)) return SKETCH_COMPOSER_DEFAULT_CANVAS_HEIGHT;
  return Math.round(Math.min(
    SKETCH_COMPOSER_MAX_CANVAS_HEIGHT,
    Math.max(SKETCH_COMPOSER_MIN_CANVAS_HEIGHT, height),
  ));
};
