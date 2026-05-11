import React from 'react';

import { cn } from '../../lib/cn';
import { SketchCanvasBackground } from './SketchCanvasBackground';
import { SketchCanvasConnectorJunction, SketchCanvasConnectorPath } from './SketchCanvasConnectorPath';
import { SketchCanvasIntroContext } from './SketchCanvasIntroContext';
import { SKETCH_CANVAS_INTRO } from './sketchCanvasIntro';
import type { CanvasConnector, CanvasConnectorJunction, InfiniteCanvasCamera } from './sceneLayout';
import { SKETCH_CANVAS_GESTURE_LOCK_CLASS, useSketchCanvasGestureLock } from './useSketchCanvasGestureLock';

const STAGE_STYLE_ID = 'sketch-canvas-stage-styles';

const STAGE_CSS = `
html.${SKETCH_CANVAS_GESTURE_LOCK_CLASS},
body.${SKETCH_CANVAS_GESTURE_LOCK_CLASS} {
  overscroll-behavior: none;
}

body.${SKETCH_CANVAS_GESTURE_LOCK_CLASS} {
  overflow: hidden;
}

.sketch-canvas-stage,
.sketch-canvas-stage * {
  -webkit-user-select: none;
  user-select: none;
  -webkit-user-drag: none;
}

.sketch-canvas-stage {
  overscroll-behavior: none;
  touch-action: none;
}

.sketch-canvas-stage textarea,
.sketch-canvas-stage input,
.sketch-canvas-stage [contenteditable="true"] {
  -webkit-user-select: text;
  user-select: text;
  -webkit-user-drag: auto;
}

.sketch-canvas-stage button,
.sketch-canvas-stage a[href],
.sketch-canvas-stage label,
.sketch-canvas-stage input,
.sketch-canvas-stage select,
.sketch-canvas-stage textarea,
.sketch-canvas-stage [contenteditable="true"],
.sketch-canvas-stage [role="button"],
.sketch-canvas-stage [role="slider"],
.sketch-canvas-stage [role="textbox"] {
  touch-action: manipulation;
}

.sketch-canvas-node-enter {
  animation: sketch-canvas-node-enter ${SKETCH_CANVAS_INTRO.nodeDurationMs}ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
}

.sketch-canvas-connector {
  animation: sketch-canvas-connector-draw ${SKETCH_CANVAS_INTRO.connectorDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.sketch-canvas-connector-junction {
  animation: sketch-canvas-connector-junction ${SKETCH_CANVAS_INTRO.connectorDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1) both;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes sketch-canvas-node-enter {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes sketch-canvas-connector-draw {
  0% {
    stroke-dashoffset: 1;
    opacity: 0;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

@keyframes sketch-canvas-connector-junction {
  0% {
    opacity: 0;
    transform: scale(0.62);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
`;

export function SketchCanvasStage(args: {
  camera: InfiniteCanvasCamera;
  isDragging: boolean;
  worldWidth: number;
  worldHeight: number;
  connectors: CanvasConnector[];
  connectorJunctions?: CanvasConnectorJunction[];
  introStartedAt?: number | null;
  overlay?: React.ReactNode;
  stageHandlers: {
    onWheel: (event: WheelEvent) => void;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  };
  dragHandlers?: {
    onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  };
  children: React.ReactNode;
}) {
  useSketchCanvasGestureLock();

  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const introStartedAtRef = React.useRef<number | null>(args.introStartedAt ?? (typeof performance !== 'undefined' ? performance.now() : null));
  const usePrePaintEffect = typeof window === 'undefined'
    ? React.useEffect
    : React.useInsertionEffect;
  const { onWheel, ...pointerStageHandlers } = args.stageHandlers;

  usePrePaintEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STAGE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STAGE_STYLE_ID;
    style.textContent = STAGE_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    stage.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      stage.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [onWheel]);

  const elementFadeStartMs = (
    SKETCH_CANVAS_INTRO.finalPassStartMs
    + (SKETCH_CANVAS_INTRO.settleMs * 0.72)
  );
  const elementIntroHoldMs = (() => {
    if (introStartedAtRef.current === null || typeof performance === 'undefined') {
      return elementFadeStartMs;
    }
    return Math.max(0, elementFadeStartMs - (performance.now() - introStartedAtRef.current));
  })();
  const connectorIntroHoldMs = (() => {
    if (introStartedAtRef.current === null || typeof performance === 'undefined') {
      return SKETCH_CANVAS_INTRO.totalMs + 60;
    }
    return Math.max(0, (SKETCH_CANVAS_INTRO.totalMs + 60) - (performance.now() - introStartedAtRef.current));
  })();

  return (
    <div
      ref={stageRef}
      className={cn(
        'sketch-canvas-stage relative h-screen w-full overflow-hidden bg-white',
        args.isDragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      {...pointerStageHandlers}
      {...args.dragHandlers}
    >
      <div className="absolute inset-0 overflow-hidden">
        <SketchCanvasBackground
          camera={args.camera}
          introStartedAt={introStartedAtRef.current}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${args.worldWidth}px`,
            height: `${args.worldHeight}px`,
            transform: `translate3d(${args.camera.x}px, ${args.camera.y}px, 0) scale(${args.camera.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <svg
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
            width={args.worldWidth}
            height={args.worldHeight}
            viewBox={`0 0 ${args.worldWidth} ${args.worldHeight}`}
          >
            {args.connectors.map((connector) => (
              <SketchCanvasConnectorPath
                key={connector.id}
                connector={connector}
                animationDelayMs={connectorIntroHoldMs + (connector.delayMs ?? 0)}
              />
            ))}
            {(args.connectorJunctions ?? []).map((junction) => (
              <SketchCanvasConnectorJunction
                key={junction.id}
                junction={junction}
                animationDelayMs={connectorIntroHoldMs + (junction.delayMs ?? 0)}
              />
            ))}
          </svg>
          <SketchCanvasIntroContext.Provider value={introStartedAtRef.current}>
            {args.children}
          </SketchCanvasIntroContext.Provider>
        </div>
      </div>
      {args.overlay}
    </div>
  );
}
