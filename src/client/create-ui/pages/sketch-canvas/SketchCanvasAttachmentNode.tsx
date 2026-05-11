import React from 'react';

import type { CanvasRect } from './sceneLayout';
import type { SketchCanvasAttachmentItem } from './sketchAttachmentItems';

export const PaperclipGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none">
    <path
      d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const XGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none">
    <path
      d="m6.5 6.5 11 11M17.5 6.5l-11 11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export function SketchCanvasAttachmentNode(args: {
  attachment: SketchCanvasAttachmentItem;
  disabled?: boolean;
  rect: CanvasRect;
  animationDelayMs?: number;
  focusAreaId?: string;
  onSurfacePress?: () => void;
  onRemove: (attachment: SketchCanvasAttachmentItem) => void;
}) {
  const objectUrl = React.useMemo(() => {
    const file = args.attachment.file;
    if (!file || !file.type.startsWith('image/')) return null;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    const url = URL.createObjectURL(file);
    return url;
  }, [args.attachment.file]);

  React.useEffect(() => () => {
    if (objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }
  }, [objectUrl]);

  const thumbnailUrl = args.attachment.sourceAsset?.url || objectUrl;
  const isBusy = args.attachment.status === 'pending' || args.attachment.status === 'uploading';
  const canRemove = !args.disabled && !isBusy;

  return (
    <div
      data-pan-block="true"
      data-focus-area-id={args.focusAreaId}
      className="group absolute sketch-canvas-node-enter overflow-visible"
      onClick={(event) => {
        if (!args.onSurfacePress) return;
        if ((event.target as HTMLElement | null)?.closest('button')) return;
        args.onSurfacePress();
      }}
      style={{
        left: `${args.rect.x}px`,
        top: `${args.rect.y}px`,
        width: `${args.rect.width}px`,
        height: `${args.rect.height}px`,
        animationDelay: `${args.animationDelayMs ?? 0}ms`,
      }}
    >
      <div className="relative h-full w-full">
        <div className="flex h-full w-full items-center justify-center overflow-visible text-black/54">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="max-h-full max-w-full rounded-lg object-contain"
              decoding="async"
              draggable={false}
              loading="lazy"
            />
          ) : (
            <PaperclipGlyph />
          )}
        </div>
        <button
          type="button"
          className={[
            'absolute -right-3 -top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100',
            !canRemove ? 'pointer-events-none opacity-0' : '',
          ].join(' ')}
          aria-label={`Remove ${args.attachment.name}`}
          disabled={!canRemove}
          onClick={(event) => {
            event.stopPropagation();
            if (!canRemove) return;
            args.onRemove(args.attachment);
          }}
        >
          <XGlyph />
        </button>
      </div>
    </div>
  );
}
