import React from 'react';

import {
  resolveSketchCanvasBackgroundDpr,
  resolveSketchCanvasGridSpacing,
  resolveSketchCanvasSettledBackground,
} from './sketchCanvasBackgroundPerf';
import { SKETCH_CANVAS_INTRO, SKETCH_CANVAS_INTRO_SLOSH_MS } from './sketchCanvasIntro';
import { resolveFinalPassProgress, resolveSloshState } from './sketchCanvasWash';
import type { InfiniteCanvasCamera } from './sceneLayout';

const GRID_SPACING = 30;

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const lerp = (start: number, end: number, progress: number): number => (
  start + ((end - start) * progress)
);

const fract = (value: number): number => (
  value - Math.floor(value)
);

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - (2 * progress));
};

const mixChannel = (start: number, end: number, progress: number): number => (
  Math.round(lerp(start, end, progress))
);

const mixColor = (start: [number, number, number], end: [number, number, number], progress: number): [number, number, number] => ([
  mixChannel(start[0], end[0], progress),
  mixChannel(start[1], end[1], progress),
  mixChannel(start[2], end[2], progress),
]);

const WAVE_PALETTE: [number, number, number][] = [
  [255, 170, 206],
  [255, 196, 152],
  [255, 233, 163],
  [176, 236, 180],
  [154, 230, 240],
  [179, 191, 255],
];

const sampleWavePalette = (progress: number): [number, number, number] => {
  const clamped = clamp(progress, 0, 1);
  const scaled = clamped * (WAVE_PALETTE.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(WAVE_PALETTE.length - 1, index + 1);
  const local = scaled - index;
  return mixColor(WAVE_PALETTE[index], WAVE_PALETTE[nextIndex], local);
};

const resolveWaveColor = (
  colorPhase: number,
  worldX: number,
  worldY: number,
): [number, number, number] => {
  const spatialPhase = fract(
    (colorPhase * 0.42)
      + (worldX * 0.0048)
      + (worldY * 0.0036)
      + (Math.sin(worldX * 0.015) * 0.18)
      + (Math.cos(worldY * 0.013) * 0.12),
  );
  return sampleWavePalette(spatialPhase);
};

const resolveZoomDensityMultiplier = (args: {
  worldX: number;
  worldY: number;
  zoom: number;
}): number => {
  const gridX = Math.round(args.worldX / GRID_SPACING);
  const gridY = Math.round(args.worldY / GRID_SPACING);
  const firstFade = smoothstep(0.56, 0.46, args.zoom);
  const secondFade = smoothstep(0.26, 0.18, args.zoom);
  const keepFirstLod = Math.abs(gridX) % 2 === 0 && Math.abs(gridY) % 2 === 0;
  const keepSecondLod = Math.abs(gridX) % 4 === 0 && Math.abs(gridY) % 4 === 0;
  const removeFirstHalf = !keepFirstLod;
  const removeSecondHalf = keepFirstLod && !keepSecondLod;

  if (removeFirstHalf) {
    return 1 - firstFade;
  }
  if (removeSecondHalf) {
    return 1 - secondFade;
  }
  return 1;
};

export function SketchCanvasBackground(args: {
  camera: InfiniteCanvasCamera;
  introStartedAt?: number | null;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const introStartRef = React.useRef<number | null>(args.introStartedAt ?? null);
  const latestArgsRef = React.useRef(args);
  const needsDrawRef = React.useRef(true);
  const isIntroSettledRef = React.useRef(false);
  const [isIntroSettled, setIsIntroSettled] = React.useState(false);

  latestArgsRef.current = args;
  const usePrePaintEffect = typeof window === 'undefined'
    ? React.useEffect
    : React.useLayoutEffect;

  const drawFrame = React.useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = resolveSketchCanvasBackgroundDpr(window.devicePixelRatio || 1);
    const deviceWidth = Math.max(1, Math.round(width * dpr));
    const deviceHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
      canvas.width = deviceWidth;
      canvas.height = deviceHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) return false;

    if (introStartRef.current === null) {
      introStartRef.current = now;
    }

    const elapsedMs = now - introStartRef.current;
    const sloshProgress = clamp(elapsedMs / SKETCH_CANVAS_INTRO_SLOSH_MS, 0, 1);
    const finalPassProgress = clamp(
      (elapsedMs - SKETCH_CANVAS_INTRO.finalPassStartMs) / SKETCH_CANVAS_INTRO.settleMs,
      0,
      1,
    );

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    const camera = latestArgsRef.current.camera;
    const viewMinWorldX = ((-camera.x) / camera.zoom) - 120;
    const viewMaxWorldX = ((width - camera.x) / camera.zoom) + 120;
    const viewMinWorldY = ((-camera.y) / camera.zoom) - 120;
    const viewMaxWorldY = ((height - camera.y) / camera.zoom) + 120;

    const gridSpacing = resolveSketchCanvasGridSpacing(camera.zoom);
    const minWorldX = Math.floor(viewMinWorldX / gridSpacing) * gridSpacing;
    const maxWorldX = Math.ceil(viewMaxWorldX / gridSpacing) * gridSpacing;
    const minWorldY = Math.floor(viewMinWorldY / gridSpacing) * gridSpacing;
    const maxWorldY = Math.ceil(viewMaxWorldY / gridSpacing) * gridSpacing;

    const baseRadiusPx = Math.max(0.88, 1.04 * camera.zoom);

    for (let worldY = minWorldY; worldY <= maxWorldY; worldY += gridSpacing) {
      const screenY = camera.y + (worldY * camera.zoom);
      for (let worldX = minWorldX; worldX <= maxWorldX; worldX += gridSpacing) {
        const screenX = camera.x + (worldX * camera.zoom);
        const sloshState = resolveSloshState({
          screenX,
          screenY,
          width,
          height,
          sloshProgress,
        });
        const finalPass = resolveFinalPassProgress({
          screenX,
          screenY,
          width,
          height,
          finalPassProgress,
        });
        const visibility = Math.max(sloshState.visible, finalPass);
        const appeared = smoothstep(0.04, 0.2, visibility);
        if (appeared <= 0.001) continue;

        const settleFade = smoothstep(0.16, 1, finalPass);
        const sizeHoldFade = smoothstep(lerp(0.18, 0.48, sloshState.sizeLinger), 1, finalPass);
        const sloshGlow = smoothstep(0.18, 0.92, sloshState.visible);
        const finalSize = Math.max(2, baseRadiusPx * 2.7);
        const heldSize = finalSize + Math.max(4, baseRadiusPx * 3.4);
        const size = Math.max(2, Math.round(lerp(heldSize, finalSize, sizeHoldFade)));
        const baseAlpha = finalPass > 0
          ? appeared * lerp(1, 0.18, settleFade)
          : appeared * lerp(0.22, 1, sloshGlow);
        const alpha = baseAlpha * resolveZoomDensityMultiplier({
          worldX,
          worldY,
          zoom: camera.zoom,
        });
        if (alpha <= 0.001) continue;
        const waveColor = resolveWaveColor(sloshState.colorPhase, worldX, worldY);
        const finalGray: [number, number, number] = [47, 39, 31];
        const mixedColor = mixColor(waveColor, finalGray, settleFade);
        const colorBoost = sloshGlow * 0.18;
        const lightLift = lerp(0.34 + (sloshGlow * 0.18), 0, settleFade);
        const liftedColor = mixColor(mixedColor, [255, 255, 255], lightLift);
        const red = Math.min(255, liftedColor[0] + Math.round(18 * colorBoost));
        const green = Math.min(255, liftedColor[1] + Math.round(14 * colorBoost));
        const blue = Math.min(255, liftedColor[2] + Math.round(12 * colorBoost));
        context.globalAlpha = alpha;
        context.fillStyle = `rgb(${red} ${green} ${blue})`;
        context.fillRect(
          Math.round(screenX - (size / 2)),
          Math.round(screenY - (size / 2)),
          size,
          size,
        );
      }
    }

    context.globalAlpha = 1;

    const shouldContinue = elapsedMs < SKETCH_CANVAS_INTRO.totalMs;
    if (!shouldContinue && !isIntroSettledRef.current) {
      isIntroSettledRef.current = true;
      setIsIntroSettled(true);
    }
    return shouldContinue;
  }, []);

  const scheduleDraw = React.useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame((timestamp) => {
      rafRef.current = null;
      const shouldContinue = drawFrame(timestamp);
      needsDrawRef.current = false;
      if (shouldContinue || needsDrawRef.current) {
        scheduleDraw();
      }
    });
  }, [drawFrame]);

  usePrePaintEffect(() => {
    if (isIntroSettled) return;
    needsDrawRef.current = true;
    scheduleDraw();
  }, [args.camera.x, args.camera.y, args.camera.zoom, drawFrame, isIntroSettled, scheduleDraw, usePrePaintEffect]);

  React.useEffect(() => {
    if (isIntroSettled) return undefined;
    scheduleDraw();
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isIntroSettled, scheduleDraw]);

  const settledBackground = React.useMemo(
    () => resolveSketchCanvasSettledBackground(args.camera),
    [args.camera.x, args.camera.y, args.camera.zoom],
  );

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: isIntroSettled ? 1 : 0,
          backgroundImage: settledBackground.layers.map((layer) => `url("${layer.imageUrl}")`).join(', '),
          backgroundPosition: settledBackground.layers.map((layer) => `${layer.positionX}px ${layer.positionY}px`).join(', '),
          backgroundSize: settledBackground.layers.map((layer) => `${layer.cellSizePx}px ${layer.cellSizePx}px`).join(', '),
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ display: isIntroSettled ? 'none' : 'block' }}
      />
    </>
  );
}
