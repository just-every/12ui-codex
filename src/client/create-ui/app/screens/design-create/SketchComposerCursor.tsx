import type React from 'react';

import { getSketchComposerIcon } from './sketchComposerIcons';
import type { SketchColor, SketchToolKind } from './sketchComposerModel';

type SketchDisplayScale = {
  x: number;
  y: number;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const encodeSvgCursor = (svg: string): string => (
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
);

const PEN_CURSOR_SIZE = 20;
const PEN_CURSOR_HOTSPOT = { x: 1, y: 18 } as const;
const PEN_ICON = getSketchComposerIcon('draw');
const ERASER_ICON = getSketchComposerIcon('eraser');
export const ERASER_CURSOR_VISUAL = {
  fill: 'rgba(0,0,0,0.03)',
  outerStroke: 'rgba(0,0,0,0.35)',
  innerStroke: 'rgba(255,255,255,0.8)',
  iconFill: 'rgba(0,0,0,0.5)',
  outerStrokeWidth: 1.5,
  innerStrokeWidth: 1,
} as const;
export const ERASER_CURSOR_DIAMETER_RANGE = {
  min: 12,
  max: 72,
} as const;
export const ERASER_CURSOR_PADDING = 2;

const buildPenCursor = (color: SketchColor): string => {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PEN_CURSOR_SIZE}" height="${PEN_CURSOR_SIZE}" viewBox="0 0 ${PEN_ICON.width} ${PEN_ICON.height}">`,
    `<path fill="${color}" d="${PEN_ICON.path}"/>`,
    '</svg>',
  ].join('');
  return `${encodeSvgCursor(svg)} ${PEN_CURSOR_HOTSPOT.x} ${PEN_CURSOR_HOTSPOT.y}, auto`;
};

const buildEraserCursor = (diameter: number): string => {
  const clampedDiameter = Math.round(clamp(
    diameter,
    ERASER_CURSOR_DIAMETER_RANGE.min,
    ERASER_CURSOR_DIAMETER_RANGE.max,
  ));
  const radius = clampedDiameter / 2;
  const padding = ERASER_CURSOR_PADDING;
  const size = clampedDiameter + (padding * 2);
  const center = radius + padding;
  const iconSize = clamp(clampedDiameter * 0.42, 7, 18);
  const iconScale = iconSize / Math.max(ERASER_ICON.width, ERASER_ICON.height);
  const iconX = center - (ERASER_ICON.width * iconScale) / 2;
  const iconY = center - (ERASER_ICON.height * iconScale) / 2;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<circle cx="${center}" cy="${center}" r="${Math.max(1, radius - 0.75)}" fill="${ERASER_CURSOR_VISUAL.fill}" stroke="${ERASER_CURSOR_VISUAL.outerStroke}" stroke-width="${ERASER_CURSOR_VISUAL.outerStrokeWidth}"/>`,
    `<circle cx="${center}" cy="${center}" r="${Math.max(1, radius - 1.75)}" fill="none" stroke="${ERASER_CURSOR_VISUAL.innerStroke}" stroke-width="${ERASER_CURSOR_VISUAL.innerStrokeWidth}"/>`,
    `<g transform="translate(${iconX.toFixed(2)} ${iconY.toFixed(2)}) scale(${iconScale.toFixed(4)})">`,
    `<path fill="${ERASER_CURSOR_VISUAL.iconFill}" d="${ERASER_ICON.path}"/>`,
    '</g>',
    '</svg>',
  ].join('');
  return `${encodeSvgCursor(svg)} ${center} ${center}, auto`;
};

export const resolveSketchCanvasCursor = (args: {
  activeTool: SketchToolKind;
  canvasReady?: boolean;
  disabled?: boolean;
  displayScale?: SketchDisplayScale;
  drawColor?: SketchColor;
  eraserWidth?: number;
  isPointerInsideCanvas?: boolean;
  isResizing?: boolean;
}): React.CSSProperties['cursor'] => {
  if (args.canvasReady === false || args.isPointerInsideCanvas === false) return 'auto';
  if (args.disabled) return 'not-allowed';
  if (args.isResizing) return 'ns-resize';
  if (args.activeTool === 'shape') return 'crosshair';
  if (args.activeTool === 'text') return 'text';
  if (args.activeTool === 'draw') {
    return buildPenCursor(args.drawColor ?? '#111111');
  }
  if (args.activeTool === 'eraser') {
    const scale = Math.min(args.displayScale?.x ?? 1, args.displayScale?.y ?? 1);
    return buildEraserCursor((args.eraserWidth ?? 40) * scale);
  }
  return 'auto';
};
