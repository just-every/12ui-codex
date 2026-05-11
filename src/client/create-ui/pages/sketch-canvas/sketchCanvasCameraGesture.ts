import type { InfiniteCanvasCamera } from './sceneLayout';

export type CanvasPointerPoint = {
  clientX: number;
  clientY: number;
};

export type PinchCameraGesture = {
  camera: InfiniteCanvasCamera;
  centerX: number;
  centerY: number;
  distance: number;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const getPointerDistance = (
  first: CanvasPointerPoint,
  second: CanvasPointerPoint,
): number => Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

export const getPointerCenter = (
  first: CanvasPointerPoint,
  second: CanvasPointerPoint,
): CanvasPointerPoint => ({
  clientX: (first.clientX + second.clientX) / 2,
  clientY: (first.clientY + second.clientY) / 2,
});

export const resolvePinchCamera = (args: {
  gesture: PinchCameraGesture;
  first: CanvasPointerPoint;
  second: CanvasPointerPoint;
  stageRect: Pick<DOMRect, 'left' | 'top'>;
  minZoom: number;
  maxZoom: number;
}): InfiniteCanvasCamera => {
  const nextDistance = getPointerDistance(args.first, args.second);
  if (args.gesture.distance <= 0 || nextDistance <= 0) {
    return args.gesture.camera;
  }

  const nextCenter = getPointerCenter(args.first, args.second);
  const initialLocalCenterX = args.gesture.centerX - args.stageRect.left;
  const initialLocalCenterY = args.gesture.centerY - args.stageRect.top;
  const nextLocalCenterX = nextCenter.clientX - args.stageRect.left;
  const nextLocalCenterY = nextCenter.clientY - args.stageRect.top;
  const nextZoom = clamp(
    args.gesture.camera.zoom * (nextDistance / args.gesture.distance),
    args.minZoom,
    args.maxZoom,
  );
  const worldX = (initialLocalCenterX - args.gesture.camera.x) / args.gesture.camera.zoom;
  const worldY = (initialLocalCenterY - args.gesture.camera.y) / args.gesture.camera.zoom;

  return {
    zoom: nextZoom,
    x: nextLocalCenterX - (worldX * nextZoom),
    y: nextLocalCenterY - (worldY * nextZoom),
  };
};
