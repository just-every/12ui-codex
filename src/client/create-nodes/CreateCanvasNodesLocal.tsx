import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppStatus, CodexBridgeStatus, CreateWorkspace, CreateWorkspacePage, DesignOutput, DesignRun, HandoverResult } from '../../shared/types.js';
import { CreateCanvasShell, resolveCreateNodeStatusCopy } from '../create-ui/pages/create/CreateCanvasSharedNodes';
import { SketchDraftLoadingDots } from '../create-ui/pages/sketch-result/SketchDraftLoadingDots';
import { SketchProgressBar } from '../create-ui/pages/sketch-result/SketchProgressBar';
import { runAssetUrl } from '../api.js';
import { cn } from '../lib/cn.js';
import { PagePlanDockControl } from './PagePlanDockControl.js';
import type { ConnectionState, ExportNodeActions, RunMap } from './types.js';

const resolvePendingVariationStage = (run: DesignRun, latestEvent: DesignRun['events'][number] | null): string => {
  if (run.status === 'queued' || latestEvent?.type === 'queued') {
    return 'Queued';
  }
  if (latestEvent?.type === 'planning' || latestEvent?.type === 'planned') {
    return latestEvent.type === 'planned' ? 'Planning complete' : 'Planning concept';
  }
  if (latestEvent?.type === 'generating' || latestEvent?.type === 'generated') {
    return latestEvent.type === 'generated' ? 'Finalizing preview' : 'Rendering image';
  }
  if (latestEvent?.type === 'handover') {
    return 'Preparing handoff';
  }
  return run.status === 'running' ? 'Planning concept' : 'Queued';
};

const resolveDesignDownloadFilename = (design: DesignOutput): string => {
  const base = (design.title || `design-${design.branchIndex}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `design-${design.branchIndex}`;
  const extension = design.assetPath.match(/\.(png|jpe?g|webp)$/i)?.[0].toLowerCase() ?? '.png';
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

const absoluteRunAssetUrl = (runId: string, assetPath: string): string => (
  new URL(runAssetUrl(runId, assetPath), window.location.origin).toString()
);

const handoverMarkdownUrl = (handover: HandoverResult): string => (
  `/api/runs/${encodeURIComponent(handover.runId)}/handovers/${encodeURIComponent(handover.designId)}/handover.md`
);

const fetchHandoverMarkdown = async (handover: HandoverResult): Promise<string> => {
  const response = await fetch(handoverMarkdownUrl(handover));
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string' ? body.error : `Handoff document request failed with ${response.status}.`);
  }
  return response.text();
};

export function CreatePageCanvasNodeLocal(args: {
  index: number;
  page: CreateWorkspacePage;
  run: DesignRun | null;
  isCreating: boolean;
  onPromptChange: (prompt: string) => void;
  onTitleChange: (title: string) => void;
  onCreate: () => void;
  onFocusArea?: () => void;
}) {
  const hasRun = Boolean(args.page.runId);
  const canCreate = args.page.prompt.trim().length > 0 && !args.isCreating;
  const status = resolveCreateNodeStatusCopy(args.run?.status);
  return (
    <CreateCanvasShell eyebrow={`Page ${args.index + 1}`} title={args.page.title} titleClassName="text-[28px]" onFocusArea={args.onFocusArea}>
      <input
        aria-label={`${args.page.title} title`}
        className="mb-3 w-full rounded-[18px] border-0 bg-white px-5 py-3 text-[17px] font-semibold text-black outline-none placeholder:text-black/32"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)' }}
        value={args.page.title}
        onChange={(event) => args.onTitleChange(event.currentTarget.value)}
      />
      <div className="relative">
        <textarea
          aria-label={`${args.page.title} prompt`}
          className="min-h-[134px] w-full resize-none rounded-[24px] border-0 bg-white px-5 py-4 text-[16px] leading-6 text-black outline-none placeholder:text-black/32"
          style={{ boxShadow: '0 18px 54px rgba(24, 20, 16, 0.10), inset 0 0 0 1px rgba(0, 0, 0, 0.08)' }}
          value={args.page.prompt}
          onChange={(event) => args.onPromptChange(event.currentTarget.value)}
        />
      </div>
      <View className="mt-4 flex-row flex-wrap items-center gap-3">
        <View className="rounded-full border border-black/12 bg-white px-4 py-2">
          <Text className="text-sm font-semibold text-black/52">{status}</Text>
        </View>
        <View className="rounded-full border border-black/12 bg-white px-4 py-2">
          <Text className="text-sm font-semibold text-black/52">{args.page.variationCount} variations</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCreate }}
          className="ml-auto min-h-[50px] min-w-[154px] items-center justify-center rounded-full px-6 shadow-[0_16px_34px_rgba(0,0,0,0.14)]"
          style={{ backgroundColor: canCreate ? '#000000' : 'rgba(0, 0, 0, 0.18)' }}
          disabled={!canCreate}
          onPress={args.onCreate}
        >
          <Text className="text-[15px] font-semibold text-white">
            {args.isCreating ? 'Creating' : hasRun ? 'Create again' : 'Create variations'}
          </Text>
        </Pressable>
      </View>
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
}) {
  const imageUrl = runAssetUrl(args.run.id, args.design.assetPath);
  const presentation = args.presentation ?? 'default';
  const isStackPreview = presentation !== 'default';
  const isBackground = presentation === 'stack-background';
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
      <div className={cn('absolute -top-[50px] left-0 min-w-[220px]', isStackPreview ? 'hidden' : '')}>
        <Text className="truncate text-base font-semibold text-black">{args.title}</Text>
        {args.label ? (
          <Text className="mt-1 text-[11px] font-semibold uppercase tracking-[1.6px] text-black/42">{args.label}</Text>
        ) : null}
      </div>
      <div
        className={cn(
          'group relative h-full w-full overflow-hidden rounded-[18px] border bg-white shadow-[0_18px_54px_rgba(24,20,16,0.10)] transition-[opacity,transform,box-shadow] duration-200',
          args.selected ? 'border-black' : 'border-black/10',
          presentation === 'stack-front' ? 'shadow-[0_22px_70px_rgba(0,0,0,0.22)] hover:shadow-[0_28px_82px_rgba(0,0,0,0.24)]' : '',
          isBackground ? 'opacity-45 shadow-[0_12px_34px_rgba(24,20,16,0.08)]' : '',
        )}
        style={stackTransform ? { transform: stackTransform } : undefined}
      >
        <div className="h-full w-full overflow-hidden rounded-[18px] bg-[#fffdf9]">
          <img
            src={imageUrl}
            alt={args.design.title}
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
      </div>
      {!isStackPreview ? (
        <div className="absolute left-0 right-0 top-full mt-5 flex flex-row items-center justify-between gap-3">
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
  const latestEvent = [...args.run.events].reverse().find((event) => (
    event.type === 'generating'
    || event.type === 'generated'
    || event.type === 'planned'
    || event.type === 'planning'
    || event.type === 'queued'
  )) ?? null;
  const progress = Math.max(0.04, Math.min(0.98, args.run.progress || latestEvent?.progress || 0.04));
  const stage = resolvePendingVariationStage(args.run, latestEvent);

  return (
    <div className="relative h-full" data-testid={`create-pending-variation-${args.title}`}>
      <div className="absolute -top-[50px] left-0 min-w-[220px]">
        <Text className="truncate text-base font-semibold text-black">{args.title}</Text>
      </div>
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-[0_18px_54px_rgba(24,20,16,0.10)]">
        <SketchDraftLoadingDots
          colorize={args.run.status === 'running'}
          className="h-full w-full rounded-[18px]"
        />
      </div>
      <div className="absolute left-0 right-0 top-full mt-4 flex flex-col gap-2 px-1">
        <SketchProgressBar value={progress} />
        <div className="flex items-center justify-between gap-4">
          <Text className="min-w-0 flex-1 truncate text-[12px] font-medium leading-5 text-black/52">
            {stage}
          </Text>
          <Text className="shrink-0 text-[12px] font-medium leading-5 text-black/34">
            {Math.round(progress * 100)}%
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
    onPlanPages: (pagePrompt?: string) => void;
  };
}) {
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [isHandingOff, setIsHandingOff] = React.useState(false);
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
  const isTwelveUiConnected = args.connection.connection?.status === 'ok';
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
  const handoffAction = isCodexConnected ? 'send' : 'copy';

  const selectedImages = React.useMemo<TextHandoffImage[]>(() => {
    const images: TextHandoffImage[] = [];
    if (pages.length === 0 && selectedSeedDesign && seedRun) {
      images.push({
        label: 'Selected design',
        title: selectedSeedDesign.title,
        runId: seedRun.id,
        designId: selectedSeedDesign.id,
        imageUrl: absoluteRunAssetUrl(seedRun.id, selectedSeedDesign.assetPath),
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
        imageUrl: absoluteRunAssetUrl(run.id, design.assetPath),
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
      return;
    }
    await navigator.clipboard.writeText(handoffText);
    setActionMessage('Handoff copied, paste into the Codex chat window.');
  }, [args.actions, isCodexConnected]);

  const handleHandoff = React.useCallback(async () => {
    if (!canHandOff || isHandingOff) return;
    setIsHandingOff(true);
    setActionMessage(null);
    try {
      if (!isTwelveUiConnected) {
        await deliverHandoffText(buildImageHandoffDocument(), selectedImages);
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
    } catch (handoffError) {
      setActionMessage(handoffError instanceof Error ? handoffError.message : 'Handoff failed.');
    } finally {
      setIsHandingOff(false);
    }
  }, [
    args.actions,
    args.workspace,
    buildImageHandoffDocument,
    buildTwelveUiHandoffDocument,
    canHandOff,
    convertedPages,
    deliverHandoffText,
    isHandingOff,
    isTwelveUiConnected,
    readyPages,
    readySeed,
    selectedImages,
  ]);

  const handoffLabel = isHandingOff
    ? handoffAction === 'send' ? 'Sending' : 'Copying'
    : handoffAction === 'send' ? 'Send Handoff' : 'Copy Handoff';

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
          </div>
          {errorMessage || actionMessage ? (
            <div className={cn('mt-1 truncate text-[12px] font-medium', errorMessage ? 'text-[#7b2727]' : 'text-black/42')}>
              {errorMessage ?? actionMessage}
            </div>
          ) : null}
        </div>
        <PagePlanDockControl
          canPlan={canPlanPages}
          isPlanning={args.planner.isPlanning}
          onPlanPages={args.planner.onPlanPages}
        />
        <button
          type="button"
          className="shrink-0 rounded-full bg-black px-6 py-3 text-[15px] font-semibold text-white disabled:bg-black/18"
          disabled={!canHandOff || isHandingOff || Boolean(args.busyPageId)}
          onClick={handleHandoff}
        >
          {handoffLabel}
        </button>
      </div>
    </div>
  );
}
