import React from 'react';
import type { DesignImageEditRequest, DesignOutput } from '../../shared/types.js';
import { designImageHistory, resolveDesignHistoryIndex, resolveDesignImage } from '../../shared/designImageRevision.js';
import {
  readSketchPointerMetadata,
  readSketchPointerSamples,
  type SketchPointerSample,
} from '../create-ui/lib/sketchPointerInput';
import {
  createDesignImageEditMaskDataUrl,
  resolveDesignImageMaskPointWidth,
  type DesignImageMaskFrame,
  type DesignImageMaskStroke,
} from './designImageMask.js';

const EDIT_BRUSH_WIDTH = 34;

export type DesignImageDisplayFrame = DesignImageMaskFrame & {
  left: number;
  top: number;
};

type IconName = 'check' | 'chevron-left' | 'chevron-right' | 'pen' | 'x';

const ICON_PATHS: Record<IconName, string> = {
  check: 'M20 6 9 17l-5-5',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  pen: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  x: 'M18 6 6 18 M6 6l12 12',
};

const Icon = (args: { name: IconName }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px]">
    <path d={ICON_PATHS[args.name]} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
  </svg>
);

const stopEvent = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

const cloneStrokes = (strokes: readonly DesignImageMaskStroke[]): DesignImageMaskStroke[] => (
  strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }))
);

const iconButtonClass = (disabled?: boolean): string => [
  'flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/94 text-black shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition',
  disabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer hover:bg-black hover:text-white',
].join(' ');

const IconButton = (args: {
  ariaLabel: string;
  disabled?: boolean;
  icon: IconName;
  onClick: () => void;
  title: string;
}) => (
  <button
    type="button"
    aria-label={args.ariaLabel}
    title={args.title}
    disabled={args.disabled}
    className={iconButtonClass(args.disabled)}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!args.disabled) args.onClick();
    }}
  >
    <Icon name={args.icon} />
  </button>
);

const getLocalPoint = (
  canvas: HTMLCanvasElement,
  event: SketchPointerSample,
) => {
  const rect = canvas.getBoundingClientRect();
  const displayWidth = canvas.clientWidth > 0 ? canvas.clientWidth : rect.width;
  const displayHeight = canvas.clientHeight > 0 ? canvas.clientHeight : rect.height;
  const scaleX = rect.width > 0 ? displayWidth / rect.width : 1;
  const scaleY = rect.height > 0 ? displayHeight / rect.height : 1;
  return {
    x: Math.max(0, Math.min(displayWidth, (event.clientX - rect.left) * scaleX)),
    y: Math.max(0, Math.min(displayHeight, (event.clientY - rect.top) * scaleY)),
    ...readSketchPointerMetadata(event),
  };
};

const drawStroke = (
  context: CanvasRenderingContext2D,
  stroke: DesignImageMaskStroke,
) => {
  const points = stroke.points;
  if (points.length === 0) return;
  context.save();
  context.strokeStyle = 'rgba(255,56,92,0.72)';
  context.fillStyle = 'rgba(255,56,92,0.72)';
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0]!.x, points[0]!.y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  context.beginPath();
  context.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    context.lineTo(point.x, point.y);
  }
  context.stroke();
  context.restore();
};

export function DesignImageControls(args: {
  design: DesignOutput;
  disabled?: boolean;
  frame: DesignImageDisplayFrame | null;
  onEditDesignImage: (request: DesignImageEditRequest) => Promise<void>;
  onSetActiveRevision: (activeRevisionId: string | null) => Promise<void>;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = React.useRef<DesignImageMaskStroke | null>(null);
  const [isEditing, setEditing] = React.useState(false);
  const [isDrawing, setDrawing] = React.useState(false);
  const [editPrompt, setEditPrompt] = React.useState('');
  const [strokes, setStrokes] = React.useState<DesignImageMaskStroke[]>([]);
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [cursorPoint, setCursorPoint] = React.useState<DesignImageMaskStroke['points'][number] | null>(null);
  const history = designImageHistory(args.design);
  const activeIndex = resolveDesignHistoryIndex(args.design);
  const activeImage = resolveDesignImage(args.design);
  const isBusy = Boolean(statusText);
  const canEdit = Boolean(!args.disabled && args.frame && !isBusy);
  const trimmedEditPrompt = editPrompt.trim();
  const canSubmitEdit = canEdit && isEditing && (strokes.length > 0 || trimmedEditPrompt.length > 0);

  const redraw = React.useCallback((nextStrokes: readonly DesignImageMaskStroke[], active?: DesignImageMaskStroke | null) => {
    const canvas = canvasRef.current;
    const frame = args.frame;
    if (!canvas || !frame) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(frame.displayWidth));
    const height = Math.max(1, Math.round(frame.displayHeight));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    for (const stroke of nextStrokes) drawStroke(context, stroke);
    if (active) drawStroke(context, active);
  }, [args.frame]);

  React.useEffect(() => {
    redraw(strokes, activeStrokeRef.current);
  }, [redraw, strokes]);

  React.useEffect(() => {
    if (isEditing) return;
    setEditPrompt('');
    setStrokes([]);
    setCursorPoint(null);
    setLocalError(null);
  }, [isEditing]);

  const submitEdit = async () => {
    if (!args.frame || !canSubmitEdit) return;
    setStatusText('Editing image');
    setLocalError(null);
    try {
      const maskDataUrl = strokes.length > 0
        ? createDesignImageEditMaskDataUrl(cloneStrokes(strokes), args.frame)
        : null;
      await args.onEditDesignImage({
        prompt: trimmedEditPrompt || null,
        maskDataUrl,
        sourceRevisionId: activeImage.revisionId,
      });
      setEditPrompt('');
      setStrokes([]);
      setEditing(false);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Image edit failed.');
    } finally {
      setStatusText(null);
    }
  };

  const setActiveRevision = async (index: number) => {
    const next = history[index];
    if (!next || isBusy) return;
    setStatusText('Switching image');
    setLocalError(null);
    try {
      await args.onSetActiveRevision(next.revisionId);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not switch image revision.');
    } finally {
      setStatusText(null);
    }
  };

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !canEdit || !isEditing) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getLocalPoint(canvas, event);
    setCursorPoint(point);
    const stroke: DesignImageMaskStroke = {
      id: crypto.randomUUID(),
      points: [point],
      width: EDIT_BRUSH_WIDTH,
    };
    activeStrokeRef.current = stroke;
    setDrawing(true);
    canvas.setPointerCapture(event.pointerId);
    redraw(strokes, stroke);
  }, [canEdit, isEditing, redraw, strokes]);

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !args.frame) return;
    const point = getLocalPoint(canvas, event);
    setCursorPoint(point);
    const stroke = activeStrokeRef.current;
    if (!stroke || args.disabled || isBusy) return;
    event.preventDefault();
    event.stopPropagation();
    for (const sample of readSketchPointerSamples(event)) {
      stroke.points.push(getLocalPoint(canvas, sample));
    }
    redraw(strokes, stroke);
  }, [args.disabled, args.frame, isBusy, redraw, strokes]);

  const finishStroke = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    event.preventDefault();
    event.stopPropagation();
    activeStrokeRef.current = null;
    setDrawing(false);
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    setStrokes((current) => [...current, stroke]);
  }, []);

  const frameStyle = args.frame ? {
    height: `${args.frame.displayHeight}px`,
    left: `${args.frame.left}px`,
    top: `${args.frame.top}px`,
    width: `${args.frame.displayWidth}px`,
  } : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" onClick={stopEvent}>
      <div className="pointer-events-auto absolute right-2 top-2 z-30 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        {history.length > 1 ? (
          <>
            <IconButton
              ariaLabel="Previous image revision"
              disabled={isBusy || activeIndex <= 0}
              icon="chevron-left"
              title="Previous"
              onClick={() => void setActiveRevision(activeIndex - 1)}
            />
            <IconButton
              ariaLabel="Next image revision"
              disabled={isBusy || activeIndex >= history.length - 1}
              icon="chevron-right"
              title="Next"
              onClick={() => void setActiveRevision(activeIndex + 1)}
            />
          </>
        ) : null}
        <IconButton
          ariaLabel="Edit image"
          disabled={!canEdit}
          icon="pen"
          title="Edit"
          onClick={() => {
            setEditing(true);
            setLocalError(null);
          }}
        />
      </div>
      {isEditing && args.frame ? (
        <div className="pointer-events-auto absolute z-30 rounded-[10px] bg-black/[0.035]" style={frameStyle} onPointerDown={stopEvent}>
          <canvas
            ref={canvasRef}
            aria-label="Image edit mask"
            className="absolute inset-0 h-full w-full"
            style={{ cursor: 'none', touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerEnter={(event) => setCursorPoint(getLocalPoint(event.currentTarget, event))}
            onPointerLeave={() => {
              if (!activeStrokeRef.current) setCursorPoint(null);
            }}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
          />
          {cursorPoint ? (
            <div
              aria-hidden
              className="pointer-events-none absolute z-20 rounded-full border border-black/62 bg-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.16)]"
              style={{
                height: `${resolveDesignImageMaskPointWidth({ id: 'cursor', points: [], width: EDIT_BRUSH_WIDTH }, cursorPoint)}px`,
                left: `${cursorPoint.x}px`,
                top: `${cursorPoint.y}px`,
                transform: 'translate(-50%, -50%)',
                width: `${resolveDesignImageMaskPointWidth({ id: 'cursor', points: [], width: EDIT_BRUSH_WIDTH }, cursorPoint)}px`,
              }}
            />
          ) : null}
          {!isDrawing ? (
            <form
              className="absolute bottom-2 left-2 right-2 z-40 flex items-center gap-2 rounded-full border border-black/10 bg-white/94 px-2 py-2 shadow-[0_14px_32px_rgba(0,0,0,0.16)] backdrop-blur-md"
              onSubmit={(event) => {
                event.preventDefault();
                void submitEdit();
              }}
            >
              <input
                aria-label="Image edit instructions"
                className="min-w-0 flex-1 rounded-full border border-black/8 bg-white px-3 py-2 text-[12px] font-medium text-black outline-none placeholder:text-black/34"
                placeholder={strokes.length > 0 ? 'Type edit and press Enter' : 'Describe the whole-image change'}
                value={editPrompt}
                onChange={(event) => setEditPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  event.stopPropagation();
                  void submitEdit();
                }}
                onPointerDown={stopEvent}
              />
              <IconButton
                ariaLabel="Cancel image edit"
                icon="x"
                title="Cancel"
                onClick={() => setEditing(false)}
              />
              <IconButton
                ariaLabel="Submit image edit"
                disabled={!canSubmitEdit}
                icon="check"
                title="Submit"
                onClick={() => void submitEdit()}
              />
            </form>
          ) : null}
        </div>
      ) : null}

      {statusText || localError ? (
        <div className="pointer-events-none absolute left-2 top-2 z-40 rounded-full bg-white/94 px-3 py-1.5 text-[11px] font-semibold text-black/58 shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
          {statusText ?? localError}
        </div>
      ) : null}
    </div>
  );
}
