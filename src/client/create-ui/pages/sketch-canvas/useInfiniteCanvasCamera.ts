import React from 'react';

import type { InfiniteCanvasCamera } from './sceneLayout';
import {
  type CanvasPointerPoint,
  type PinchCameraGesture,
  getPointerCenter,
  getPointerDistance,
  resolvePinchCamera,
} from './sketchCanvasCameraGesture';
import { CAMERA_AUTO_ANIMATION_MS, interpolateCamera } from './sketchCameraMotion';

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const cameraDelta = (a: InfiniteCanvasCamera, b: InfiniteCanvasCamera): number => (
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.zoom - b.zoom)
);

const CAM_SAME_EPSILON = 0.001;
const CAM_SNAP_EPSILON = 0.5;

const isDragBlockedTarget = (target: HTMLElement | null): boolean => {
  if (!target) return false;
  return Boolean(target.closest([
    'textarea',
    'input',
    'select',
    'option',
    'button',
    'label',
    'canvas',
    'a[href]',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="slider"]',
    '[role="textbox"]',
    '[data-pan-block="true"]',
  ].join(', ')));
};

const isNativeWheelScrollTarget = (target: EventTarget | null): boolean => (
  target instanceof Element && Boolean(target.closest('textarea'))
);

export const useInfiniteCanvasCamera = (args: {
  targetCamera: InfiniteCanvasCamera;
  minZoom?: number;
  maxZoom?: number;
  preserveUserCameraOnTargetChange?: boolean;
  onHorizontalNavigate?: (direction: 'prev' | 'next') => void;
  onCanvasClick?: (args: {
    target: HTMLElement;
    worldX: number;
    worldY: number;
  }) => void;
}) => {
  const minZoom = args.minZoom ?? 0.38;
  const maxZoom = args.maxZoom ?? 1.5;
  const onHorizontalNavigate = args.onHorizontalNavigate;
  const onCanvasClick = args.onCanvasClick;
  const [camera, setCamera] = React.useState<InfiniteCanvasCamera>(args.targetCamera);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isInteracting, setIsInteracting] = React.useState(false);
  const cameraRef = React.useRef(args.targetCamera);
  const dragSessionRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    cameraX: number;
    cameraY: number;
    cameraZoom: number;
    clickTarget: HTMLElement;
  } | null>(null);
  const interactionTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const cameraCommitFrameRef = React.useRef<number | null>(null);
  const pendingCameraRef = React.useRef<InfiniteCanvasCamera | null>(null);
  const horizontalWheelAccumRef = React.useRef(0);
  const horizontalWheelCooldownRef = React.useRef(0);
  const activePointersRef = React.useRef<Map<number, CanvasPointerPoint>>(new Map());
  const pinchSessionRef = React.useRef<PinchCameraGesture | null>(null);
  const hasUserControlledCameraRef = React.useRef(false);

  const flushPendingCameraState = React.useCallback(() => {
    cameraCommitFrameRef.current = null;
    const pendingCamera = pendingCameraRef.current;
    pendingCameraRef.current = null;
    if (!pendingCamera) return;
    setCamera((current) => (
      cameraDelta(current, pendingCamera) < CAM_SAME_EPSILON ? current : pendingCamera
    ));
  }, []);

  const commitCameraState = React.useCallback((nextCamera: InfiniteCanvasCamera) => {
    if (cameraDelta(cameraRef.current, nextCamera) < CAM_SAME_EPSILON) {
      return;
    }
    cameraRef.current = nextCamera;
    pendingCameraRef.current = nextCamera;
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      flushPendingCameraState();
      return;
    }
    if (cameraCommitFrameRef.current !== null) return;
    cameraCommitFrameRef.current = window.requestAnimationFrame(flushPendingCameraState);
  }, [flushPendingCameraState]);

  const setCameraState = React.useCallback((nextCamera: InfiniteCanvasCamera | ((current: InfiniteCanvasCamera) => InfiniteCanvasCamera)) => {
    const currentCamera = pendingCameraRef.current ?? cameraRef.current;
    const resolved = typeof nextCamera === 'function' ? nextCamera(currentCamera) : nextCamera;
    commitCameraState(resolved);
  }, [commitCameraState]);

  const setCameraStateNow = React.useCallback((nextCamera: InfiniteCanvasCamera) => {
    if (cameraCommitFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraCommitFrameRef.current);
      cameraCommitFrameRef.current = null;
    }
    pendingCameraRef.current = null;
    if (cameraDelta(cameraRef.current, nextCamera) < CAM_SAME_EPSILON) {
      return;
    }
    cameraRef.current = nextCamera;
    setCamera((current) => (
      cameraDelta(current, nextCamera) < CAM_SAME_EPSILON ? current : nextCamera
    ));
  }, []);

  const stopAutoAnimation = React.useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const markInteracting = React.useCallback((durationMs = 180) => {
    setIsInteracting(true);
    stopAutoAnimation();
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      interactionTimeoutRef.current = null;
    }, durationMs);
  }, [stopAutoAnimation]);

  React.useEffect(() => () => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
    if (cameraCommitFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraCommitFrameRef.current);
    }
  }, []);

  React.useEffect(() => {
    if (args.preserveUserCameraOnTargetChange === true && hasUserControlledCameraRef.current) {
      return;
    }
    stopAutoAnimation();
    const fromCamera = cameraRef.current;
    const targetCamera = args.targetCamera;
    const delta = cameraDelta(fromCamera, targetCamera);
    if (delta < CAM_SAME_EPSILON) {
      return;
    }
    if (delta < CAM_SNAP_EPSILON) {
      setCameraStateNow(targetCamera);
      return;
    }

    const startAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - startAt) / CAMERA_AUTO_ANIMATION_MS));
      commitCameraState(interpolateCamera(fromCamera, targetCamera, progress));
      if (progress >= 1) {
        animationFrameRef.current = null;
        setCameraStateNow(targetCamera);
        return;
      }
      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
  }, [args.targetCamera, commitCameraState, setCameraStateNow, stopAutoAnimation]);

  const onWheel = React.useCallback((event: WheelEvent) => {
    if (isNativeWheelScrollTarget(event.target)) return;

    if (
      onHorizontalNavigate
      && Math.abs(event.deltaX) > Math.abs(event.deltaY)
      && Math.abs(event.deltaX) > 4
    ) {
      event.preventDefault();
      horizontalWheelAccumRef.current += event.deltaX;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (
        Math.abs(horizontalWheelAccumRef.current) >= 48
        && now >= horizontalWheelCooldownRef.current
      ) {
        onHorizontalNavigate(horizontalWheelAccumRef.current > 0 ? 'next' : 'prev');
        horizontalWheelAccumRef.current = 0;
        horizontalWheelCooldownRef.current = now + 320;
      }
      return;
    }

    event.preventDefault();
    hasUserControlledCameraRef.current = true;
    markInteracting(160);
    const stage = event.currentTarget as HTMLElement | null;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const zoomDelta = Math.exp(-event.deltaY * 0.0015);

    setCameraState((current) => {
      const nextZoom = clamp(current.zoom * zoomDelta, minZoom, maxZoom);
      const worldX = (localX - current.x) / current.zoom;
      const worldY = (localY - current.y) / current.zoom;
      return {
        zoom: nextZoom,
        x: localX - (worldX * nextZoom),
        y: localY - (worldY * nextZoom),
      };
    });
  }, [markInteracting, maxZoom, minZoom, onHorizontalNavigate, setCameraState]);

  const getPinchPoints = React.useCallback((): [CanvasPointerPoint, CanvasPointerPoint] | null => {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return null;
    return [points[0], points[1]];
  }, []);

  const startPinchSession = React.useCallback(() => {
    const points = getPinchPoints();
    if (!points) return;
    const center = getPointerCenter(points[0], points[1]);
    pinchSessionRef.current = {
      camera: cameraRef.current,
      centerX: center.clientX,
      centerY: center.clientY,
      distance: getPointerDistance(points[0], points[1]),
    };
  }, [getPinchPoints]);

  const updatePinchCamera = React.useCallback((stage: HTMLElement) => {
    const points = getPinchPoints();
    if (!points) return;
    if (!pinchSessionRef.current) {
      startPinchSession();
    }
    const gesture = pinchSessionRef.current;
    if (!gesture) return;

    setCameraState(resolvePinchCamera({
      gesture,
      first: points[0],
      second: points[1],
      stageRect: stage.getBoundingClientRect(),
      minZoom,
      maxZoom,
    }));
  }, [getPinchPoints, maxZoom, minZoom, setCameraState, startPinchSession]);

  const onPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target || isDragBlockedTarget(target)) return;

    event.preventDefault();
    hasUserControlledCameraRef.current = true;
    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (activePointersRef.current.size >= 2) {
      dragSessionRef.current = null;
      setIsDragging(false);
      setIsInteracting(true);
      stopAutoAnimation();
      startPinchSession();
      updatePinchCamera(event.currentTarget);
      return;
    }

    const currentCamera = cameraRef.current;
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: currentCamera.x,
      cameraY: currentCamera.y,
      cameraZoom: currentCamera.zoom,
      clickTarget: target,
    };
    setIsDragging(true);
    setIsInteracting(true);
    stopAutoAnimation();
  }, [startPinchSession, stopAutoAnimation, updatePinchCamera]);

  const endDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>, shouldEmitClick: boolean) => {
    const session = dragSessionRef.current;
    if (session?.pointerId !== event.pointerId) return;
    dragSessionRef.current = null;
    setIsDragging(false);
    markInteracting(90);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!shouldEmitClick) return;

    const movedDistance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (movedDistance > 6 || !onCanvasClick) return;

    const stageRect = event.currentTarget.getBoundingClientRect();
    onCanvasClick({
      target: session.clickTarget,
      worldX: (session.startX - stageRect.left - session.cameraX) / session.cameraZoom,
      worldY: (session.startY - stageRect.top - session.cameraY) / session.cameraZoom,
    });
  }, [markInteracting, onCanvasClick]);
  const onPointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const wasPinching = Boolean(pinchSessionRef.current);
    activePointersRef.current.delete(event.pointerId);
    if (wasPinching) {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      pinchSessionRef.current = null;
      dragSessionRef.current = null;
      setIsDragging(false);
      markInteracting(90);
      return;
    }
    endDrag(event, true);
  }, [endDrag, markInteracting]);
  const onPointerCancel = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const wasPinching = Boolean(pinchSessionRef.current);
    activePointersRef.current.delete(event.pointerId);
    if (wasPinching) {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      pinchSessionRef.current = null;
      dragSessionRef.current = null;
      setIsDragging(false);
      markInteracting(90);
      return;
    }
    endDrag(event, false);
  }, [endDrag, markInteracting]);

  const onPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }
    if (activePointersRef.current.size >= 2) {
      event.preventDefault();
      hasUserControlledCameraRef.current = true;
      setIsInteracting(true);
      stopAutoAnimation();
      updatePinchCamera(event.currentTarget);
      return;
    }

    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    event.preventDefault();
    setCameraState((current) => ({
      ...current,
      x: session.cameraX + (event.clientX - session.startX),
      y: session.cameraY + (event.clientY - session.startY),
    }));
  }, [setCameraState, stopAutoAnimation, updatePinchCamera]);

  return {
    camera,
    isDragging,
    stageHandlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
};
