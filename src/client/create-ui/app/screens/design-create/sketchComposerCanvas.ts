import { normalizeShapeBounds, type SketchColor, type SketchShapeType } from './sketchComposerModel';
import type { SketchPointerMetadata } from '../../../lib/sketchPointerInput';

const MAX_COMPOSER_CANVAS_DPR = 1.5;

export type SketchComposerCanvasSize = {
  width: number;
  height: number;
};

export type SketchComposerDisplayScale = {
  x: number;
  y: number;
};

export type SketchComposerPoint = SketchPointerMetadata & {
  x: number;
  y: number;
};

export type SketchComposerStrokeElement = {
  id: string;
  kind: 'stroke';
  tool: 'pen' | 'eraser';
  color: SketchColor;
  width: number;
  points: SketchComposerPoint[];
};

export type SketchComposerShapeElement = {
  id: string;
  kind: 'shape';
  shape: SketchShapeType;
  color: SketchColor;
  width: number;
  start: SketchComposerPoint;
  end: SketchComposerPoint;
};

export type SketchComposerTextElement = {
  id: string;
  kind: 'text';
  color: SketchColor;
  x: number;
  y: number;
  text: string;
  fontSize: number;
};

export type SketchComposerElement =
  | SketchComposerStrokeElement
  | SketchComposerShapeElement
  | SketchComposerTextElement;

export const resolveSketchComposerCanvasDpr = (devicePixelRatio: unknown): number => {
  const parsed = typeof devicePixelRatio === 'number' ? devicePixelRatio : Number(devicePixelRatio);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(MAX_COMPOSER_CANVAS_DPR, Math.max(1, parsed));
};

export const resolveSketchComposerCanvasPixelSize = (
  size: SketchComposerCanvasSize,
  devicePixelRatio: unknown,
): SketchComposerCanvasSize => {
  const dpr = resolveSketchComposerCanvasDpr(devicePixelRatio);
  return {
    width: Math.max(1, Math.round(size.width * dpr)),
    height: Math.max(1, Math.round(size.height * dpr)),
  };
};

export const resolveSketchComposerDisplayScale = (
  args: {
    layoutSize: SketchComposerCanvasSize;
    canvasSize: SketchComposerCanvasSize;
  },
): SketchComposerDisplayScale => ({
  x: args.layoutSize.width > 0 ? args.layoutSize.width / args.canvasSize.width : 1,
  y: args.layoutSize.height > 0 ? args.layoutSize.height / args.canvasSize.height : 1,
});

export const sketchComposerElementHasVisibleInk = (element: SketchComposerElement): boolean => {
  if (element.kind === 'stroke') {
    return element.tool !== 'eraser'
      && element.width > 0
      && element.points.length > 0;
  }
  if (element.kind === 'shape') {
    if (element.width <= 0) return false;
    const bounds = normalizeShapeBounds(element.start, element.end);
    return bounds.width >= 1 || bounds.height >= 1;
  }
  return element.text.trim().length > 0;
};

export const sketchComposerHasVisibleInk = (
  elements: readonly SketchComposerElement[],
  activeElement?: SketchComposerElement | null,
): boolean => (
  elements.some(sketchComposerElementHasVisibleInk)
  || (activeElement ? sketchComposerElementHasVisibleInk(activeElement) : false)
);
