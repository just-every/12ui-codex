import React from 'react';

import { cn } from '../../../lib/cn';
import {
  ERASER_CURSOR_DIAMETER_RANGE,
  ERASER_CURSOR_PADDING,
  ERASER_CURSOR_VISUAL,
} from './SketchComposerCursor';
import {
  getSketchComposerIcon,
  SketchComposerSvgIcon,
  type SketchComposerIconName,
} from './sketchComposerIcons';
import {
  clamp,
  DRAW_WIDTH_RANGE,
  ERASER_WIDTH_RANGE,
  type SketchColor,
  type SketchShapeType,
  type SketchToolKind,
  SHAPE_WIDTH_RANGE,
  SKETCH_COLOR_OPTIONS,
  SKETCH_SHAPE_OPTIONS,
  TEXT_SIZE_RANGE,
} from './sketchComposerModel';

type SketchComposerToolbarProps = {
  activeTool: SketchToolKind | null;
  align?: 'start' | 'end';
  disabled?: boolean;
  drawColor: SketchColor;
  drawWidth: number;
  eraserRestoreTool: Exclude<SketchToolKind, 'eraser'>;
  eraserWidth: number;
  canClear: boolean;
  canRedo: boolean;
  canUndo: boolean;
  onDrawColorChange: (color: SketchColor) => void;
  onDrawWidthChange: (width: number) => void;
  onEraserWidthChange: (width: number) => void;
  onClear: () => void;
  onShapeColorChange: (color: SketchColor) => void;
  onShapeTypeChange: (shape: SketchShapeType) => void;
  onShapeWidthChange: (width: number) => void;
  onTextColorChange: (color: SketchColor) => void;
  onTextSizeChange: (fontSize: number) => void;
  onRedo: () => void;
  onRestoreTool?: (tool: SketchToolKind) => void;
  onToolSelect: (tool: SketchToolKind) => void;
  onUndo: () => void;
  toolbarBeforeEraser?: React.ReactNode;
  shapeColor: SketchColor;
  shapeType: SketchShapeType;
  shapeWidth: number;
  textColor: SketchColor;
  textFontSize: number;
};

const TOOL_BUTTONS: readonly {
  tool: SketchToolKind;
  label: string;
  icon: SketchComposerIconName;
  iconColor: string;
}[] = [
  { tool: 'draw', label: 'Draw tool', icon: 'draw', iconColor: '#1d1914' },
  { tool: 'shape', label: 'Shape tool', icon: 'draw', iconColor: '#6f6659' },
  { tool: 'text', label: 'Text tool', icon: 'text', iconColor: '#1d1914' },
  { tool: 'eraser', label: 'Erase', icon: 'undo', iconColor: '#6f6659' },
] as const;

const renderShapeIcon = (shape: SketchShapeType, stroke: string) => {
  if (shape === 'circle') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" data-testid={`shape-icon-${shape}`}>
        <circle cx="9" cy="9" r="5.2" fill="none" stroke={stroke} strokeWidth="1.6" />
      </svg>
    );
  }
  if (shape === 'line') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" data-testid={`shape-icon-${shape}`}>
        <path d="M3 13L15 5" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (shape === 'arrow') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" data-testid={`shape-icon-${shape}`}>
        <path
          d="M3 13L12.2 5.8M12.2 5.8H8.8M12.2 5.8V9.3"
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" data-testid={`shape-icon-${shape}`}>
      <rect x="2.7" y="3.5" width="12.6" height="11" rx="0.8" fill="none" stroke={stroke} strokeWidth="1.6" />
    </svg>
  );
};

const ERASER_ICON = getSketchComposerIcon('eraser');

const renderEraserPreviewIcon = (size: number) => (
  <svg width={size} height={size} viewBox={`0 0 ${ERASER_ICON.width} ${ERASER_ICON.height}`} aria-hidden="true">
    <path fill={ERASER_CURSOR_VISUAL.iconFill} d={ERASER_ICON.path} />
  </svg>
);

const ColorDots = (props: {
  activeColor: SketchColor;
  disabled?: boolean;
  onChange: (color: SketchColor) => void;
  prefix: 'draw' | 'shape' | 'text';
}) => (
  <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
    {SKETCH_COLOR_OPTIONS.map((option) => {
      const isActive = option.value === props.activeColor;
      return (
        <button
          key={`${props.prefix}-${option.value}`}
          type="button"
          onClick={() => props.onChange(option.value)}
          disabled={props.disabled}
          aria-label={`${option.label} ${props.prefix} color`}
          className={cn(
            'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform duration-150',
            isActive && 'scale-[1.03]',
            !isActive && !props.disabled && 'hover:scale-[1.03]',
            props.disabled && 'cursor-not-allowed opacity-50',
          )}
          aria-pressed={isActive}
          data-testid={`sketch-${props.prefix}-color-${option.label.toLowerCase()}`}
        >
          <span
            aria-hidden="true"
            className={cn(
              'rounded-full transition-[width,height,transform] duration-150',
              isActive ? 'h-8 w-8' : 'h-5 w-5',
            )}
            style={{
              backgroundColor: option.value,
              boxShadow: isActive ? '0 10px 18px rgba(29, 25, 20, 0.12)' : '0 1px 2px rgba(29, 25, 20, 0.08)',
            }}
          />
        </button>
      );
    })}
  </div>
);

const RangeControl = (props: {
  display?: 'stroke' | 'value';
  disabled?: boolean;
  max: number;
  min: number;
  onChange: (value: number) => void;
  previewColor?: string;
  previewShape?: 'pill' | 'circle';
  step: number;
  testId: string;
  value: number;
}) => {
  const previewShape = props.previewShape ?? 'pill';
  const isEraserCirclePreview = previewShape === 'circle';
  const previewDiameter = isEraserCirclePreview
    ? Math.round(clamp(props.value, ERASER_CURSOR_DIAMETER_RANGE.min, ERASER_CURSOR_DIAMETER_RANGE.max))
    : Math.max(10, Math.min(24, Math.round(props.value * 0.48)));
  const previewIconSize = isEraserCirclePreview
    ? clamp(previewDiameter * 0.42, 7, 18)
    : Math.max(7, Math.min(12, Math.round(previewDiameter * 0.46)));
  const previewFrameSize = isEraserCirclePreview
    ? previewDiameter + (ERASER_CURSOR_PADDING * 2)
    : undefined;

  return (
    <div className="flex w-[250px] shrink-0 items-center gap-3">
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.currentTarget.value))}
        disabled={props.disabled}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e9dfd0] accent-[#4b4339]"
        data-testid={props.testId}
      />
      {props.display === 'stroke' ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center',
            isEraserCirclePreview ? 'shrink-0' : 'h-8 min-w-[44px] px-2',
          )}
          style={isEraserCirclePreview
            ? {
                width: `${previewFrameSize}px`,
                height: `${previewFrameSize}px`,
              }
            : undefined}
          data-testid={`${props.testId}-preview`}
        >
          <span
            className={cn(
              'rounded-full',
              isEraserCirclePreview ? 'inline-flex items-center justify-center' : 'block',
            )}
            style={isEraserCirclePreview
              ? {
                  width: `${previewDiameter}px`,
                  height: `${previewDiameter}px`,
                  backgroundColor: ERASER_CURSOR_VISUAL.fill,
                  border: `${ERASER_CURSOR_VISUAL.outerStrokeWidth}px solid ${ERASER_CURSOR_VISUAL.outerStroke}`,
                  boxShadow: `inset 0 0 0 ${ERASER_CURSOR_VISUAL.innerStrokeWidth}px ${ERASER_CURSOR_VISUAL.innerStroke}`,
                }
              : {
                  width: '28px',
                  height: `${props.value}px`,
                  backgroundColor: props.previewColor ?? '#4b4339',
                }}
          >
            {isEraserCirclePreview ? (
              renderEraserPreviewIcon(previewIconSize)
            ) : null}
          </span>
        </span>
      ) : (
        <span className="min-w-[44px] rounded-full bg-[#f2e9db] px-2 py-1 text-right text-[10px] font-semibold tracking-[0.12em] text-[#4b4339]">
          {props.value}px
        </span>
      )}
    </div>
  );
};

const ShapeChips = (props: {
  activeShape: SketchShapeType;
  activeColor: SketchColor;
  disabled?: boolean;
  onChange: (shape: SketchShapeType) => void;
}) => {
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      {SKETCH_SHAPE_OPTIONS.map((option) => {
        const isActive = option.value === props.activeShape;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => props.onChange(option.value)}
            disabled={props.disabled}
            aria-label={option.label}
            className={cn(
              'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-colors',
              isActive ? 'shadow-[0_6px_16px_rgba(29,25,20,0.12)]' : 'border-[#e1d4c3] bg-white',
              !isActive && !props.disabled && 'hover:border-[#cdbfae] hover:bg-white',
              props.disabled && 'cursor-not-allowed opacity-50',
            )}
            style={isActive ? { backgroundColor: props.activeColor, borderColor: props.activeColor } : undefined}
            aria-pressed={isActive}
            data-testid={`sketch-shape-${option.value}`}
          >
            {renderShapeIcon(option.value, isActive ? '#ffffff' : '#6f6659')}
          </button>
        );
      })}
    </div>
  );
};

const PANEL_HIDE_DELAY_MS = 1600;
const PANEL_HOVER_OPEN_DELAY_MS = 1000;
const PANEL_FALLBACK_DOWN_BREAKPOINT_PX = 1180;

const HistoryButton = (props: {
  ariaLabel: string;
  disabled?: boolean;
  icon: SketchComposerIconName;
  onClick: () => void;
  testId: string;
  title: string;
}) => (
  <button
    type="button"
    title={props.title}
    onClick={props.onClick}
    disabled={props.disabled}
    aria-label={props.ariaLabel}
    data-testid={props.testId}
    className={cn(
      'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border bg-white transition-colors',
      props.disabled ? 'cursor-not-allowed border-[#e1d4c3] opacity-30' : 'border-[#e1d4c3]',
      !props.disabled && 'hover:border-[#cdbfae] hover:bg-white',
    )}
  >
    <SketchComposerSvgIcon name={props.icon} size={13} color="#4b4339" />
  </button>
);

export const SketchComposerToolbar = ({
  activeTool,
  align = 'end',
  canClear,
  canRedo,
  canUndo,
  disabled,
  drawColor,
  drawWidth,
  eraserRestoreTool,
  eraserWidth,
  onClear,
  onDrawColorChange,
  onDrawWidthChange,
  onEraserWidthChange,
  onRedo,
  onShapeColorChange,
  onShapeTypeChange,
  onShapeWidthChange,
  onTextColorChange,
  onTextSizeChange,
  onToolSelect,
  onRestoreTool,
  onUndo,
  toolbarBeforeEraser,
  shapeColor,
  shapeType,
  shapeWidth,
  textColor,
  textFontSize,
}: SketchComposerToolbarProps) => {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = React.useRef<number | null>(null);
  const showTimeoutRef = React.useRef<number | null>(null);
  const hasMountedRef = React.useRef(false);
  const pendingEraserRestoreRef = React.useRef(false);
  const suppressNextToolPanelRef = React.useRef(false);
  const [isPanelVisible, setIsPanelVisible] = React.useState(false);
  const [panelPlacement, setPanelPlacement] = React.useState<'up' | 'down'>('up');

  const clearShowTimeout = React.useCallback(() => {
    if (showTimeoutRef.current !== null) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  }, []);

  const clearHideTimeout = React.useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const showPanel = React.useCallback(() => {
    clearShowTimeout();
    clearHideTimeout();
    setIsPanelVisible(true);
  }, [clearHideTimeout, clearShowTimeout]);

  const scheduleShowPanel = React.useCallback(() => {
    if (isPanelVisible) {
      showPanel();
      return;
    }
    clearShowTimeout();
    showTimeoutRef.current = window.setTimeout(() => {
      setIsPanelVisible(true);
      showTimeoutRef.current = null;
    }, PANEL_HOVER_OPEN_DELAY_MS);
  }, [clearShowTimeout, isPanelVisible, showPanel]);

  const scheduleHidePanel = React.useCallback(() => {
    clearShowTimeout();
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsPanelVisible(false);
      hideTimeoutRef.current = null;
    }, PANEL_HIDE_DELAY_MS);
  }, [clearHideTimeout, clearShowTimeout]);

  React.useEffect(() => {
    if (!activeTool) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (suppressNextToolPanelRef.current) {
      suppressNextToolPanelRef.current = false;
      return;
    }
    showPanel();
  }, [activeTool, showPanel]);

  React.useEffect(() => {
    if (isPanelVisible || activeTool !== 'eraser' || !pendingEraserRestoreRef.current) return;
    pendingEraserRestoreRef.current = false;
    suppressNextToolPanelRef.current = true;
    onRestoreTool?.(eraserRestoreTool);
  }, [activeTool, eraserRestoreTool, isPanelVisible, onRestoreTool]);

  const handleEraserHistoryAction = React.useCallback((action: () => void) => {
    action();
    pendingEraserRestoreRef.current = true;
  }, []);

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!toolbarRef.current) return;
      if (toolbarRef.current.contains(event.target as Node)) return;
      clearHideTimeout();
      setIsPanelVisible(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      clearShowTimeout();
      clearHideTimeout();
    };
  }, [clearHideTimeout, clearShowTimeout]);

  React.useLayoutEffect(() => {
    if (!isPanelVisible) return;

    const updatePlacement = () => {
      const toolbar = toolbarRef.current;
      const panel = panelRef.current;
      if (!toolbar || !panel) return;

      const toolbarRect = toolbar.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const availableAbove = toolbarRect.top;
      const availableBelow = window.innerHeight - toolbarRect.bottom;
      const preferDown = window.innerWidth <= PANEL_FALLBACK_DOWN_BREAKPOINT_PX;
      const nextPlacement = preferDown || availableAbove < panelRect.height + 24
        ? (availableBelow >= panelRect.height + 16 ? 'down' : 'up')
        : 'up';
      setPanelPlacement((current) => (current === nextPlacement ? current : nextPlacement));
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [activeTool, isPanelVisible]);

  const getActiveToolFillColor = (tool: SketchToolKind): string => {
    if (tool === 'draw') return drawColor;
    if (tool === 'shape') return shapeColor;
    if (tool === 'text') return textColor;
    return '#1d1914';
  };

  const renderToolGlyph = (tool: SketchToolKind, isActive: boolean, iconColor: string) => {
    if (tool === 'shape') {
      return renderShapeIcon(shapeType, isActive ? '#ffffff' : iconColor);
    }
    const icon = TOOL_BUTTONS.find((button) => button.tool === tool)?.icon ?? 'draw';
    return <SketchComposerSvgIcon name={icon} size={15} color={isActive ? '#ffffff' : iconColor} />;
  };

  return (
    <div
      ref={toolbarRef}
      className={cn(
        'relative z-50 flex h-[56px] w-full flex-col',
        align === 'start' ? 'items-start' : 'items-end',
      )}
    >
      <div
        ref={panelRef}
        className={cn(
          'absolute z-50 w-max max-w-[min(980px,calc(100vw-32px))] overflow-hidden rounded-[20px] border border-[#e6dac8] bg-white px-3 py-3 shadow-[0_12px_30px_rgba(29,25,20,0.08)] transition duration-200',
          align === 'start' ? 'left-0' : 'right-0',
          panelPlacement === 'up' ? 'bottom-full mb-3' : 'top-full mt-3',
          isPanelVisible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
        data-testid="sketch-tool-controls"
        data-placement={panelPlacement}
        onPointerEnter={showPanel}
        onPointerLeave={scheduleHidePanel}
      >
        <div className="flex min-h-16 flex-nowrap items-center gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap">
          {activeTool === 'draw' ? (
            <>
              <ColorDots
                prefix="draw"
                activeColor={drawColor}
                disabled={disabled}
                onChange={onDrawColorChange}
              />
              <div aria-hidden="true" className="h-8 w-px shrink-0 bg-[#e9dfd0]" />
              <RangeControl
                display="stroke"
                min={DRAW_WIDTH_RANGE.min}
                max={DRAW_WIDTH_RANGE.max}
                step={DRAW_WIDTH_RANGE.step}
                value={drawWidth}
                onChange={onDrawWidthChange}
                disabled={disabled}
                previewColor={drawColor}
                testId="sketch-draw-width-slider"
              />
            </>
          ) : null}

          {activeTool === 'shape' ? (
            <>
              <ShapeChips
                activeShape={shapeType}
                activeColor={shapeColor}
                disabled={disabled}
                onChange={onShapeTypeChange}
              />
              <div aria-hidden="true" className="h-8 w-px shrink-0 bg-[#e9dfd0]" />
              <ColorDots
                prefix="shape"
                activeColor={shapeColor}
                disabled={disabled}
                onChange={onShapeColorChange}
              />
              <div aria-hidden="true" className="h-8 w-px shrink-0 bg-[#e9dfd0]" />
              <RangeControl
                display="stroke"
                min={SHAPE_WIDTH_RANGE.min}
                max={SHAPE_WIDTH_RANGE.max}
                step={SHAPE_WIDTH_RANGE.step}
                value={shapeWidth}
                onChange={onShapeWidthChange}
                disabled={disabled}
                previewColor={shapeColor}
                testId="sketch-shape-width-slider"
              />
            </>
          ) : null}

          {activeTool === 'text' ? (
            <>
              <ColorDots
                prefix="text"
                activeColor={textColor}
                disabled={disabled}
                onChange={onTextColorChange}
              />
              <div aria-hidden="true" className="h-8 w-px shrink-0 bg-[#e9dfd0]" />
              <RangeControl
                min={TEXT_SIZE_RANGE.min}
                max={TEXT_SIZE_RANGE.max}
                step={TEXT_SIZE_RANGE.step}
                value={textFontSize}
                onChange={onTextSizeChange}
                disabled={disabled}
                testId="sketch-text-size-slider"
              />
            </>
          ) : null}

          {activeTool === 'eraser' ? (
            <>
              <RangeControl
                display="stroke"
                min={ERASER_WIDTH_RANGE.min}
                max={ERASER_WIDTH_RANGE.max}
                step={ERASER_WIDTH_RANGE.step}
                value={eraserWidth}
                onChange={onEraserWidthChange}
                disabled={disabled}
                previewColor="#4b4339"
                previewShape="circle"
                testId="sketch-eraser-width-slider"
              />
              <div aria-hidden="true" className="h-8 w-px shrink-0 bg-[#e9dfd0]" />
              <div className="flex shrink-0 items-center gap-2">
                <HistoryButton
                  ariaLabel="Undo stroke"
                  disabled={disabled || !canUndo}
                  icon="undo"
                  onClick={() => handleEraserHistoryAction(onUndo)}
                  testId="sketch-undo-button"
                  title="Undo"
                />
                <HistoryButton
                  ariaLabel="Redo stroke"
                  disabled={disabled || !canRedo}
                  icon="redo"
                  onClick={() => handleEraserHistoryAction(onRedo)}
                  testId="sketch-redo-button"
                  title="Redo"
                />
                <HistoryButton
                  ariaLabel="Clear sketch"
                  disabled={disabled || !canClear}
                  icon="trash"
                  onClick={() => handleEraserHistoryAction(onClear)}
                  testId="sketch-clear-button"
                  title="Clear"
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {TOOL_BUTTONS.map((button) => {
          const isActive = activeTool === button.tool;
          const activeFillColor = getActiveToolFillColor(button.tool);
          return (
            <React.Fragment key={button.tool}>
              {button.tool === 'eraser' && toolbarBeforeEraser ? (
                <div className="relative pb-3">
                  {toolbarBeforeEraser}
                </div>
              ) : null}
              <div title={button.label} className="relative pb-3">
                <button
                  type="button"
                  onPointerEnter={isActive ? scheduleShowPanel : undefined}
                  onPointerLeave={scheduleHidePanel}
                  onClick={() => {
                    if (isActive) {
                      if (isPanelVisible) {
                        clearShowTimeout();
                        clearHideTimeout();
                        setIsPanelVisible(false);
                        return;
                      }
                      showPanel();
                      return;
                    }
                    pendingEraserRestoreRef.current = false;
                    onToolSelect(button.tool);
                    showPanel();
                  }}
                  disabled={disabled}
                  className={cn(
                    'inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border transition-colors',
                    isActive ? 'shadow-[0_8px_20px_rgba(29,25,20,0.14)]' : 'border-[#e1d4c3] bg-white',
                    !isActive && !disabled && 'hover:border-[#cdbfae] hover:bg-white',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                  style={isActive ? { backgroundColor: activeFillColor, borderColor: activeFillColor } : undefined}
                  aria-pressed={isActive}
                  aria-label={button.label}
                  data-testid={`sketch-tool-${button.tool}`}
                >
                  {renderToolGlyph(button.tool, isActive, button.iconColor)}
                </button>
                {isActive ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 44 12"
                    className="absolute bottom-0 left-1/2 h-[10px] w-11 -translate-x-1/2 overflow-visible"
                  >
                    <path
                      d="M4 3 Q22 11 40 3"
                      fill="none"
                      stroke={activeFillColor}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      data-testid={`sketch-tool-${button.tool}-underline`}
                    />
                  </svg>
                ) : null}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
