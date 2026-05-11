import type { InfiniteCanvasCamera } from './sceneLayout';

export const CAMERA_AUTO_ANIMATION_MS = 720;

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const lerp = (start: number, end: number, progress: number): number => (
  start + ((end - start) * progress)
);

const sampleCubicBezier = (a: number, b: number, c: number, t: number): number => (
  (((a * t) + b) * t + c) * t
);

const solveUnitBezier = (x1: number, y1: number, x2: number, y2: number, value: number): number => {
  const clamped = clamp(value, 0, 1);
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  let low = 0;
  let high = 1;
  let t = clamped;

  for (let index = 0; index < 10; index += 1) {
    t = (low + high) / 2;
    const estimate = sampleCubicBezier(ax, bx, cx, t);
    if (Math.abs(estimate - clamped) < 0.0005) break;
    if (estimate < clamped) {
      low = t;
    } else {
      high = t;
    }
  }

  return sampleCubicBezier(ay, by, cy, t);
};

export const easeCameraAutoMotion = (value: number): number => (
  solveUnitBezier(0.16, 1, 0.3, 1, value)
);

export const interpolateCamera = (
  from: InfiniteCanvasCamera,
  to: InfiniteCanvasCamera,
  progress: number,
): InfiniteCanvasCamera => {
  const eased = easeCameraAutoMotion(progress);
  return {
    x: lerp(from.x, to.x, eased),
    y: lerp(from.y, to.y, eased),
    zoom: lerp(from.zoom, to.zoom, eased),
  };
};
