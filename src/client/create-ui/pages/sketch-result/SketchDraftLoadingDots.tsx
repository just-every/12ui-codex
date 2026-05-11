import React from 'react';
import { Platform, View } from 'react-native';

import {
  buildSketchDraftLoadingFlow,
  buildSketchDraftLoadingFrame,
  resolveSketchDraftLoadingStateFromFrame,
  type SketchDraftLoadingFrame,
} from './sketchDraftLoadingFlow';
import { resolveSketchDraftExpansionLoadingState } from './sketchDraftLoadingExpansionFlow';
import { subscribeSketchLoadingFrame } from './sketchLoadingTicker';

const BASE_GRID_SPACING = 20;
const WORLD_GRID_SPACING = 30;
const DOT_RADIUS_SCALE = 1.5;
const COLOR_TRANSITION_MS = 4_000;
type RgbColor = readonly [number, number, number];

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

const mixColor = (start: RgbColor, end: RgbColor, progress: number): RgbColor => ([
  mixChannel(start[0], end[0], progress),
  mixChannel(start[1], end[1], progress),
  mixChannel(start[2], end[2], progress),
]);

const toGreyscale = (color: RgbColor): RgbColor => {
  const value = Math.round((color[0] * 0.299) + (color[1] * 0.587) + (color[2] * 0.114));
  return [value, value, value];
};

const WAVE_PALETTE: RgbColor[] = [
  [255, 170, 206],
  [255, 196, 152],
  [255, 233, 163],
  [176, 236, 180],
  [154, 230, 240],
  [179, 191, 255],
];

const EXPANSION_EMPTY_PALETTE: RgbColor[] = [
  [238, 232, 220],
  [224, 211, 190],
  [201, 180, 148],
  [164, 137, 102],
  [116, 96, 72],
];

const samplePalette = (palette: readonly RgbColor[], progress: number): RgbColor => {
  const source = palette.length > 0 ? palette : WAVE_PALETTE;
  const clamped = clamp(progress, 0, 1);
  const scaled = clamped * (source.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(source.length - 1, index + 1);
  const local = scaled - index;
  return mixColor(source[index], source[nextIndex], local);
};

const resolveWaveColor = (
  colorPhase: number,
  screenX: number,
  screenY: number,
  palette?: readonly RgbColor[],
  fallbackPalette: readonly RgbColor[] = WAVE_PALETTE,
): RgbColor => {
  const spatialPhase = fract(
    (colorPhase * 0.46)
      + (screenX * 0.0052)
      + (screenY * 0.0038)
      + (Math.sin(screenX * 0.014) * 0.17)
      + (Math.cos(screenY * 0.012) * 0.13),
  );
  return samplePalette(palette && palette.length > 0 ? palette : fallbackPalette, spatialPhase);
};

type CanvasMetrics = {
  width: number;
  height: number;
  dpr: number;
  deviceWidth: number;
  deviceHeight: number;
};

export function SketchDraftLoadingDots(args: {
  worldOffsetX?: number;
  worldOffsetY?: number;
  colorize?: boolean;
  className?: string;
  loadingIntent?: 'full-design' | 'extend-bottom';
  palette?: readonly RgbColor[];
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const contextRef = React.useRef<CanvasRenderingContext2D | null>(null);
  const metricsRef = React.useRef<CanvasMetrics | null>(null);
  const flowRef = React.useRef(buildSketchDraftLoadingFlow(`${Date.now()}-${Math.random()}`));
  const colorProgressRef = React.useRef(args.colorize ? 1 : 0);
  const previousFrameMsRef = React.useRef<number | null>(null);
  const startFrameMsRef = React.useRef<number | null>(null);
  const [isVisible, setIsVisible] = React.useState(true);

  const measureCanvas = React.useCallback((): CanvasMetrics | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, canvas.clientWidth || rect.width);
    const height = Math.max(1, canvas.clientHeight || rect.height);
    const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    const deviceWidth = Math.max(1, Math.round(width * dpr));
    const deviceHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
      canvas.width = deviceWidth;
      canvas.height = deviceHeight;
    }

    const nextMetrics = {
      width,
      height,
      dpr,
      deviceWidth,
      deviceHeight,
    };
    metricsRef.current = nextMetrics;
    contextRef.current = canvas.getContext('2d');
    return nextMetrics;
  }, []);

  const drawFrame = React.useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    const metrics = metricsRef.current?.dpr === currentDpr
      ? metricsRef.current
      : measureCanvas();
    if (!metrics) return;
    const context = contextRef.current;
    if (!context) return;
    if (startFrameMsRef.current === null) {
      startFrameMsRef.current = now;
    }
    const elapsedMs = now - startFrameMsRef.current;
    const previousFrameMs = previousFrameMsRef.current ?? now;
    previousFrameMsRef.current = now;
    const targetColorProgress = args.colorize ? 1 : 0;
    const colorDelta = targetColorProgress - colorProgressRef.current;
    const maxColorStep = Math.max(0, now - previousFrameMs) / COLOR_TRANSITION_MS;
    colorProgressRef.current += Math.sign(colorDelta) * Math.min(Math.abs(colorDelta), maxColorStep);

    const sceneScale = clamp(Math.min(metrics.width, metrics.height) / 320, 0.52, 1);
    const isExpansion = args.loadingIntent === 'extend-bottom';
    const gridSpacing = isExpansion
      ? WORLD_GRID_SPACING
      : BASE_GRID_SPACING * lerp(0.82, 1, sceneScale);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, metrics.deviceWidth, metrics.deviceHeight);
    context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    context.fillStyle = '#fffdf9';
    context.fillRect(0, 0, metrics.width, metrics.height);

    const frame = buildSketchDraftLoadingFrame({
      width: metrics.width,
      height: metrics.height,
      elapsedMs,
      flow: flowRef.current,
    });

    const drawDot = (screenX: number, screenY: number, baseRadius: number, frameState: SketchDraftLoadingFrame) => {
      const baseState = resolveSketchDraftLoadingStateFromFrame({
        screenX,
        screenY,
        frame: frameState,
      });
      const state = isExpansion
        ? resolveSketchDraftExpansionLoadingState({
          baseState,
          frame: frameState,
          screenX,
          screenY,
        })
        : { ...baseState, offsetY: 0 };

      const surfaced = smoothstep(0.02, 0.26, state.visible);
      if (surfaced <= 0.001) return;

      const waveColor = resolveWaveColor(
        state.colorPhase,
        screenX,
        screenY,
        args.palette,
        isExpansion ? EXPANSION_EMPTY_PALETTE : WAVE_PALETTE,
      );
      const colorized = mixColor(toGreyscale(waveColor), waveColor, colorProgressRef.current);
      const colorLift = mixColor(colorized, [255, 255, 255], isExpansion ? 0.1 : 0.08);
      const alpha = isExpansion ? lerp(0.1, 0.76, surfaced) : lerp(0.12, 0.92, surfaced);
      const topProximity = isExpansion
        ? 1 - smoothstep(0.02, 0.22, screenY / Math.max(1, metrics.height))
        : 0;
      const squareSize = isExpansion
        ? Math.max(4, Math.round(
          lerp(baseRadius * 0.9, baseRadius * 1.34, smoothstep(0.08, 0.88, surfaced))
          + (state.sizeBias * baseRadius * 0.18)
          + (topProximity * surfaced * baseRadius * 1.42),
        ) * 2)
        : Math.max(2, Math.round((
          lerp(baseRadius * 0.72, baseRadius * 1.58, smoothstep(0.08, 0.88, surfaced))
          + (state.sizeBias * baseRadius * 0.38)
        )) * 2);

      context.globalAlpha = alpha;
      context.fillStyle = `rgb(${colorLift[0]} ${colorLift[1]} ${colorLift[2]})`;
      context.fillRect(
        screenX - (squareSize / 2),
        screenY + state.offsetY - (squareSize / 2),
        squareSize,
        squareSize,
      );
    };

    if (typeof args.worldOffsetX === 'number' && typeof args.worldOffsetY === 'number') {
      const minWorldX = Math.floor((args.worldOffsetX - WORLD_GRID_SPACING) / WORLD_GRID_SPACING) * WORLD_GRID_SPACING;
      const maxWorldX = Math.ceil((args.worldOffsetX + metrics.width + WORLD_GRID_SPACING) / WORLD_GRID_SPACING) * WORLD_GRID_SPACING;
      const minWorldY = Math.floor((args.worldOffsetY - WORLD_GRID_SPACING) / WORLD_GRID_SPACING) * WORLD_GRID_SPACING;
      const maxWorldY = Math.ceil((args.worldOffsetY + metrics.height + WORLD_GRID_SPACING) / WORLD_GRID_SPACING) * WORLD_GRID_SPACING;
      const baseWorldRadius = 1.56 * DOT_RADIUS_SCALE;
      const baseExpansionWorldRadius = 1.68 * DOT_RADIUS_SCALE;

      for (let worldY = minWorldY; worldY <= maxWorldY; worldY += WORLD_GRID_SPACING) {
        const localY = worldY - args.worldOffsetY;
        if (localY < -WORLD_GRID_SPACING || localY > metrics.height + WORLD_GRID_SPACING) continue;

        for (let worldX = minWorldX; worldX <= maxWorldX; worldX += WORLD_GRID_SPACING) {
          const localX = worldX - args.worldOffsetX;
          if (localX < -WORLD_GRID_SPACING || localX > metrics.width + WORLD_GRID_SPACING) continue;
          drawDot(localX, localY, isExpansion ? baseExpansionWorldRadius : baseWorldRadius, frame);
        }
      }
    } else {
      const baseLocalRadius = lerp(1.1, 2.2, sceneScale) * DOT_RADIUS_SCALE;
      for (let screenY = gridSpacing / 2; screenY <= metrics.height + gridSpacing; screenY += gridSpacing) {
        for (let screenX = gridSpacing / 2; screenX <= metrics.width + gridSpacing; screenX += gridSpacing) {
          drawDot(screenX, screenY, baseLocalRadius, frame);
        }
      }
    }
    context.globalAlpha = 1;
  }, [args.colorize, args.loadingIntent, args.palette, args.worldOffsetX, args.worldOffsetY, measureCanvas]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    measureCanvas();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measureCanvas());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [measureCanvas]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry ? entry.isIntersecting : true),
      { rootMargin: '240px' },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !isVisible) return undefined;
    return subscribeSketchLoadingFrame(drawFrame);
  }, [drawFrame, isVisible]);

  if (Platform.OS !== 'web') {
    return <View className="h-full w-full bg-[#fffdf9]" />;
  }

  return (
    <div className={[
      'relative h-full w-full overflow-hidden bg-[#fffdf9]',
      args.className ?? 'rounded-[20px]',
    ].join(' ')}>
      {args.loadingIntent === 'extend-bottom' ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white via-white/90 to-transparent" />
      ) : (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 30% 24%, rgba(255,245,233,0.9), transparent 42%), radial-gradient(circle at 72% 68%, rgba(237,247,255,0.72), transparent 38%)',
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
