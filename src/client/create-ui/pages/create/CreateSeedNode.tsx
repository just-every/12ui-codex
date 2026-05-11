import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { SketchComposer, type SketchComposerHandle } from '../../app/screens/design-create/SketchComposer';
import { cn } from '../../lib/cn';
import { PaperclipGlyph } from '../sketch-canvas/SketchCanvasAttachmentNode';

const ACTIVE_SURFACE_BOX_SHADOW = 'rgba(17, 17, 17, 0.07) 0px 6px 18px';
const INSET_SURFACE_BORDER_SHADOW = 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)';

export function CreateSeedNode(args: {
  prompt: string;
  attachmentCount: number;
  uploadError?: string | null;
  runError?: string | null;
  isUploading: boolean;
  isCreating: boolean;
  headerControls?: React.ReactNode;
  title?: string;
  canCreate: boolean;
  createLabel: string;
  hasSketchContent: boolean;
  isSketchInputOpen: boolean;
  initialImageUrl?: string | null;
  canvasHeight: number;
  displayHeightPx?: number;
  promptHeight: number;
  sketchComposerRef: React.RefObject<SketchComposerHandle | null>;
  onSketchInputOpenChange: (isOpen: boolean) => void;
  onPromptChange: (prompt: string) => void;
  onPromptFocusChange: (isFocused: boolean) => void;
  onCanvasHeightChange: (height: number) => void;
  onSketchClear: () => void;
  onSketchInkChange: (hasInk: boolean) => void;
  onSeedFilesSelected: (files: File[]) => void;
  onCreate: () => void;
  onFocusArea?: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div
      className="relative flex h-full flex-col"
      onClickCapture={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest('button,input,textarea,[role="button"],[role="slider"]')) return;
        args.onFocusArea?.();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          args.onSeedFilesSelected(files);
        }}
      />
      <div className="shrink-0">
        <SketchComposer
          ref={args.sketchComposerRef}
          canvasHeight={args.canvasHeight}
          chrome="immersive"
          initialImageUrl={args.initialImageUrl}
          isInputOpen={args.isSketchInputOpen}
          displayHeightPx={args.displayHeightPx}
          canvasHeightMode="default"
          frameBoxShadow={args.isSketchInputOpen ? ACTIVE_SURFACE_BOX_SHADOW : 'none'}
          frameTransition="height 260ms cubic-bezier(0.2, 0.9, 0.2, 1), aspect-ratio 260ms cubic-bezier(0.2, 0.9, 0.2, 1)"
          headerStart={(
            <div className="flex max-w-[760px] flex-col gap-3">
              <h1 className="text-[40px] font-medium leading-[1.05] tracking-[-0.04em] text-black">
                {args.title ?? 'UI Design'}
              </h1>
            </div>
          )}
          onCanvasHeightChange={args.onCanvasHeightChange}
          onClear={args.onSketchClear}
          onInkChange={args.onSketchInkChange}
          onInputOpenChange={args.onSketchInputOpenChange}
          toolbarBeforeEraser={(
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={args.isCreating || args.isUploading}
              className={cn(
                'relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#e1d4c3] bg-white text-[#4b4339] transition-colors',
                args.isCreating || args.isUploading
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:border-[#cdbfae] hover:bg-white',
              )}
              aria-label="Attach reference images"
              title="Attach reference images"
            >
              {args.isUploading ? <ActivityIndicator size="small" color="#4b4339" /> : <PaperclipGlyph />}
              {args.attachmentCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white">
                  {args.attachmentCount}
                </span>
              ) : null}
            </button>
          )}
        />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3">
        <div className="relative">
          <textarea
            aria-label="Describe your design"
            className="w-full resize-none rounded-[24px] border-0 bg-white px-5 py-4 text-[18px] leading-7 text-black outline-none placeholder:text-black/26"
            style={{
              boxShadow: args.isSketchInputOpen ? INSET_SURFACE_BORDER_SHADOW : ACTIVE_SURFACE_BOX_SHADOW,
              height: `${args.promptHeight}px`,
              minHeight: '170px',
              transition: 'height 260ms cubic-bezier(0.2, 0.9, 0.2, 1)',
            }}
            placeholder="Describe your design (optional)"
            value={args.prompt}
            onChange={(event) => args.onPromptChange(event.currentTarget.value)}
            onFocus={() => args.onPromptFocusChange(true)}
            onBlur={() => args.onPromptFocusChange(false)}
          />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[220px] flex-1">
            {args.headerControls}
          </div>
          <button
            type="button"
            aria-label={args.createLabel}
            disabled={!args.canCreate}
            className={cn(
              'inline-flex min-h-[56px] min-w-[190px] items-center justify-center rounded-full px-8 py-4 text-[16px] font-semibold leading-none text-white',
              args.canCreate ? 'bg-black' : 'bg-black/18',
            )}
            onClick={args.onCreate}
          >
            {args.createLabel}
          </button>
        </div>
      </div>
      {args.uploadError || args.runError ? (
        <View className="mt-4 rounded-[18px] border border-[#efc7be] bg-[#fff1ee] px-4 py-3">
          <Text className="text-sm text-[#7b2727]">{args.uploadError || args.runError}</Text>
        </View>
      ) : null}
    </div>
  );
}
