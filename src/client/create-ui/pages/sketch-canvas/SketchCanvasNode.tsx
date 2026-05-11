import React from 'react';

import { cn } from '../../lib/cn';
import { SketchCanvasIntroContext } from './SketchCanvasIntroContext';
import { SKETCH_CANVAS_INTRO } from './sketchCanvasIntro';
import type { CanvasRect } from './sceneLayout';

const isFocusBlockedTarget = (target: HTMLElement | null): boolean => {
  if (!target) return false;
  return Boolean(target.closest([
    'textarea',
    'input',
    'select',
    'option',
    'button',
    'label',
    'a[href]',
    'iframe',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="slider"]',
    '[role="textbox"]',
    '[data-pan-block="true"]',
  ].join(', ')));
};

export function SketchCanvasNode(args: {
  rect: CanvasRect;
  focusAreaId?: string;
  className?: string;
  animationDelayMs?: number;
  interactiveOnEnter?: boolean;
  onSurfacePress?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  children: React.ReactNode;
}) {
  const introStartedAt = React.useContext(SketchCanvasIntroContext);
  const introHoldDelayMsRef = React.useRef<number | null>(null);
  const [isInteractive, setIsInteractive] = React.useState(false);
  const elementFadeStartMs = (
    SKETCH_CANVAS_INTRO.finalPassStartMs
    + (SKETCH_CANVAS_INTRO.settleMs * 0.72)
  );

  if (introHoldDelayMsRef.current === null) {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    introHoldDelayMsRef.current = introStartedAt === null
      ? elementFadeStartMs
      : Math.max(0, elementFadeStartMs - (now - introStartedAt));
  }
  const nodeEnterDelayMs = introHoldDelayMsRef.current + SKETCH_CANVAS_INTRO.nodeDelayMs + (args.animationDelayMs ?? 0);

  React.useEffect(() => {
    setIsInteractive(false);
    const interactiveDelayMs = Math.max(
      0,
      args.interactiveOnEnter
        ? nodeEnterDelayMs
        : nodeEnterDelayMs + SKETCH_CANVAS_INTRO.nodeDurationMs,
    );
    if (interactiveDelayMs === 0) {
      setIsInteractive(true);
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setIsInteractive(true);
    }, interactiveDelayMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [args.interactiveOnEnter, nodeEnterDelayMs]);

  return (
    <div
      data-canvas-node="true"
      data-focus-area-id={args.focusAreaId}
      className={cn('absolute sketch-canvas-node-enter', args.className)}
      onClick={(event) => {
        if (!args.onSurfacePress) return;
        const target = event.target as HTMLElement | null;
        if (isFocusBlockedTarget(target)) return;
        args.onSurfacePress();
      }}
      onPointerEnter={args.onPointerEnter}
      onPointerLeave={args.onPointerLeave}
      style={{
        left: `${args.rect.x}px`,
        top: `${args.rect.y}px`,
        width: `${args.rect.width}px`,
        height: `${args.rect.height}px`,
        opacity: 0,
        animationDelay: `${nodeEnterDelayMs}ms`,
        animationFillMode: 'both',
        pointerEvents: isInteractive ? undefined : 'none',
        willChange: 'opacity',
      }}
    >
      {args.children}
    </div>
  );
}
