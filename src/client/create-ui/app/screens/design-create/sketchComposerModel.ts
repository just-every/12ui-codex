export type SketchColor = '#111111' | '#c9453d' | '#2f8f4e';
export type SketchToolKind = 'draw' | 'shape' | 'text' | 'eraser';
export type SketchShapeType = 'rectangle' | 'circle' | 'line' | 'arrow';

export type SketchPointLike = {
  x: number;
  y: number;
};

export type SketchShapeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DRAW_WIDTH_RANGE = {
  min: 2,
  max: 12,
  step: 2,
  defaultValue: 4,
} as const;

export const SHAPE_WIDTH_RANGE = {
  min: 2,
  max: 12,
  step: 2,
  defaultValue: 6,
} as const;

export const TEXT_SIZE_RANGE = {
  min: 12,
  max: 72,
  step: 10,
  defaultValue: 36,
} as const;

export const ERASER_WIDTH_RANGE = {
  min: 10,
  max: 70,
  step: 10,
  defaultValue: 40,
} as const;

export const SKETCH_COLOR_OPTIONS: readonly {
  value: SketchColor;
  label: string;
}[] = [
  { value: '#111111', label: 'Black' },
  { value: '#c9453d', label: 'Red' },
  { value: '#2f8f4e', label: 'Green' },
] as const;

export const SKETCH_SHAPE_OPTIONS: readonly {
  value: SketchShapeType;
  label: string;
}[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Line' },
  { value: 'arrow', label: 'Arrow' },
] as const;

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const normalizeShapeBounds = (
  start: SketchPointLike,
  end: SketchPointLike,
): SketchShapeBounds => {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  return {
    x: left,
    y: top,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
};
