import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppStatus, CodexBridgeStatus, CreateWorkspace, CreateWorkspacePage, DesignImageEditRequest, DesignImageExtensionRequest, DesignOutput, DesignRun, HandoverResult } from '../../shared/types.js';
import { resolveDesignAssetPath, resolveDesignImage } from '../../shared/designImageRevision.js';
import { CreateCanvasShell } from '../create-ui/pages/create/CreateCanvasSharedNodes';
import { SketchDraftLoadingDots } from '../create-ui/pages/sketch-result/SketchDraftLoadingDots';
import { SketchProgressBar } from '../create-ui/pages/sketch-result/SketchProgressBar';
import { runAssetUrl } from '../api.js';
import { cn } from '../lib/cn.js';
import { buildCreatePendingProgressSnapshot } from './createPendingProgress.js';
import { DesignImageControls, type DesignImageDisplayFrame } from './DesignImageControls.js';
import { DesignImageExpansionControls } from './DesignImageExpansionControls.js';
import { RunVersionMenu } from './RunVersionMenu.js';
import { copyHandoffText } from './handoffClipboard.js';
import type { ConnectionState, ExportNodeActions, RunMap } from './types.js';

const resolveDesignDownloadFilename = (design: DesignOutput): string => {
  const assetPath = resolveDesignAssetPath(design);
  const base = (design.title || `design-${design.branchIndex}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `design-${design.branchIndex}`;
  const extension = assetPath.match(/\.(png|jpe?g|webp)$/i)?.[0].toLowerCase() ?? '.png';
  return `${base}${extension}`;
};

type TextHandoffImage = {
  label: string;
  title: string;
  runId: string;
  designId: string;
  imageUrl: string;
  prompt: string;
};

type HandoffFormat = 'image' | 'html';

const HandoffFormatChevron = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4 text-white/82"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      d="M7 14.5 12 9.5l5 5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
    />
  </svg>
);

const absoluteRunAssetUrl = (runId: string, assetPath: string): string => (
  new URL(runAssetUrl(runId, assetPath), window.location.origin).toString()
);

const handoverMarkdownUrl = (handover: HandoverResult): string => (
  `/api/runs/${encodeURIComponent(handover.runId)}/handovers/${encodeURIComponent(handover.designId)}/handover.md`
);

const absoluteHandoverUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  return new URL(url, window.location.origin).toString();
};

const handoverLinkLines = (handover: HandoverResult): string[] => ([
  ['HTML', absoluteHandoverUrl(handover.handoverHtmlUrl)],
  ['Markdown', absoluteHandoverUrl(handover.handoverUrl)],
  ['Status', absoluteHandoverUrl(handover.statusUrl)],
  ['Zip', absoluteHandoverUrl(handover.zipUrl)],
] as Array<[string, string | null]>)
  .filter((entry): entry is [string, string] => Boolean(entry[1]))
  .map(([label, url]) => `- ${label}: ${url}`);

const fetchHandoverMarkdown = async (handover: HandoverResult): Promise<string> => {
  const response = await fetch(handoverMarkdownUrl(handover));
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string' ? body.error : `Handoff document request failed with ${response.status}.`);
  }
  return response.text();
};

export function CreatePageCanvasNodeLocal(args: {
  page: CreateWorkspacePage;
  isCreating: boolean;
  onPromptChange: (prompt: string) => void;
  onCreate: () => void;
  onSwitchRun: (runId: string) => void;
  onFocusArea?: () => void;
}) {
  const canCreate = args.page.prompt.trim().length > 0;
  const createLabel = args.isCreating
    ? 'Create new version'
    : args.page.runId
      ? 'Create again'
      : 'Create page designs';
  return (
    <CreateCanvasShell title={args.page.title} titleClassName="text-[28px]" onFocusArea={args.onFocusArea}>
      <div className="relative">
        <textarea
          aria-label={`${args.page.title} prompt`}
          className="min-h-[134px] w-full resize-none rounded-[24px] border-0 bg-white px-5 py-4 text-[16px] leading-6 text-black outline-none placeholder:text-black/32"
          style={{ boxShadow: '0 18px 54px rgba(24, 20, 16, 0.10), inset 0 0 0 1px rgba(0, 0, 0, 0.08)' }}
          value={args.page.prompt}
          onChange={(event) => args.onPromptChange(event.currentTarget.value)}
        />
      </div>
      <div className="mt-5 flex justify-end">
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className="inline-flex min-h-[56px] w-auto shrink-0 items-center justify-center rounded-full px-7 text-[15px] font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.14)] outline-none disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-black/16"
            style={{ backgroundColor: canCreate ? '#000000' : 'rgba(0, 0, 0, 0.18)' }}
            disabled={!canCreate}
            onClick={args.onCreate}
          >
            {createLabel}
          </button>
          <RunVersionMenu
            label="Page version"
            runIds={args.page.runIds}
            activeRunId={args.page.runId}
            onChange={args.onSwitchRun}
          />
        </div>
      </div>
      {args.page.error ? (
        <View className="mt-4 rounded-[18px] border border-[#efc7be] bg-[#fff1ee] px-4 py-3">
          <Text className="text-sm text-[#7b2727]">{args.page.error}</Text>
        </View>
      ) : null}
    </CreateCanvasShell>
  );
}

export function CreateVariationCanvasNodeLocal(args: {
  title: string;
  run: DesignRun;
  design: DesignOutput;
  selected: boolean;
  label?: string;
  presentation?: 'default' | 'stack-front' | 'stack-background';
  stackHovered?: boolean;
  stackIndex?: number;
  onPreviewClick?: () => void;
  onSelect: () => void;
  imageActions?: {
    onEditDesignImage: (request: DesignImageEditRequest) => Promise<void>;
    onExtendDesignImage: (request: DesignImageExtensionRequest) => Promise<void>;
    onSetActiveRevision: (activeRevisionId: string | null) => Promise<void>;
  };
}) {
  const imageContainerRef = React.useRef<HTMLDivElement | null>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const [imageFrame, setImageFrame] = React.useState<DesignImageDisplayFrame | null>(null);
  const [isExtendingImage, setExtendingImage] = React.useState(false);
  const [isImageControlsVisible, setImageControlsVisible] = React.useState(false);
  const imageUrl = runAssetUrl(args.run.id, resolveDesignAssetPath(args.design));
  const presentation = args.presentation ?? 'default';
  const isStackPreview = presentation !== 'default';
  const isBackground = presentation === 'stack-background';
  const updateImageFrame = React.useCallback(() => {
    const container = imageContainerRef.current;
    const image = imageRef.current;
    if (!container || !image || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      setImageFrame(null);
      return;
    }
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) {
      setImageFrame(null);
      return;
    }
    const scale = Math.min(containerWidth / image.naturalWidth, containerHeight / image.naturalHeight);
    const displayWidth = image.naturalWidth * scale;
    const displayHeight = image.naturalHeight * scale;
    setImageFrame({
      displayHeight,
      displayWidth,
      left: (containerWidth - displayWidth) / 2,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      top: (containerHeight - displayHeight) / 2,
    });
  }, []);
  React.useEffect(() => {
    updateImageFrame();
  }, [imageUrl, updateImageFrame]);
  React.useEffect(() => {
    const container = imageContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateImageFrame);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateImageFrame]);
  const backgroundHoverTransforms = [
    'translate(-10px, -8px) scale(0.96)',
    'translate(12px, 8px) scale(0.96)',
    'translate(-8px, 10px) scale(0.96)',
    'translate(10px, -6px) scale(0.96)',
  ];
  const stackTransform = isBackground
    ? args.stackHovered
      ? backgroundHoverTransforms[Math.max(0, (args.stackIndex ?? 0) - 1) % backgroundHoverTransforms.length]
      : 'scale(0.94)'
    : presentation === 'stack-front' && args.stackHovered
      ? 'translateY(-4px) scale(1.01)'
      : undefined;
  return (
    <div
      className={cn('relative h-full', isStackPreview ? 'cursor-pointer' : '')}
      aria-label={isStackPreview ? 'Expand design choices' : undefined}
      data-pan-block={isStackPreview ? 'true' : undefined}
      data-testid={`create-variation-${args.design.branchIndex}`}
      role={isStackPreview ? 'button' : undefined}
      tabIndex={isStackPreview ? 0 : undefined}
      onPointerDown={(event) => {
        if (!isStackPreview) return;
        event.stopPropagation();
      }}
      onPointerEnter={() => {
        if (!isStackPreview) setImageControlsVisible(true);
      }}
      onPointerLeave={() => {
        if (!isStackPreview) setImageControlsVisible(false);
      }}
      onClick={(event) => {
        if (!isStackPreview) return;
        event.stopPropagation();
        args.onPreviewClick?.();
      }}
      onKeyDown={(event) => {
        if (!isStackPreview) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        args.onPreviewClick?.();
      }}
    >
      <div className={cn('absolute -top-[44px] left-0 min-w-[260px]', isStackPreview ? 'hidden' : '')}>
        <Text className="truncate text-[17px] font-semibold leading-[22px] text-black">{args.title}</Text>
        {args.label ? (
          <Text className="mt-1 text-[11px] font-semibold uppercase tracking-[1.6px] text-black/42">{args.label}</Text>
        ) : null}
      </div>
      <div
        className={cn(
          'group relative h-full w-full overflow-visible rounded-[18px] border bg-white shadow-[0_18px_54px_rgba(24,20,16,0.10)] transition-[opacity,transform,box-shadow] duration-200',
          args.selected ? 'border-black' : 'border-black/10',
          presentation === 'stack-front' ? 'shadow-[0_22px_70px_rgba(0,0,0,0.22)] hover:shadow-[0_28px_82px_rgba(0,0,0,0.24)]' : '',
          isBackground ? 'opacity-45 shadow-[0_12px_34px_rgba(24,20,16,0.08)]' : '',
        )}
        style={stackTransform ? { transform: stackTransform } : undefined}
      >
        <div ref={imageContainerRef} className="relative h-full w-full overflow-hidden rounded-[18px] bg-[#fffdf9]">
          <img
            ref={imageRef}
            src={imageUrl}
            alt={args.design.title}
            className="h-full w-full object-contain"
            decoding="async"
            draggable={false}
            loading="lazy"
            onLoad={updateImageFrame}
          />
          {!isStackPreview && args.imageActions ? (
            <DesignImageControls
              design={args.design}
              frame={imageFrame}
              onEditDesignImage={args.imageActions.onEditDesignImage}
              onSetActiveRevision={args.imageActions.onSetActiveRevision}
            />
          ) : null}
        </div>
      </div>
      {!isStackPreview && args.imageActions ? (
        <div className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-3 flex justify-center">
          <DesignImageExpansionControls
            canExpand={Boolean(imageFrame)}
            disabled={isExtendingImage}
            isBusy={isExtendingImage}
            isVisible={isImageControlsVisible}
            onExtendImage={async (nextPagePrompt) => {
              setExtendingImage(true);
              try {
                await args.imageActions!.onExtendDesignImage({
                  direction: 'bottom',
                  nextPagePrompt,
                  sourceRevisionId: resolveDesignImage(args.design).revisionId,
                });
              } finally {
                setExtendingImage(false);
              }
            }}
            className="pointer-events-auto relative z-20"
          />
        </div>
      ) : null}
      {!isStackPreview ? (
        <div className="absolute left-0 right-0 top-full mt-3 flex flex-row items-center justify-between gap-3">
          <a
            aria-label={`Download image for ${args.title}`}
            className="rounded-full border border-black/12 bg-white px-5 py-3 text-center font-semibold text-black no-underline shadow-[0_16px_34px_rgba(0,0,0,0.08)]"
            download={resolveDesignDownloadFilename(args.design)}
            href={imageUrl}
          >
            Download image
          </a>
          <button
            type="button"
            aria-pressed={args.selected}
            aria-label={`Choose design for ${args.title}`}
            className="min-w-[164px] rounded-full bg-black px-5 py-3 text-center font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.18)]"
            onClick={args.onSelect}
          >
            Choose design
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CreatePendingVariationCanvasNodeLocal(args: {
  run: DesignRun;
  title: string;
}) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const progressSnapshot = buildCreatePendingProgressSnapshot({
    run: args.run,
    nowMs,
  });

  React.useEffect(() => {
    if (args.run.status !== 'queued' && args.run.status !== 'running') return undefined;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(interval);
  }, [args.run.status, args.run.id]);

  return (
    <div className="relative h-full" data-testid={`create-pending-variation-${args.title}`}>
      <div className="absolute -top-[44px] left-0 min-w-[260px]">
        <Text className="truncate text-[17px] font-semibold leading-[22px] text-black">{args.title}</Text>
      </div>
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-[0_18px_54px_rgba(24,20,16,0.10)]">
        <SketchDraftLoadingDots
          colorize={args.run.status === 'running'}
          className="h-full w-full rounded-[18px]"
        />
      </div>
      <div className="absolute left-0 right-0 top-full mt-4 flex flex-col gap-2">
        <SketchProgressBar value={progressSnapshot.progress} />
        <div className="flex items-center justify-between gap-4">
          <Text className="min-w-0 flex-1 truncate text-[12px] font-medium leading-5 text-black/52">
            {progressSnapshot.stageLabel}
          </Text>
          <Text className="shrink-0 text-[12px] font-medium leading-5 text-black/34">
            {progressSnapshot.etaLabel}
          </Text>
        </div>
      </div>
    </div>
  );
}

export function HandoffDockLocal(args: {
  workspace: CreateWorkspace | null;
  runs: RunMap;
  connection: ConnectionState;
  codexBridgeStatus: CodexBridgeStatus | null;
  appStatus: AppStatus | null;
  appStatusError: string | null;
  actions: ExportNodeActions;
  busyPageId: string | null;
  planner: {
    isPlanning: boolean;
    onShowPlanner: () => void;
  };
}) {
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [manualHandoffText, setManualHandoffText] = React.useState<string | null>(null);
  const [isHandingOff, setIsHandingOff] = React.useState(false);
  const [handoffFormat, setHandoffFormat] = React.useState<HandoffFormat>('image');
  const [isFormatMenuOpen, setFormatMenuOpen] = React.useState(false);
  const manualHandoffRef = React.useRef<HTMLTextAreaElement | null>(null);
  const pages = args.workspace?.pages ?? [];
  const seedRun = args.workspace?.seedRunId ? args.runs[args.workspace.seedRunId] : null;
  const selectedSeedDesign = args.workspace?.selectedSeedDesignId && seedRun
    ? seedRun.designs.find((design) => design.id === args.workspace?.selectedSeedDesignId) ?? null
    : null;
  const readySeed = pages.length === 0
    && Boolean(seedRun?.status === 'completed' && selectedSeedDesign && !args.workspace?.seedHandover);
  const convertedSeed = Boolean(args.workspace?.seedHandover);
  const readyPages = pages.filter((page) => {
    const run = page.runId ? args.runs[page.runId] : null;
    return run?.status === 'completed' && page.selectedVariationId && !page.handover;
  });
  const convertedPages = pages.filter((page) => Boolean(page.handover));
  const isCodexConnected = Boolean(args.codexBridgeStatus?.isWaiting);
  const codexStatusCopy = isCodexConnected ? 'Codex connected' : 'Codex idle';
  const isTwelveUiAuthenticated = Boolean(args.connection.connection?.auth?.configured);
  const isTwelveUiConnected = args.connection.connection?.status === 'ok' && isTwelveUiAuthenticated;
  const twelveUiStatusCopy = args.connection.isConnecting
    ? '12ui connecting'
    : isTwelveUiConnected
      ? `12ui connected${args.connection.connection?.auth?.organizationName ? `: ${args.connection.connection.auth.organizationName}` : ''}`
      : isTwelveUiAuthenticated
        ? '12ui unavailable'
        : '12ui not connected';
  const connectionError = args.connection.connection?.status === 'error'
    ? args.connection.connection.message
    : null;
  const appError = args.appStatusError
    ?? (args.appStatus?.status === 'error' ? args.appStatus.message : null);
  const errorMessage = connectionError ?? appError;
  const readyCount = (readySeed ? 1 : 0) + readyPages.length;
  const convertedCount = (convertedSeed ? 1 : 0) + convertedPages.length;
  const canHandOff = readySeed || readyPages.length > 0 || convertedSeed || convertedPages.length > 0;
  const canPlanPages = Boolean(args.workspace?.selectedSeedDesignId);
  const showAddPagesEntry = !args.workspace?.plannerVisible;

  React.useEffect(() => {
    if (!manualHandoffText) return;
    window.setTimeout(() => {
      manualHandoffRef.current?.focus();
      manualHandoffRef.current?.select();
    }, 0);
  }, [manualHandoffText]);

  const selectedImages = React.useMemo<TextHandoffImage[]>(() => {
    const images: TextHandoffImage[] = [];
    if (pages.length === 0 && selectedSeedDesign && seedRun) {
      images.push({
        label: 'Selected design',
        title: selectedSeedDesign.title,
        runId: seedRun.id,
        designId: selectedSeedDesign.id,
        imageUrl: absoluteRunAssetUrl(seedRun.id, resolveDesignAssetPath(selectedSeedDesign)),
        prompt: selectedSeedDesign.prompt,
      });
    }
    for (const page of pages) {
      if (!page.runId || !page.selectedVariationId) continue;
      const run = args.runs[page.runId];
      const design = run?.designs.find((entry) => entry.id === page.selectedVariationId);
      if (!run || !design) continue;
      images.push({
        label: page.title,
        title: design.title,
        runId: run.id,
        designId: design.id,
        imageUrl: absoluteRunAssetUrl(run.id, resolveDesignAssetPath(design)),
        prompt: design.prompt,
      });
    }
    return images;
  }, [args.runs, pages, seedRun, selectedSeedDesign]);

  const buildImageHandoffDocument = React.useCallback((): string => {
    const lines = [
      `Handoff${args.workspace ? ` for workspace ${args.workspace.id}` : ''}`,
      '',
      '12UI is not connected, so this handoff contains the selected design image references.',
      '',
      ...selectedImages.flatMap((image) => [
        `- ${image.label}: ${image.title}`,
        `  Image: ${image.imageUrl}`,
        `  Run ID: ${image.runId}`,
        `  Design ID: ${image.designId}`,
        `  Prompt: ${image.prompt}`,
      ]),
    ];
    return lines.join('\n').trim();
  }, [args.workspace, selectedImages]);

  const buildTwelveUiHandoffDocument = React.useCallback(async (
    handovers: HandoverResult[],
  ): Promise<string> => {
    if (handovers.length === 0) return buildImageHandoffDocument();
    const docs = await Promise.all(handovers.map(fetchHandoverMarkdown));
    return [
      `Handoff${args.workspace ? ` for workspace ${args.workspace.id}` : ''}`,
      '',
      ...docs.map((doc, index) => [
        handovers.length > 1 ? `## Handoff ${index + 1}` : '',
        ...handoverLinkLines(handovers[index]!),
        '',
        doc.trim(),
      ].filter(Boolean).join('\n\n')),
    ].join('\n\n').trim();
  }, [args.workspace, buildImageHandoffDocument]);

  const deliverHandoffText = React.useCallback(async (
    handoffText: string,
    images: TextHandoffImage[],
  ): Promise<void> => {
    if (isCodexConnected) {
      await args.actions.onSendTextHandoff(handoffText, images);
      setActionMessage(`Sent handoff to Codex.`);
      setManualHandoffText(null);
      return;
    }
    const result = await copyHandoffText(handoffText);
    if (result.status === 'copied') {
      setActionMessage('Handoff copied, paste into the Codex chat window.');
      setManualHandoffText(null);
      return;
    }
    setManualHandoffText(handoffText);
    setActionMessage(`${result.error} Press Command-C to copy the selected handoff text.`);
  }, [args.actions, isCodexConnected]);

  const retryManualCopy = React.useCallback(async () => {
    if (!manualHandoffText) return;
    const result = await copyHandoffText(manualHandoffText);
    if (result.status === 'copied') {
      setManualHandoffText(null);
      setActionMessage('Handoff copied, paste into the Codex chat window.');
      return;
    }
    manualHandoffRef.current?.focus();
    manualHandoffRef.current?.select();
    setActionMessage(`${result.error} Press Command-C to copy the selected handoff text.`);
  }, [manualHandoffText]);

  React.useEffect(() => {
    if (isTwelveUiConnected || convertedCount > 0) {
      setHandoffFormat('html');
    }
  }, [convertedCount, isTwelveUiConnected]);

  const handleImageHandoff = React.useCallback(async () => {
    await deliverHandoffText(buildImageHandoffDocument(), selectedImages);
  }, [buildImageHandoffDocument, deliverHandoffText, selectedImages]);

  const handleHtmlHandoff = React.useCallback(async () => {
    if (!isTwelveUiConnected) {
      args.actions.onConnect();
      setActionMessage('Connect 12ui to hand over HTML.');
      return;
    }

    const handovers: HandoverResult[] = [
      ...(args.workspace?.seedHandover ? [args.workspace.seedHandover] : []),
      ...convertedPages.flatMap((page) => (page.handover ? [page.handover] : [])),
    ];
    if (readySeed) {
      handovers.push((await args.actions.onCreateSeedHandover()).handover);
    }
    for (const page of readyPages) {
      handovers.push((await args.actions.onCreateHandover(page.id)).handover);
    }
    await deliverHandoffText(await buildTwelveUiHandoffDocument(handovers), selectedImages);
  }, [
    args.actions,
    args.workspace,
    buildTwelveUiHandoffDocument,
    convertedPages,
    deliverHandoffText,
    isTwelveUiConnected,
    readyPages,
    readySeed,
    selectedImages,
  ]);

  const handleHandoff = React.useCallback(async () => {
    if (!canHandOff || isHandingOff) return;
    setIsHandingOff(true);
    setActionMessage(null);
    setFormatMenuOpen(false);
    try {
      if (handoffFormat === 'html') await handleHtmlHandoff();
      else await handleImageHandoff();
    } catch (handoffError) {
      setActionMessage(handoffError instanceof Error ? handoffError.message : 'Handoff failed.');
    } finally {
      setIsHandingOff(false);
    }
  }, [
    canHandOff,
    handoffFormat,
    handleHtmlHandoff,
    handleImageHandoff,
    isHandingOff,
  ]);

  const imageHandoffLabel = selectedImages.length === 1 ? 'Handover image' : 'Handover images';
  const handoffLabel = isHandingOff
    ? handoffFormat === 'html'
      ? isTwelveUiConnected ? 'Handing over HTML' : 'Connecting'
      : 'Handing over images'
    : handoffFormat === 'html'
      ? 'Handover HTML'
      : imageHandoffLabel;
  const selectHandoffFormat = (format: HandoffFormat) => {
    setHandoffFormat(format);
    setFormatMenuOpen(false);
  };

  return (
    <div
      className="fixed bottom-4 left-3 right-3 z-[70] mx-auto max-w-[980px] rounded-[22px] bg-white/92 px-4 py-3 backdrop-blur-md sm:left-6 sm:right-6 sm:px-5"
      data-testid="handoff-dock"
      style={{
        boxShadow: 'rgba(17, 17, 17, 0.07) 0px 6px 18px',
        opacity: canHandOff ? 1 : 0.7,
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-black">
              <span className="h-2.5 w-2.5 rounded-full bg-[#246bfe]" aria-hidden="true" />
              {codexStatusCopy}
            </span>
            {convertedCount > 0 ? (
              <span className="rounded-full bg-[#eaf6ef] px-3 py-1 text-[12px] font-semibold text-[#218451]">
                {convertedCount} ready
              </span>
            ) : null}
            <span className={cn(
              'rounded-full px-3 py-1 text-[12px] font-semibold',
              isTwelveUiConnected ? 'bg-[#eaf6ef] text-[#218451]' : 'bg-black/[0.05] text-black/52',
            )}>
              {twelveUiStatusCopy}
            </span>
          </div>
          {errorMessage || actionMessage ? (
            <div className={cn('mt-1 truncate text-[12px] font-medium', errorMessage ? 'text-[#7b2727]' : 'text-black/42')}>
              {errorMessage ?? actionMessage}
            </div>
          ) : null}
        </div>
        {!isTwelveUiAuthenticated ? (
          <button
            type="button"
            className="shrink-0 rounded-full border border-black/10 bg-white px-5 py-3 text-[15px] font-semibold text-black shadow-[0_12px_26px_rgba(0,0,0,0.08)] outline-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-black/16"
            disabled={args.connection.isConnecting}
            onClick={args.actions.onConnect}
          >
            {args.connection.isConnecting ? 'Connecting' : 'Connect 12ui'}
          </button>
        ) : null}
        {showAddPagesEntry ? (
          <button
            type="button"
            className="shrink-0 rounded-full border border-black/10 bg-white px-5 py-3 text-[15px] font-semibold text-black shadow-[0_12px_26px_rgba(0,0,0,0.08)] outline-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-black/16"
            disabled={!canPlanPages || args.planner.isPlanning}
            onClick={args.planner.onShowPlanner}
          >
            {args.planner.isPlanning ? 'Planning' : 'Add pages'}
          </button>
        ) : null}
        <div
          className="relative shrink-0"
          onPointerEnter={() => setFormatMenuOpen(true)}
          onPointerLeave={() => setFormatMenuOpen(false)}
          onFocus={() => setFormatMenuOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setFormatMenuOpen(false);
            }
          }}
        >
          {isFormatMenuOpen ? (
            <div className="absolute bottom-full right-0 z-20 min-w-[190px] pb-2">
              <div className="overflow-hidden rounded-[12px] border border-black/10 bg-white py-1 shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
                <button
                  type="button"
                  className={cn(
                    'block w-full px-4 py-2 text-left text-[13px] font-semibold',
                    handoffFormat === 'image' ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/[0.04]',
                  )}
                  onClick={() => selectHandoffFormat('image')}
                >
                  Image
                </button>
                <button
                  type="button"
                  className={cn(
                    'block w-full px-4 py-2 text-left text-[13px] font-semibold',
                    handoffFormat === 'html' ? 'bg-black text-white' : 'bg-white text-black hover:bg-black/[0.04]',
                  )}
                  onClick={() => selectHandoffFormat('html')}
                >
                  HTML
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-black px-6 py-3 text-[15px] font-semibold text-white disabled:bg-black/18"
            disabled={!canHandOff || isHandingOff || Boolean(args.busyPageId)}
            onClick={handleHandoff}
          >
            <span>{handoffLabel}</span>
            <HandoffFormatChevron />
          </button>
        </div>
      </div>
      {manualHandoffText ? (
        <div className="mt-4 rounded-[18px] border border-black/12 bg-white p-3 shadow-[0_18px_44px_rgba(0,0,0,0.12)]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-black">
              Handoff text selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] font-semibold text-black"
                onClick={retryManualCopy}
              >
                Try Copy Again
              </button>
              <button
                type="button"
                className="rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] font-semibold text-black/62"
                onClick={() => setManualHandoffText(null)}
              >
                Close
              </button>
            </div>
          </div>
          <textarea
            ref={manualHandoffRef}
            aria-label="Selected handoff text"
            className="h-[180px] w-full resize-none rounded-[14px] border border-black/10 bg-[#fbfaf8] p-3 font-mono text-[12px] leading-5 text-black outline-none focus:border-black/32"
            readOnly
            value={manualHandoffText}
          />
        </div>
      ) : null}
    </div>
  );
}
