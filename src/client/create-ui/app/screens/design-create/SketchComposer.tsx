import React from 'react';

import { cn } from '../../../lib/cn';
import {
  readSketchPointerMetadata,
  readSketchPointerSamples,
  resolveSketchPressureWidth,
  type SketchPointerSample,
} from '../../../lib/sketchPointerInput';
import { measureDraftTextTopOffset } from './measureDraftTextTopOffset';
import { resolveSketchCanvasCursor } from './SketchComposerCursor';
import { SketchComposerToolbar } from './SketchComposerToolbar';
import {
  clamp,
  DRAW_WIDTH_RANGE,
  ERASER_WIDTH_RANGE,
  normalizeShapeBounds,
  SHAPE_WIDTH_RANGE,
  type SketchColor,
  type SketchShapeType,
  type SketchToolKind,
  TEXT_SIZE_RANGE,
} from './sketchComposerModel';
import {
  resolveSketchComposerCanvasDpr,
  resolveSketchComposerDisplayScale,
  resolveSketchComposerCanvasPixelSize,
  sketchComposerHasVisibleInk,
  type SketchComposerElement,
  type SketchComposerPoint,
} from './sketchComposerCanvas';
import {
  normalizeSketchComposerCanvasHeight,
  SKETCH_COMPOSER_CANVAS_WIDTH,
  SKETCH_COMPOSER_DEFAULT_CANVAS_HEIGHT,
  SKETCH_COMPOSER_MAX_CANVAS_HEIGHT,
  SKETCH_COMPOSER_MIN_CANVAS_HEIGHT,
} from './sketchComposerSizing';
import {
  buildTextFont,
  getTextLines,
  normalizeSketchText,
  SKETCH_TEXT_FONT_FAMILY,
  TEXT_DRAFT_LINE_HEIGHT,
  TEXT_RENDER_LINE_HEIGHT,
  trimSketchText,
  wrapSketchTextLines,
} from './sketchComposerText';

type SketchTool = 'pen' | 'eraser';

type SketchPoint = SketchComposerPoint;

type SketchSurfaceSize = {
  width: number;
  height: number;
};

type SketchDisplayScale = {
  x: number;
  y: number;
};

type SketchStrokeElement = {
  id: string;
  kind: 'stroke';
  tool: SketchTool;
  color: SketchColor;
  width: number;
  points: SketchPoint[];
};

type SketchShapeElement = {
  id: string;
  kind: 'shape';
  shape: SketchShapeType;
  color: SketchColor;
  width: number;
  start: SketchPoint;
  end: SketchPoint;
};

type SketchTextElement = {
  id: string;
  kind: 'text';
  color: SketchColor;
  x: number;
  y: number;
  text: string;
  fontSize: number;
};

type SketchElement = SketchComposerElement;

type ActiveStroke = {
  pointerId: number;
  stroke: SketchStrokeElement;
};

type ActiveShape = {
  pointerId: number;
  shape: SketchShapeElement;
};

type TextDraft = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: SketchColor;
  fontSize: number;
};

type ResizeSession = {
  pointerId: number;
  startClientY: number;
  startHeight: number;
  displayWidth: number;
};

type TouchLikeEvent = {
  touches: TouchList;
  changedTouches: TouchList;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export type SketchComposerHandle = {
  exportFile: () => Promise<File | null>;
  clear: () => void;
  hasInk: () => boolean;
};

type SketchComposerProps = {
  canvasHeight?: number;
  canvasHeightMode?: 'default' | 'minimum';
  chrome?: 'default' | 'immersive';
  disabled?: boolean;
  frameBoxShadow?: string;
  displayHeightPx?: number;
  frameTransition?: string;
  headerStart?: React.ReactNode;
  initialImageUrl?: string | null;
  isInputOpen?: boolean;
  onCanvasHeightChange?: (height: number) => void;
  onClear?: () => void;
  onInkChange?: (hasInk: boolean) => void;
  onInputOpenChange?: (isOpen: boolean) => void;
  onInitialImageStatusChange?: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  toolbarBeforeEraser?: React.ReactNode;
};

const RESIZE_HANDLE_VISIBILITY_THRESHOLD = 12;
const MIN_SHAPE_DRAG_SIZE = 4;
const TOUCH_FALLBACK_POINTER_ID = -1;
const TOUCH_FALLBACK_DELAY_MS = 250;

const measureTextBox = (
  context: CanvasRenderingContext2D | null,
  element: Pick<SketchTextElement, 'text' | 'fontSize'>,
  maxWidth?: number,
): { width: number; height: number; topOffset: number } => {
  if (!context) {
    const lines = wrapSketchTextLines({
      context: null,
      text: element.text,
      fontSize: element.fontSize,
      maxWidth: maxWidth ?? Number.POSITIVE_INFINITY,
    });
    return {
      width: Math.max(
        element.fontSize * 1.2,
        ...lines.map((line) => Math.max(element.fontSize * 0.6, line.length * element.fontSize * 0.62)),
      ),
      height: Math.max(1, lines.length) * element.fontSize * TEXT_RENDER_LINE_HEIGHT,
      topOffset: element.fontSize * 0.08,
    };
  }

  context.save();
  context.font = buildTextFont(element.fontSize);
  const lines = wrapSketchTextLines({
    context,
    text: element.text,
    fontSize: element.fontSize,
    maxWidth: maxWidth ?? Number.POSITIVE_INFINITY,
  });
  const measuredLines = lines.map((line) => context.measureText(line || ' '));
  context.restore();

  const width = Math.max(element.fontSize * 1.2, ...measuredLines.map((metrics) => metrics.width));
  const ascent = Math.max(...measuredLines.map((metrics) => (
    metrics.actualBoundingBoxAscent > 0 ? metrics.actualBoundingBoxAscent : element.fontSize * 0.8
  )));
  const descent = Math.max(...measuredLines.map((metrics) => (
    metrics.actualBoundingBoxDescent >= 0 ? metrics.actualBoundingBoxDescent : element.fontSize * 0.2
  )));
  const lineHeight = Math.max(element.fontSize * TEXT_RENDER_LINE_HEIGHT, ascent + descent);

  return {
    width,
    height: lineHeight * Math.max(1, lines.length),
    topOffset: ascent,
  };
};

const getTextDraftValue = (
  editor: HTMLDivElement | null | undefined,
  fallback: string,
): string => {
  if (!editor) return fallback;
  return normalizeSketchText(editor.innerText || editor.textContent || fallback);
};

const getMeasuredLineHeight = (
  context: CanvasRenderingContext2D,
  textElement: Pick<SketchTextElement, 'text' | 'fontSize'>,
): number => {
  const metrics = measureTextBox(context, textElement);
  const lineCount = Math.max(1, getTextLines(textElement.text).length);
  return metrics.height / lineCount;
};

const getPointerPosition = (
  canvas: HTMLCanvasElement,
  event: SketchPointerSample,
  size: SketchSurfaceSize,
): SketchPoint => {
  const rect = canvas.getBoundingClientRect();
  const normalizedX = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
  const normalizedY = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
  return {
    x: Math.max(0, Math.min(size.width, normalizedX * size.width)),
    y: Math.max(0, Math.min(size.height, normalizedY * size.height)),
    ...readSketchPointerMetadata(event),
  };
};

const getStrokePointWidth = (stroke: SketchStrokeElement, point: SketchPoint): number => (
  resolveSketchPressureWidth(stroke.width, point.pressure)
);

const getStrokeMaxWidth = (stroke: SketchStrokeElement): number => (
  Math.max(stroke.width, ...stroke.points.map((point) => getStrokePointWidth(stroke, point)))
);

const measureTextElement = (
  context: CanvasRenderingContext2D | null,
  element: Pick<SketchTextElement, 'text' | 'fontSize'>,
  maxWidth?: number,
): { width: number; height: number; topOffset: number } => {
  const { width, height, topOffset } = measureTextBox(context, element, maxWidth);
  return { width, height, topOffset };
};

const buildTextElementFromDraft = (
  draft: TextDraft,
  size: SketchSurfaceSize,
  context: CanvasRenderingContext2D | null,
): SketchTextElement => {
  const nextElement = {
    id: draft.id,
    kind: 'text',
    color: draft.color,
    text: trimSketchText(draft.text),
    fontSize: draft.fontSize,
  } satisfies Omit<SketchTextElement, 'x' | 'y'>;
  return {
    ...nextElement,
    x: clamp(draft.x, 0, size.width),
    y: clamp(draft.y, 0, size.height),
  };
};

const elementsExtendBeyondHeight = (
  elements: readonly SketchElement[],
  height: number,
  context: CanvasRenderingContext2D | null,
): boolean => {
  return elements.some((element) => {
    if (element.kind === 'stroke') {
      const maxStrokeWidth = getStrokeMaxWidth(element);
      return element.points.some((point) => point.y + maxStrokeWidth / 2 > height);
    }
    if (element.kind === 'shape') {
      return Math.max(element.start.y, element.end.y) + element.width / 2 > height;
    }
    const metrics = measureTextElement(context, element, SKETCH_COMPOSER_CANVAS_WIDTH - element.x);
    return element.y + (metrics.height - metrics.topOffset) > height;
  });
};

const drawStrokeElement = (context: CanvasRenderingContext2D, stroke: SketchStrokeElement) => {
  const points = stroke.points;
  if (points.length === 0) return;

  context.save();
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.tool === 'eraser' ? '#000000' : stroke.color;
  context.fillStyle = stroke.tool === 'eraser' ? '#000000' : stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (points.length === 1) {
    const pointWidth = getStrokePointWidth(stroke, points[0]!);
    context.beginPath();
    context.arc(points[0]!.x, points[0]!.y, pointWidth / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1]!;
    const point = points[index]!;
    context.beginPath();
    context.lineWidth = (
      getStrokePointWidth(stroke, previousPoint)
      + getStrokePointWidth(stroke, point)
    ) / 2;
    context.moveTo(previousPoint.x, previousPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();
};

const drawShapeElement = (context: CanvasRenderingContext2D, shapeElement: SketchShapeElement) => {
  const bounds = normalizeShapeBounds(shapeElement.start, shapeElement.end);
  if (bounds.width < 1 && bounds.height < 1) return;

  context.save();
  context.globalCompositeOperation = 'source-over';
  context.strokeStyle = shapeElement.color;
  context.lineWidth = shapeElement.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (shapeElement.shape === 'line') {
    context.beginPath();
    context.moveTo(shapeElement.start.x, shapeElement.start.y);
    context.lineTo(shapeElement.end.x, shapeElement.end.y);
    context.stroke();
    context.restore();
    return;
  }

  if (shapeElement.shape === 'arrow') {
    const dx = shapeElement.end.x - shapeElement.start.x;
    const dy = shapeElement.end.y - shapeElement.start.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const headLength = Math.min(26, Math.max(12, shapeElement.width * 3.5));

    context.beginPath();
    context.moveTo(shapeElement.start.x, shapeElement.start.y);
    context.lineTo(shapeElement.end.x, shapeElement.end.y);
    if (length > 0.01) {
      context.moveTo(shapeElement.end.x, shapeElement.end.y);
      context.lineTo(
        shapeElement.end.x - Math.cos(angle - Math.PI / 6) * headLength,
        shapeElement.end.y - Math.sin(angle - Math.PI / 6) * headLength,
      );
      context.moveTo(shapeElement.end.x, shapeElement.end.y);
      context.lineTo(
        shapeElement.end.x - Math.cos(angle + Math.PI / 6) * headLength,
        shapeElement.end.y - Math.sin(angle + Math.PI / 6) * headLength,
      );
    }
    context.stroke();
    context.restore();
    return;
  }

  const inset = shapeElement.width / 2;
  const x = bounds.x + inset;
  const y = bounds.y + inset;
  const width = Math.max(0, bounds.width - shapeElement.width);
  const height = Math.max(0, bounds.height - shapeElement.width);

  if (shapeElement.shape === 'circle') {
    const radiusX = Math.max(0.5, width / 2);
    const radiusY = Math.max(0.5, height / 2);
    const centerX = x + (width / 2);
    const centerY = y + (height / 2);

    context.beginPath();
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    return;
  }

  context.strokeRect(x, y, width, height);
  context.restore();
};

const drawTextElement = (
  context: CanvasRenderingContext2D,
  textElement: SketchTextElement,
  size: SketchSurfaceSize,
) => {
  if (!trimSketchText(textElement.text)) return;

  context.save();
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = textElement.color;
  context.textBaseline = 'alphabetic';
  context.font = buildTextFont(textElement.fontSize);
  const lineHeight = getMeasuredLineHeight(context, textElement);
  const lines = wrapSketchTextLines({
    context,
    text: textElement.text,
    fontSize: textElement.fontSize,
    maxWidth: size.width - textElement.x,
  });
  for (let index = 0; index < lines.length; index += 1) {
    context.fillText(
      lines[index] || ' ',
      textElement.x,
      textElement.y + (index * lineHeight),
    );
  }
  context.restore();
};

const drawElement = (
  context: CanvasRenderingContext2D,
  element: SketchElement,
  size: SketchSurfaceSize,
) => {
  if (element.kind === 'stroke') {
    drawStrokeElement(context, element);
    return;
  }
  if (element.kind === 'shape') {
    drawShapeElement(context, element);
    return;
  }
  drawTextElement(context, element, size);
};

export const SketchComposer = React.forwardRef<SketchComposerHandle, SketchComposerProps>(({
  canvasHeight: controlledCanvasHeight,
  canvasHeightMode = 'default',
  chrome = 'default',
  disabled,
  frameBoxShadow,
  displayHeightPx,
  frameTransition,
  headerStart,
  initialImageUrl,
  isInputOpen,
  onCanvasHeightChange,
  onClear,
  onInkChange,
  onInputOpenChange,
  onInitialImageStatusChange,
  toolbarBeforeEraser,
}, ref) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const canvasFrameRef = React.useRef<HTMLDivElement | null>(null);
  const textInputRef = React.useRef<HTMLDivElement | null>(null);
  const activeStrokeRef = React.useRef<ActiveStroke | null>(null);
  const activeShapeRef = React.useRef<ActiveShape | null>(null);
  const activeNativeTouchRef = React.useRef(false);
  const pendingNativeTouchRef = React.useRef<{
    point: SketchPoint;
    samples: SketchPointerSample[];
    timeout: number;
  } | null>(null);
  const resizeSessionRef = React.useRef<ResizeSession | null>(null);
  const elementsRef = React.useRef<SketchElement[]>([]);
  const textDraftRef = React.useRef<TextDraft | null>(null);
  const eraserRestoreToolRef = React.useRef<Exclude<SketchToolKind, 'eraser'>>('draw');

  const [activeTool, setActiveTool] = React.useState<SketchToolKind>('draw');
  const [uncontrolledCanvasHeight, setUncontrolledCanvasHeight] = React.useState(SKETCH_COMPOSER_DEFAULT_CANVAS_HEIGHT);
  const [elements, setElements] = React.useState<SketchElement[]>([]);
  const [backgroundImage, setBackgroundImage] = React.useState<HTMLImageElement | null>(null);
  const [redoElements, setRedoElements] = React.useState<SketchElement[]>([]);
  const [textDraft, setTextDraft] = React.useState<TextDraft | null>(null);
  const [drawColor, setDrawColor] = React.useState<SketchColor>('#111111');
  const [drawWidth, setDrawWidth] = React.useState<number>(DRAW_WIDTH_RANGE.defaultValue);
  const [shapeColor, setShapeColor] = React.useState<SketchColor>('#111111');
  const [shapeType, setShapeType] = React.useState<SketchShapeType>('rectangle');
  const [shapeWidth, setShapeWidth] = React.useState<number>(SHAPE_WIDTH_RANGE.defaultValue);
  const [textColor, setTextColor] = React.useState<SketchColor>('#111111');
  const [selectedTextFontSize, setSelectedTextFontSize] = React.useState<number>(TEXT_SIZE_RANGE.defaultValue);
  const [eraserWidth, setEraserWidth] = React.useState<number>(ERASER_WIDTH_RANGE.defaultValue);
  const [hasInk, setHasInk] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const [isResizeHandleVisible, setIsResizeHandleVisible] = React.useState(false);
  const [isCanvasReady, setIsCanvasReady] = React.useState(false);
  const [isPointerInsideCanvas, setIsPointerInsideCanvas] = React.useState(false);
  const [displayScale, setDisplayScale] = React.useState<SketchDisplayScale>({ x: 1, y: 1 });
  const isCanvasOpen = isInputOpen ?? true;

  const openInput = React.useCallback(() => {
    if (!isCanvasOpen) {
      onInputOpenChange?.(true);
    }
  }, [isCanvasOpen, onInputOpenChange]);

  const canvasHeight = normalizeSketchComposerCanvasHeight(controlledCanvasHeight ?? uncontrolledCanvasHeight);
  const effectiveCanvasHeight = canvasHeightMode === 'minimum'
    ? Math.min(canvasHeight, SKETCH_COMPOSER_MIN_CANVAS_HEIGHT)
    : canvasHeight;

  const size = React.useMemo<SketchSurfaceSize>(() => ({
    width: SKETCH_COMPOSER_CANVAS_WIDTH,
    height: effectiveCanvasHeight,
  }), [effectiveCanvasHeight]);

  const resizeCanvas = React.useCallback((nextHeight: number) => {
    const normalizedHeight = normalizeSketchComposerCanvasHeight(nextHeight);
    if (normalizedHeight === canvasHeight) return;
    if (controlledCanvasHeight === undefined) {
      setUncontrolledCanvasHeight(normalizedHeight);
    }
    onCanvasHeightChange?.(normalizedHeight);
  }, [canvasHeight, controlledCanvasHeight, onCanvasHeightChange]);

  React.useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  React.useEffect(() => {
    textDraftRef.current = textDraft;
  }, [textDraft]);

  React.useEffect(() => {
    const frame = canvasFrameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;

    const updateScale = () => {
      const canvas = canvasRef.current;
      const measuredWidth = frame.clientWidth || canvas?.offsetWidth || 0;
      const measuredHeight = frame.clientHeight || canvas?.offsetHeight || 0;
      const nextScale = resolveSketchComposerDisplayScale({
        layoutSize: { width: measuredWidth, height: measuredHeight },
        canvasSize: size,
      });
      setIsCanvasReady((current) => current || (measuredWidth > 0 && measuredHeight > 0));
      setDisplayScale((current) => (
        Math.abs(current.x - nextScale.x) < 0.001 && Math.abs(current.y - nextScale.y) < 0.001
          ? current
          : nextScale
      ));
    };

    updateScale();
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(frame);
    return () => observer.disconnect();
  }, [size.width, size.height]);

  React.useEffect(() => {
    if (!textDraft || !textInputRef.current) return;

    const editor = textInputRef.current;
    editor.textContent = textDraft.text;
    editor.focus();

    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [textDraft]);

  const redrawCanvas = React.useCallback((elementList: readonly SketchElement[], activeElement?: SketchElement | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const nextDevicePixelRatio = resolveSketchComposerCanvasDpr(
      typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    );
    const { width: nextWidth, height: nextHeight } = resolveSketchComposerCanvasPixelSize(
      size,
      nextDevicePixelRatio,
    );

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) return false;

    context.setTransform(nextDevicePixelRatio, 0, 0, nextDevicePixelRatio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    if (backgroundImage) {
      context.drawImage(backgroundImage, 0, 0, size.width, size.height);
    }

    for (const element of elementList) {
      drawElement(context, element, size);
    }
    if (activeElement) {
      drawElement(context, activeElement, size);
    }

    const nextHasVisibleInk = sketchComposerHasVisibleInk(elementList, activeElement);
    const nextHasStoredInk = nextHasVisibleInk
      || Boolean(backgroundImage)
      || elementsExtendBeyondHeight(elementList, size.height, context)
      || (activeElement ? elementsExtendBeyondHeight([activeElement], size.height, context) : false);
    setHasInk((current) => (current === nextHasStoredInk ? current : nextHasStoredInk));
    return nextHasVisibleInk;
  }, [backgroundImage, size]);

  React.useEffect(() => {
    redrawCanvas(elements, activeStrokeRef.current?.stroke ?? activeShapeRef.current?.shape ?? null);
  }, [backgroundImage, elements, redrawCanvas]);

  React.useEffect(() => {
    onInkChange?.(hasInk || Boolean(backgroundImage) || Boolean(textDraft));
  }, [backgroundImage, hasInk, onInkChange, textDraft]);

  React.useEffect(() => {
    if (initialImageUrl) {
      onInputOpenChange?.(true);
    }
    if (!initialImageUrl) {
      setBackgroundImage(null);
      onInitialImageStatusChange?.('idle');
      return;
    }
    let cancelled = false;
    onInitialImageStatusChange?.('loading');
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (cancelled) return;
      const naturalWidth = Number.isFinite(image.naturalWidth) && image.naturalWidth > 0 ? image.naturalWidth : SKETCH_COMPOSER_CANVAS_WIDTH;
      const naturalHeight = Number.isFinite(image.naturalHeight) && image.naturalHeight > 0 ? image.naturalHeight : SKETCH_COMPOSER_DEFAULT_CANVAS_HEIGHT;
      const nextHeight = Math.round(clamp(
        (naturalHeight / naturalWidth) * SKETCH_COMPOSER_CANVAS_WIDTH,
        SKETCH_COMPOSER_MIN_CANVAS_HEIGHT,
        SKETCH_COMPOSER_MAX_CANVAS_HEIGHT,
      ));
      resizeCanvas(nextHeight);
      setBackgroundImage(image);
      onInitialImageStatusChange?.('ready');
    };
    image.onerror = () => {
      if (cancelled) return;
      setBackgroundImage(null);
      onInitialImageStatusChange?.('error');
    };
    image.src = initialImageUrl;
    return () => {
      cancelled = true;
    };
  }, [initialImageUrl, onInitialImageStatusChange, onInputOpenChange, resizeCanvas]);

  const replaceElements = React.useCallback((nextElements: SketchElement[]) => {
    elementsRef.current = nextElements;
    setElements(nextElements);
  }, []);

  const closeTextDraft = React.useCallback(() => {
    if (textInputRef.current) {
      textInputRef.current.textContent = '';
    }
    textDraftRef.current = null;
    setTextDraft(null);
  }, []);

  const commitTextDraft = React.useCallback((draftOverride?: TextDraft | null): SketchTextElement | null => {
    const draft = draftOverride ?? textDraftRef.current;
    if (!draft) return null;

    const liveText = draftOverride ? draft.text : getTextDraftValue(textInputRef.current, draft.text);
    const trimmedText = trimSketchText(liveText);
    closeTextDraft();
    if (!trimmedText) return null;

    const nextElement = buildTextElementFromDraft(
      { ...draft, text: trimmedText },
      size,
      canvasRef.current?.getContext('2d') ?? null,
    );
    const nextElements = [...elementsRef.current, nextElement];
    setRedoElements([]);
    replaceElements(nextElements);
    return nextElement;
  }, [closeTextDraft, replaceElements, size]);

  React.useEffect(() => {
    const draft = textDraftRef.current;
    if (!draft) return;
    if (draft.color === textColor && draft.fontSize === selectedTextFontSize) return;
    const nextDraft = {
      ...draft,
      color: textColor,
      fontSize: selectedTextFontSize,
    };
    textDraftRef.current = nextDraft;
    setTextDraft(nextDraft);
  }, [selectedTextFontSize, textColor]);

  const handleToolSelect = React.useCallback((nextTool: SketchToolKind) => {
    openInput();
    commitTextDraft();
    if (nextTool !== 'eraser') {
      eraserRestoreToolRef.current = nextTool;
    }
    setActiveTool(nextTool);
  }, [commitTextDraft, openInput]);

  const handleToolRestore = React.useCallback((nextTool: SketchToolKind) => {
    if (nextTool === 'eraser') return;
    openInput();
    eraserRestoreToolRef.current = nextTool;
    setActiveTool(nextTool);
  }, [openInput]);

  const startCanvasInteraction = React.useCallback((
    point: SketchPoint,
    pointerId: number,
    captureCanvas?: HTMLCanvasElement | null,
  ) => {
    if (disabled) return;
    onInkChange?.(true);

    if (activeTool === 'text') {
      commitTextDraft();
      const topOffset = measureDraftTextTopOffset({
        fontFamily: SKETCH_TEXT_FONT_FAMILY,
        fontSize: selectedTextFontSize,
        lineHeight: TEXT_DRAFT_LINE_HEIGHT,
      });
      const draft: TextDraft = {
        id: crypto.randomUUID(),
        x: point.x,
        y: clamp(point.y, topOffset, size.height),
        text: '',
        color: textColor,
        fontSize: selectedTextFontSize,
      };
      textDraftRef.current = draft;
      setTextDraft(draft);
      return;
    }

    commitTextDraft();
    if (activeTool === 'shape') {
      const shape: SketchShapeElement = {
        id: crypto.randomUUID(),
        kind: 'shape',
        shape: shapeType,
        color: shapeColor,
        width: shapeWidth,
        start: point,
        end: point,
      };
      activeShapeRef.current = { pointerId, shape };
      if (pointerId >= 0) {
        captureCanvas?.setPointerCapture(pointerId);
      }
      redrawCanvas(elementsRef.current, shape);
      return;
    }

    const isEraser = activeTool === 'eraser';
    const stroke: SketchStrokeElement = {
      id: crypto.randomUUID(),
      kind: 'stroke',
      tool: isEraser ? 'eraser' : 'pen',
      color: drawColor,
      width: isEraser ? eraserWidth : drawWidth,
      points: [point],
    };

    activeStrokeRef.current = { pointerId, stroke };
    if (pointerId >= 0) {
      captureCanvas?.setPointerCapture(pointerId);
    }
    redrawCanvas(elementsRef.current, stroke);
  }, [
    activeTool,
    commitTextDraft,
    disabled,
    drawColor,
    drawWidth,
    eraserWidth,
    redrawCanvas,
    onInkChange,
    selectedTextFontSize,
    shapeColor,
    shapeType,
    shapeWidth,
    size,
    textColor,
  ]);

  const updateCanvasInteraction = React.useCallback((
    pointerId: number,
    samples: SketchPointerSample[],
  ) => {
    const canvas = canvasRef.current;
    const activeStroke = activeStrokeRef.current;
    if (!canvas) return;

    if (activeStroke && activeStroke.pointerId === pointerId) {
      for (const sample of samples) {
        activeStroke.stroke.points.push(getPointerPosition(canvas, sample, size));
      }
      redrawCanvas(elementsRef.current, activeStroke.stroke);
      return;
    }

    const activeShape = activeShapeRef.current;
    if (!activeShape || activeShape.pointerId !== pointerId) return;
    const sample = samples[samples.length - 1];
    if (!sample) return;

    activeShape.shape.end = getPointerPosition(canvas, sample, size);
    redrawCanvas(elementsRef.current, activeShape.shape);
  }, [redrawCanvas, size]);

  const clearPendingNativeTouch = React.useCallback(() => {
    if (pendingNativeTouchRef.current) {
      clearTimeout(pendingNativeTouchRef.current.timeout);
      pendingNativeTouchRef.current = null;
    }
  }, []);

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch' && activeNativeTouchRef.current) return;
    if (event.pointerType === 'touch') {
      clearPendingNativeTouch();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    event.preventDefault();
    startCanvasInteraction(getPointerPosition(canvas, event, size), event.pointerId, canvas);
  }, [clearPendingNativeTouch, size, startCanvasInteraction]);

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch') {
      clearPendingNativeTouch();
    }
    if (event.pointerType === 'touch' && activeNativeTouchRef.current) return;
    if (
      activeStrokeRef.current?.pointerId !== event.pointerId
      && activeShapeRef.current?.pointerId !== event.pointerId
    ) {
      return;
    }
    event.preventDefault();
    updateCanvasInteraction(event.pointerId, readSketchPointerSamples(event));
  }, [clearPendingNativeTouch, updateCanvasInteraction]);

  const finishActiveStroke = React.useCallback((pointerId: number) => {
    const canvas = canvasRef.current;
    const activeStroke = activeStrokeRef.current;
    if (activeStroke && activeStroke.pointerId === pointerId) {
      activeStrokeRef.current = null;
      if (pointerId >= 0 && canvas?.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }

      const nextElements = [...elementsRef.current, activeStroke.stroke];
      setRedoElements([]);
      replaceElements(nextElements);
      return;
    }

    const activeShape = activeShapeRef.current;
    if (!activeShape || activeShape.pointerId !== pointerId) return;

    activeShapeRef.current = null;
    if (pointerId >= 0 && canvas?.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }

    const bounds = normalizeShapeBounds(activeShape.shape.start, activeShape.shape.end);
    if (bounds.width < MIN_SHAPE_DRAG_SIZE && bounds.height < MIN_SHAPE_DRAG_SIZE) {
      redrawCanvas(elementsRef.current, null);
      return;
    }

    const nextElements = [...elementsRef.current, activeShape.shape];
    setRedoElements([]);
    replaceElements(nextElements);
  }, [replaceElements]);

  const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch') {
      clearPendingNativeTouch();
    }
    event.preventDefault();
    finishActiveStroke(event.pointerId);
  }, [clearPendingNativeTouch, finishActiveStroke]);

  const handlePointerCancel = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch') {
      clearPendingNativeTouch();
    }
    event.preventDefault();
    finishActiveStroke(event.pointerId);
  }, [clearPendingNativeTouch, finishActiveStroke]);

  const readPrimaryTouch = React.useCallback((event: TouchLikeEvent): SketchPointerSample | null => {
    const touch = event.touches[0] ?? event.changedTouches[0] ?? null;
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
  }, []);

  const handleTouchStart = React.useCallback((event: TouchLikeEvent) => {
    if (disabled || activeStrokeRef.current || activeShapeRef.current) return;
    const canvas = canvasRef.current;
    const touch = readPrimaryTouch(event);
    if (!canvas || !touch || event.touches.length > 1) return;

    const point = getPointerPosition(canvas, touch, size);
    const canWaitForPointerEvent = typeof window !== 'undefined' && typeof window.PointerEvent === 'function';
    if (canWaitForPointerEvent) {
      clearPendingNativeTouch();
      pendingNativeTouchRef.current = {
        point,
        samples: [touch],
        timeout: window.setTimeout(() => {
          const pending = pendingNativeTouchRef.current;
          pendingNativeTouchRef.current = null;
          if (!pending || activeStrokeRef.current || activeShapeRef.current) return;
          activeNativeTouchRef.current = true;
          startCanvasInteraction(pending.point, TOUCH_FALLBACK_POINTER_ID);
          if (pending.samples.length > 1) {
            updateCanvasInteraction(TOUCH_FALLBACK_POINTER_ID, pending.samples.slice(1));
          }
        }, TOUCH_FALLBACK_DELAY_MS),
      };
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    activeNativeTouchRef.current = true;
    startCanvasInteraction(point, TOUCH_FALLBACK_POINTER_ID);
  }, [clearPendingNativeTouch, disabled, readPrimaryTouch, size, startCanvasInteraction, updateCanvasInteraction]);

  const handleTouchMove = React.useCallback((event: TouchLikeEvent) => {
    const touch = readPrimaryTouch(event);
    if (pendingNativeTouchRef.current && touch) {
      pendingNativeTouchRef.current.samples.push(touch);
      return;
    }

    if (!activeNativeTouchRef.current) return;
    if (!touch) return;

    event.preventDefault();
    event.stopPropagation();
    updateCanvasInteraction(TOUCH_FALLBACK_POINTER_ID, [touch]);
  }, [readPrimaryTouch, updateCanvasInteraction]);

  const handleTouchEnd = React.useCallback((event: TouchLikeEvent) => {
    if (pendingNativeTouchRef.current) {
      event.preventDefault();
      event.stopPropagation();
      clearPendingNativeTouch();
      return;
    }

    if (!activeNativeTouchRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    activeNativeTouchRef.current = false;
    finishActiveStroke(TOUCH_FALLBACK_POINTER_ID);
  }, [clearPendingNativeTouch, finishActiveStroke]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const options = { passive: false };
    const onTouchStart = (event: TouchEvent) => handleTouchStart(event);
    const onTouchMove = (event: TouchEvent) => handleTouchMove(event);
    const onTouchEnd = (event: TouchEvent) => handleTouchEnd(event);
    canvas.addEventListener('touchstart', onTouchStart, options);
    canvas.addEventListener('touchmove', onTouchMove, options);
    canvas.addEventListener('touchend', onTouchEnd, options);
    canvas.addEventListener('touchcancel', onTouchEnd, options);
    return () => {
      clearPendingNativeTouch();
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [clearPendingNativeTouch, handleTouchEnd, handleTouchMove, handleTouchStart]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        clearPendingNativeTouch();
      }
      if (event.pointerType === 'touch' && activeNativeTouchRef.current) return;
      event.preventDefault();
      startCanvasInteraction(getPointerPosition(canvas, event, size), event.pointerId, canvas);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        clearPendingNativeTouch();
      }
      if (event.pointerType === 'touch' && activeNativeTouchRef.current) return;
      if (
        activeStrokeRef.current?.pointerId !== event.pointerId
        && activeShapeRef.current?.pointerId !== event.pointerId
      ) {
        return;
      }
      event.preventDefault();
      updateCanvasInteraction(event.pointerId, readSketchPointerSamples(event));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        clearPendingNativeTouch();
      }
      event.preventDefault();
      finishActiveStroke(event.pointerId);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [clearPendingNativeTouch, finishActiveStroke, size, startCanvasInteraction, updateCanvasInteraction]);

  const handleUndo = React.useCallback(() => {
    if (elements.length === 0) return;
    closeTextDraft();
    const nextElement = elements[elements.length - 1]!;
    replaceElements(elements.slice(0, -1));
    setRedoElements((current) => [...current, nextElement]);
  }, [closeTextDraft, elements, replaceElements]);

  const handleRedo = React.useCallback(() => {
    if (redoElements.length === 0) return;
    closeTextDraft();
    const nextElement = redoElements[redoElements.length - 1]!;
    setRedoElements((current) => current.slice(0, -1));
    replaceElements([...elementsRef.current, nextElement]);
  }, [closeTextDraft, redoElements, replaceElements]);

  const handleClear = React.useCallback(() => {
    activeStrokeRef.current = null;
    activeShapeRef.current = null;
    closeTextDraft();
    setBackgroundImage(null);
    setRedoElements([]);
    replaceElements([]);
    onClear?.();
  }, [closeTextDraft, onClear, replaceElements]);

  const finishResize = React.useCallback((pointerId: number, target?: HTMLDivElement | null) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== pointerId) return;

    resizeSessionRef.current = null;
    setIsResizing(false);
    if (target?.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  }, []);

  const handleResizePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activeStrokeRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    const displayWidth = Math.max(canvasFrameRef.current?.getBoundingClientRect().width ?? SKETCH_COMPOSER_CANVAS_WIDTH, 1);
    resizeSessionRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startHeight: effectiveCanvasHeight,
      displayWidth,
    };
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [disabled, effectiveCanvasHeight]);

  const handleResizePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    event.preventDefault();
    const logicalDelta = (event.clientY - session.startClientY) * (SKETCH_COMPOSER_CANVAS_WIDTH / session.displayWidth);
    const nextHeight = Math.round(clamp(
      session.startHeight + logicalDelta,
      SKETCH_COMPOSER_MIN_CANVAS_HEIGHT,
      SKETCH_COMPOSER_MAX_CANVAS_HEIGHT,
    ));
    resizeCanvas(nextHeight);
  }, [resizeCanvas]);

  const handleResizePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    finishResize(event.pointerId, event.currentTarget);
  }, [finishResize]);

  const handleResizePointerCancel = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    finishResize(event.pointerId, event.currentTarget);
  }, [finishResize]);

  const handleFramePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isResizing) {
      setIsResizeHandleVisible(true);
      return;
    }

    const rect = canvasFrameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const distanceFromBottom = rect.bottom - event.clientY;
    const isNearBottom = distanceFromBottom >= 0 && distanceFromBottom <= RESIZE_HANDLE_VISIBILITY_THRESHOLD;
    setIsResizeHandleVisible((current) => (current === isNearBottom ? current : isNearBottom));
  }, [isResizing]);

  const handleFramePointerLeave = React.useCallback(() => {
    if (!isResizing) {
      setIsResizeHandleVisible(false);
    }
  }, [isResizing]);

  React.useImperativeHandle(ref, () => ({
    exportFile: async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }

      const committedText = commitTextDraft();
      const elementList = committedText ? [...elementsRef.current] : elementsRef.current;
      redrawCanvas(elementList, activeStrokeRef.current?.stroke ?? activeShapeRef.current?.shape ?? null);

      const context = canvas.getContext('2d');
      if (!context) {
        return null;
      }

      const currentHasVisibleInk = sketchComposerHasVisibleInk(
        elementList,
        activeStrokeRef.current?.stroke ?? activeShapeRef.current?.shape ?? null,
      );
      const currentHasStoredInk = currentHasVisibleInk
        || Boolean(backgroundImage)
        || elementsExtendBeyondHeight(elementList, size.height, context);
      if (!currentHasStoredInk) {
        setHasInk(false);
        return null;
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Failed to rasterize sketch.');
      }

      return new File([blob], `sketch-guide-${size.width}x${size.height}.png`, { type: 'image/png' });
    },
    clear: () => {
      handleClear();
    },
    hasInk: () => hasInk,
  }), [backgroundImage, commitTextDraft, handleClear, hasInk, redrawCanvas, size.height, size.width]);

  React.useEffect(() => {
    if (!isCanvasOpen) return;
    redrawCanvas(elements, activeStrokeRef.current?.stroke ?? activeShapeRef.current?.shape ?? null);
  }, [elements, isCanvasOpen, redrawCanvas]);

  const hasHistory = elements.length > 0 || redoElements.length > 0;
  const canUndo = elements.length > 0;
  const canClear = hasHistory || Boolean(textDraft) || Boolean(backgroundImage);
  const canRedo = redoElements.length > 0;

  const draftLeft = textDraft ? textDraft.x * displayScale.x : 0;
  const draftTopOffset = React.useMemo(() => (
    textDraft
      ? measureDraftTextTopOffset({
          fontFamily: SKETCH_TEXT_FONT_FAMILY,
          fontSize: textDraft.fontSize,
          lineHeight: TEXT_DRAFT_LINE_HEIGHT,
        })
      : 0
  ), [textDraft]);
  const draftTop = textDraft
    ? Math.max(0, (textDraft.y - draftTopOffset) * displayScale.y)
    : 0;
  const draftFontSize = textDraft ? textDraft.fontSize * Math.min(displayScale.x, displayScale.y) : 0;
  const draftMaxWidth = textDraft ? Math.max(0, (size.width - textDraft.x) * displayScale.x) : 0;
  const isImmersiveChrome = chrome === 'immersive';
  const showCanvasPlaceholder = !hasInk && !backgroundImage && !textDraft;
  const toolbar = (
    <SketchComposerToolbar
      activeTool={isCanvasOpen ? activeTool : null}
      align="end"
      canClear={canClear}
      canRedo={canRedo}
      canUndo={canUndo}
      disabled={disabled}
      drawColor={drawColor}
      drawWidth={drawWidth}
      eraserRestoreTool={eraserRestoreToolRef.current}
      eraserWidth={eraserWidth}
      onClear={handleClear}
      onDrawColorChange={setDrawColor}
      onDrawWidthChange={setDrawWidth}
      onEraserWidthChange={setEraserWidth}
      onRedo={handleRedo}
      onShapeColorChange={setShapeColor}
      onShapeTypeChange={setShapeType}
      onShapeWidthChange={setShapeWidth}
      onTextColorChange={setTextColor}
      onTextSizeChange={setSelectedTextFontSize}
      onRestoreTool={handleToolRestore}
      onToolSelect={handleToolSelect}
      onUndo={handleUndo}
      toolbarBeforeEraser={toolbarBeforeEraser}
      shapeColor={shapeColor}
      shapeType={shapeType}
      shapeWidth={shapeWidth}
      textColor={textColor}
      textFontSize={selectedTextFontSize}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative z-40 flex min-h-[56px] items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {headerStart}
        </div>

        <div className="w-full max-w-max shrink-0">
          {toolbar}
        </div>
      </div>

      {isCanvasOpen ? (
        <div
          data-testid="sketch-composer-canvas-frame"
          ref={canvasFrameRef}
          onPointerMove={handleFramePointerMove}
          onPointerLeave={handleFramePointerLeave}
          className={cn(
            'group relative z-0 overflow-hidden rounded-2xl bg-[#ffffff]',
            !isImmersiveChrome && 'border border-[#ece6dd]',
          )}
          style={{
            width: '100%',
            aspectRatio: `${size.width} / ${size.height}`,
            height: displayHeightPx ? `${displayHeightPx}px` : undefined,
            touchAction: 'none',
            transition: frameTransition ?? 'aspect-ratio 260ms cubic-bezier(0.2, 0.9, 0.2, 1)',
            ...(isImmersiveChrome
              ? {
                  border: '1px solid rgba(17,17,17,0.08)',
                  boxShadow: frameBoxShadow ?? 'rgba(17, 17, 17, 0.07) 0px 6px 18px',
                }
              : {}),
          }}
        >
        {!isImmersiveChrome ? (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundColor: '#ffffff',
              backgroundImage: [
                'linear-gradient(0deg, rgba(29,25,20,0.06) 1px, transparent 1px)',
                'linear-gradient(90deg, rgba(29,25,20,0.06) 1px, transparent 1px)',
              ].join(','),
              backgroundSize: '28px 28px, 28px 28px',
              backgroundPosition: '0 0, 0 0',
            }}
          />
        ) : null}
        <canvas
          ref={canvasRef}
          onPointerEnter={() => setIsPointerInsideCanvas(true)}
          onPointerLeave={() => setIsPointerInsideCanvas(false)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={cn('relative z-10 h-full w-full', disabled && 'cursor-not-allowed')}
          style={{
            touchAction: 'none',
            display: 'block',
            cursor: resolveSketchCanvasCursor({
              activeTool,
              canvasReady: isCanvasReady,
              disabled,
              displayScale,
              drawColor,
              eraserWidth,
              isPointerInsideCanvas,
              isResizing,
            }),
          }}
        />

        {showCanvasPlaceholder ? (
          <div className="pointer-events-none absolute left-5 top-4 z-20 text-[18px] leading-8 text-black/26">
            Sketch all or part of your design (optional)
          </div>
        ) : null}

        {textDraft ? (
          <div
            ref={textInputRef}
            contentEditable={!disabled ? 'plaintext-only' : undefined}
            suppressContentEditableWarning
            onBlur={() => {
              commitTextDraft();
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                commitTextDraft();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                closeTextDraft();
              }
            }}
            className="absolute z-20 block min-w-[1ch] whitespace-pre-wrap outline-none"
            style={{
              left: `${draftLeft}px`,
              top: `${draftTop}px`,
              fontSize: `${draftFontSize}px`,
              color: textDraft.color,
              fontFamily: SKETCH_TEXT_FONT_FAMILY,
              lineHeight: TEXT_DRAFT_LINE_HEIGHT,
              caretColor: textDraft.color,
              cursor: 'text',
              width: `${draftMaxWidth}px`,
              maxWidth: `${draftMaxWidth}px`,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              overflowX: 'clip',
              overflowY: 'visible',
              boxSizing: 'border-box',
              margin: 0,
              padding: 0,
            }}
          />
        ) : null}

        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerCancel}
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 h-4 touch-none cursor-ns-resize',
            disabled && 'pointer-events-none cursor-not-allowed',
          )}
        >
          <div
            aria-hidden="true"
            className={cn(
              'absolute bottom-1 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[#d8d1c6] opacity-0 transition-opacity',
              (isResizeHandleVisible || isResizing) && 'bg-[#1d1914]/20 opacity-100',
            )}
          />
        </div>
        </div>
      ) : null}
    </div>
  );
});

SketchComposer.displayName = 'SketchComposer';
