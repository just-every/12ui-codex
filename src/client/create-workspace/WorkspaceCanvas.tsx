import React from 'react';
import type { CodexBridgeStatus, CreateWorkspace, DesignRun, AppStatus } from '../../shared/types.js';
import { CreateCameraStage } from '../create-ui/pages/create/CreateCameraStage';
import { CreateSeedNode } from '../create-ui/pages/create/CreateSeedNode';
import { fitCameraToRects } from '../create-ui/pages/sketch-canvas/sceneLayout';
import { SketchCanvasAttachmentNode } from '../create-ui/pages/sketch-canvas/SketchCanvasAttachmentNode';
import { SketchCanvasNode } from '../create-ui/pages/sketch-canvas/SketchCanvasNode';
import {
  CreatePendingVariationCanvasNodeLocal,
  CreatePageCanvasNodeLocal,
  CreateVariationCanvasNodeLocal,
  HandoffDockLocal,
} from '../create-nodes/CreateCanvasNodesLocal.js';
import { CreatePlannerNodeLocal } from '../create-nodes/CreatePlannerNodeLocal.js';
import type {
  ConnectionState,
  DesignImageActions,
  ExportNodeActions,
  GenerationDraft,
  PageNodeActions,
  PlannerNodeActions,
  RunMap,
  SeedNodeActions,
} from '../create-nodes/types.js';
import type { SketchComposerHandle } from '../create-ui/app/screens/design-create/SketchComposer';
import { formatAttachmentFileSize } from '../create-ui/pages/sketch-canvas/sketchAttachmentItems';
import {
  CREATE_PLANNER_NODE_ID,
  CREATE_SEED_VARIATION_GROUP_ID,
  CREATE_SEED_NODE_ID,
  buildCreateCanvasLayout,
  createPageNodeId,
  createSeedVariationNodeId,
  createSourceAttachmentNodeId,
  createVariationNodeId,
  resolveCreateSeedNodeWidth,
} from '../create-ui/pages/create/createCanvasLayout';
import {
  CREATE_CANVAS_SOURCE_FOCUS_ID,
  buildCreateCanvasFocusAreas,
  createPageVariationGroupFocusId,
} from '../create-ui/pages/create/createCanvasFocus';
import {
  SKETCH_COMPOSER_CANVAS_WIDTH,
  SKETCH_COMPOSER_DEFAULT_CANVAS_HEIGHT,
  SKETCH_COMPOSER_MIN_CANVAS_HEIGHT,
  normalizeSketchComposerCanvasHeight,
} from '../create-ui/app/screens/design-create/sketchComposerSizing';
import { SeedFilterControls } from './SeedFilterControls.js';
import { RunVersionMenu } from '../create-nodes/RunVersionMenu.js';
import { useWorkspaceCanvasFocus } from './useWorkspaceCanvasFocus.js';
import { useViewportSize } from './useViewportSize.js';
import { buildSeedVariationItems, type SeedVariationItem } from './seedVariationItems.js';

const SETTLED_CANVAS_INTRO_STARTED_AT_MS = -100_000;
const MOBILE_CANVAS_BREAKPOINT = 760;
const CREATE_SEED_PROMPT_BASE_HEIGHT = 170;
const CREATE_SEED_NODE_CHROME_HEIGHT = 164;
const DESIGN_IMAGE_SIZE_BY_ASPECT = {
  portrait: { width: 1024, height: 1536 },
  landscape: { width: 1536, height: 1024 },
} as const;

const imageSizeForRun = (run: DesignRun | null | undefined): { width: number; height: number } | null => (
  run ? DESIGN_IMAGE_SIZE_BY_ASPECT[run.aspect] : null
);

const hasSeedSketchContent = (args: {
  draftHasSketch: boolean;
  workspaceSketchDataUrl?: string | null;
}): boolean => (
  args.draftHasSketch || Boolean(args.workspaceSketchDataUrl)
);

const stripGenericDesignSuffix = (title: string, branchIndex: number): string => (
  title.replace(new RegExp(`\\s*Design\\s*${branchIndex}\\s*$`, 'i'), '').trim()
);

const resolveVariationTitle = (args: {
  title?: string | null;
  plannedTitle?: string | null;
  branchIndex: number;
}): string => {
  const generatedTitle = stripGenericDesignSuffix(args.title?.trim() ?? '', args.branchIndex);
  if (generatedTitle) return generatedTitle;
  const plannedTitle = stripGenericDesignSuffix(args.plannedTitle?.trim() ?? '', args.branchIndex);
  return plannedTitle || `Design ${args.branchIndex}`;
};

export function WorkspaceCanvas({
  sketchRef,
  workspace,
  runs,
  draft,
  seedActions,
  plannerActions,
  pageActions,
  imageActions,
  exportActions,
  connection,
  codexBridgeStatus,
  appStatus,
  appStatusError,
  selectedSeedDesignId,
  onSelectSeedDesign,
  onSelectPageVariation,
  error,
  isPlanning,
  busyHandoverPageId,
  onInkChange,
}: {
  sketchRef: React.RefObject<SketchComposerHandle | null>;
  workspace: CreateWorkspace | null;
  runs: RunMap;
  draft: GenerationDraft;
  seedActions: SeedNodeActions;
  plannerActions: PlannerNodeActions;
  pageActions: PageNodeActions;
  imageActions: DesignImageActions;
  exportActions: ExportNodeActions;
  connection: ConnectionState;
  codexBridgeStatus: CodexBridgeStatus | null;
  appStatus: AppStatus | null;
  appStatusError: string | null;
  selectedSeedDesignId: string | null;
  onSelectSeedDesign: (designId: string) => void;
  onSelectPageVariation: (pageId: string, designId: string) => void;
  error: string | null;
  isPlanning: boolean;
  busyHandoverPageId: string | null;
  onInkChange: (hasInk: boolean) => void;
}) {
  const viewport = useViewportSize();
  const [isSeedPromptFocused, setSeedPromptFocused] = React.useState(false);
  const [isSeedSketchInputOpen, setSeedSketchInputOpen] = React.useState(false);
  const [isSeedVariationSetExpanded, setSeedVariationSetExpanded] = React.useState(false);
  const [isSeedVariationSetHovered, setSeedVariationSetHovered] = React.useState(false);
  const [seedComposerCanvasHeight, setSeedComposerCanvasHeight] = React.useState(SKETCH_COMPOSER_DEFAULT_CANVAS_HEIGHT);
  const [hasCustomSeedComposerCanvasHeight, setHasCustomSeedComposerCanvasHeight] = React.useState(false);
  const [shouldFocusFirstPageAfterPlan, setShouldFocusFirstPageAfterPlan] = React.useState(false);
  const seedRun = workspace?.seedRunId ? runs[workspace.seedRunId] ?? null : null;
  const isSeedRunActive = seedRun?.status === 'queued' || seedRun?.status === 'running';
  React.useEffect(() => {
    if (workspace?.sketchDataUrl || draft.hasSketch) {
      setSeedSketchInputOpen(true);
    }
  }, [draft.hasSketch, workspace?.sketchDataUrl]);
  const seedVariationItems = React.useMemo<SeedVariationItem[]>(() => {
    if (!seedRun) return [];
    return buildSeedVariationItems({
      draftSeedVariationCount: draft.seedVariationCount,
      isSeedRunActive,
      seedRun,
      workspaceSeedVariationCount: workspace?.seedVariationCount,
    });
  }, [draft.seedVariationCount, isSeedRunActive, seedRun, workspace?.seedVariationCount]);
  const seedVariations = React.useMemo(() => (
    seedVariationItems.map((item) => ({ id: item.id, imageSize: imageSizeForRun(seedRun) }))
  ), [seedRun, seedVariationItems]);
  const pages = workspace?.pages ?? [];
  const showPlanner = Boolean(workspace?.plannerVisible);
  const isMobileCanvas = viewport.width < MOBILE_CANVAS_BREAKPOINT;
  const seedNodeWidth = resolveCreateSeedNodeWidth(viewport.width);
  const useSeedTextFirstLayout = isMobileCanvas
    && (isSeedPromptFocused || draft.prompt.trim().length > 0)
    && !draft.hasSketch
    && !hasCustomSeedComposerCanvasHeight;
  const effectiveSeedComposerCanvasHeight = useSeedTextFirstLayout
    ? SKETCH_COMPOSER_MIN_CANVAS_HEIGHT
    : seedComposerCanvasHeight;
  const defaultSeedComposerDisplayHeight = Math.round(
    seedNodeWidth * (SKETCH_COMPOSER_DEFAULT_CANVAS_HEIGHT / SKETCH_COMPOSER_CANVAS_WIDTH),
  );
  const openSeedComposerDisplayHeight = Math.round(
    seedNodeWidth * (effectiveSeedComposerCanvasHeight / SKETCH_COMPOSER_CANVAS_WIDTH),
  );
  const seedComposerDisplayHeight = isSeedSketchInputOpen ? openSeedComposerDisplayHeight : 0;
  const seedPromptHeight = CREATE_SEED_PROMPT_BASE_HEIGHT + (isSeedSketchInputOpen && useSeedTextFirstLayout
    ? Math.max(0, defaultSeedComposerDisplayHeight - openSeedComposerDisplayHeight)
    : 0);
  const seedNodeHeight = Math.ceil(seedComposerDisplayHeight + seedPromptHeight + CREATE_SEED_NODE_CHROME_HEIGHT);
  const seedVariationConnectorStartY = 68 + seedComposerDisplayHeight;
  const handleSeedCanvasHeightChange = React.useCallback((height: number) => {
    setSeedComposerCanvasHeight(normalizeSketchComposerCanvasHeight(height));
    setHasCustomSeedComposerCanvasHeight(true);
  }, []);
  const closeEmptySeedSketchInput = React.useCallback(() => {
    if (!hasSeedSketchContent({
      draftHasSketch: draft.hasSketch,
      workspaceSketchDataUrl: workspace?.sketchDataUrl,
    })) {
      setSeedSketchInputOpen(false);
    }
  }, [draft.hasSketch, workspace?.sketchDataUrl]);
  const handleSeedPromptFocusChange = React.useCallback((isFocused: boolean) => {
    setSeedPromptFocused(isFocused);
    if (isFocused) {
      closeEmptySeedSketchInput();
    }
  }, [closeEmptySeedSketchInput]);
  const handleSeedSketchClear = React.useCallback(() => {
    onInkChange(false);
    setSeedSketchInputOpen(false);
  }, [onInkChange]);
  const controlsDisabled = isSeedRunActive;
  const isSeedVariationSetCollapsed = Boolean(selectedSeedDesignId && !isSeedVariationSetExpanded);

  React.useEffect(() => {
    if (!selectedSeedDesignId) {
      setSeedVariationSetExpanded(false);
      setSeedVariationSetHovered(false);
    }
  }, [selectedSeedDesignId]);

  const sourceCount = workspace?.referenceDataUrls.length ?? draft.referenceCount;
  const layoutPages = React.useMemo(() => pages.map((page) => {
    const run = page.runId ? runs[page.runId] : null;
    return {
      id: page.id,
      selectedVariationId: page.selectedVariationId,
      variationsCollapsed: false,
      variations: run?.designs.map((design) => ({ id: design.id, imageSize: imageSizeForRun(run) })) ?? [],
    };
  }), [pages, runs]);

  const layout = React.useMemo(() => buildCreateCanvasLayout({
    seedNodeHeight,
    seedNodeWidth,
    seedVariationConnectorStartY,
    pages: layoutPages,
    seedVariations,
    selectedSeedVariationId: selectedSeedDesignId,
    seedVariationSetCollapsed: isSeedVariationSetCollapsed,
    showPlanner,
    sourceCount,
    showExport: false,
  }), [isSeedVariationSetCollapsed, layoutPages, seedNodeHeight, seedNodeWidth, seedVariationConnectorStartY, seedVariations, selectedSeedDesignId, showPlanner, sourceCount]);
  const focusAreas = React.useMemo(() => buildCreateCanvasFocusAreas({
    pages: layoutPages,
    seedVariations,
    seedVariationSetCollapsed: isSeedVariationSetCollapsed,
    rects: layout.rects,
    sourceCount,
    shouldShowPlanner: showPlanner,
    shouldShowExport: false,
  }), [isSeedVariationSetCollapsed, layout.rects, layoutPages, seedVariations, showPlanner, sourceCount]);
  const defaultFocusAreaId = seedVariationItems.some((item) => item.design)
    ? CREATE_SEED_VARIATION_GROUP_ID
    : CREATE_SEED_NODE_ID;
  const {
    cameraSettings: focusedAreaCameraSettings,
    focusedAreaSnapshot,
    handleCanvasAreaClick,
    handleFocusStep,
    requestFocusArea,
  } = useWorkspaceCanvasFocus({
    defaultFocusAreaId,
    focusAreas,
    isMobileCanvas,
  });

  const handleSeedCreate = React.useCallback(() => {
    requestFocusArea(CREATE_SEED_VARIATION_GROUP_ID);
    closeEmptySeedSketchInput();
    seedActions.onCreateSeed();
  }, [closeEmptySeedSketchInput, requestFocusArea, seedActions]);

  React.useEffect(() => {
    if (!shouldFocusFirstPageAfterPlan) return;
    const firstPage = pages[0];
    if (firstPage) {
      requestFocusArea(createPageNodeId(firstPage.id));
    } else {
      requestFocusArea(CREATE_PLANNER_NODE_ID);
    }
    setShouldFocusFirstPageAfterPlan(false);
  }, [pages, requestFocusArea, shouldFocusFirstPageAfterPlan]);

  const targetRects = React.useMemo(() => {
    const seedRect = layout.rects[CREATE_SEED_NODE_ID];
    const selectedSeedRect = selectedSeedDesignId ? layout.rects[createSeedVariationNodeId(selectedSeedDesignId)] : null;
    const firstSeedVariationRect = seedVariationItems.length > 0
      ? layout.rects[createSeedVariationNodeId(seedVariationItems[0]!.id)]
      : null;
    if (isSeedRunActive && firstSeedVariationRect) {
      return [seedRect, firstSeedVariationRect].filter((rect): rect is NonNullable<typeof rect> => Boolean(rect));
    }
    if (isMobileCanvas) {
      return [selectedSeedRect, seedRect].filter((rect): rect is NonNullable<typeof rect> => Boolean(rect)).slice(0, 1);
    }
    return [
      seedRect,
      selectedSeedRect,
      isSeedRunActive ? firstSeedVariationRect : null,
      showPlanner ? layout.rects[CREATE_PLANNER_NODE_ID] : null,
      pages.length > 0 ? layout.rects[createPageNodeId(pages[0]!.id)] : null,
    ].filter((rect): rect is NonNullable<typeof rect> => Boolean(rect));
  }, [isMobileCanvas, isSeedRunActive, layout.rects, pages, seedVariationItems, selectedSeedDesignId, showPlanner]);
  const overviewRects = React.useMemo(() => Object.values(layout.rects), [layout.rects]);

  const focusRect = focusedAreaSnapshot?.rect ?? null;
  const fallbackCameraRects = focusRect ? null : targetRects;
  const targetCamera = React.useMemo(() => fitCameraToRects({
    rects: focusRect ? [focusRect] : (fallbackCameraRects?.length ? fallbackCameraRects : overviewRects.slice(0, 1)),
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    padding: focusedAreaCameraSettings.padding,
    minZoom: focusedAreaCameraSettings.minZoom,
    maxZoom: focusedAreaCameraSettings.maxZoom,
    expandMinZoomToFit: true,
  }), [
    fallbackCameraRects,
    focusRect?.height,
    focusRect?.width,
    focusRect?.x,
    focusRect?.y,
    focusedAreaCameraSettings,
    overviewRects,
    viewport.height,
    viewport.width,
  ]);
  const overviewCamera = React.useMemo(() => fitCameraToRects({
    rects: overviewRects,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    padding: isMobileCanvas ? 20 : 82,
    minZoom: isMobileCanvas ? 0.2 : 0.24,
    maxZoom: isSeedRunActive ? 0.82 : isMobileCanvas ? 1.2 : 0.9,
    expandMinZoomToFit: true,
  }), [isMobileCanvas, isSeedRunActive, overviewRects, viewport.height, viewport.width]);

  const sourceDataUrls = workspace?.referenceDataUrls ?? Array.from({ length: draft.referenceCount }, () => '');

  return (
    <>
      <CreateCameraStage
        targetCamera={targetCamera}
        minZoom={Math.min(0.24, targetCamera.zoom, overviewCamera.zoom)}
        maxZoom={2.6}
        worldWidth={layout.worldWidth}
        worldHeight={layout.worldHeight}
        connectors={layout.connectors}
        connectorJunctions={layout.junctions}
        introStartedAt={SETTLED_CANVAS_INTRO_STARTED_AT_MS}
        onHorizontalNavigate={handleFocusStep}
        onCanvasClick={handleCanvasAreaClick}
      >
      {layout.rects[CREATE_SEED_NODE_ID] ? (
        <SketchCanvasNode
          rect={layout.rects[CREATE_SEED_NODE_ID]}
          focusAreaId={CREATE_SEED_NODE_ID}
          animationDelayMs={0}
          interactiveOnEnter
        >
          <CreateSeedNode
            prompt={draft.prompt}
            attachmentCount={workspace?.referenceDataUrls.length ?? draft.referenceCount}
            uploadError={null}
            runError={error}
            isUploading={false}
            isCreating={Boolean(seedRun && (seedRun.status === 'queued' || seedRun.status === 'running'))}
            title="Codex Design"
            canCreate={draft.prompt.trim().length > 0 || draft.hasSketch}
            createLabel={isSeedRunActive ? 'Create new version' : seedRun ? 'Create again' : 'Create designs'}
            headerControls={(
              <SeedFilterControls
                designCount={draft.seedVariationCount}
                aspect={draft.aspect}
                quality={draft.quality}
                creativityMode={draft.creativityMode}
                disabled={controlsDisabled}
                onDesignCountChange={seedActions.setSeedVariationCount}
                onAspectChange={seedActions.setAspect}
                onQualityChange={seedActions.setQuality}
                onCreativityModeChange={seedActions.setCreativityMode}
              />
            )}
            runVersionControls={workspace ? (
              <RunVersionMenu
                label="Design version"
                runIds={workspace.seedRunIds}
                activeRunId={workspace.seedRunId}
                onChange={seedActions.onSwitchSeedRun}
              />
            ) : null}
            hasSketchContent={draft.hasSketch}
            isSketchInputOpen={isSeedSketchInputOpen}
            initialImageUrl={workspace?.sketchDataUrl ?? null}
            canvasHeight={effectiveSeedComposerCanvasHeight}
            displayHeightPx={seedComposerDisplayHeight}
            promptHeight={seedPromptHeight}
            sketchComposerRef={sketchRef}
            onSketchInputOpenChange={setSeedSketchInputOpen}
            onPromptChange={seedActions.setPrompt}
            onPromptFocusChange={handleSeedPromptFocusChange}
            onCanvasHeightChange={handleSeedCanvasHeightChange}
            onSketchClear={handleSeedSketchClear}
            onSketchInkChange={onInkChange}
            onSeedFilesSelected={(files) => {
              requestFocusArea(CREATE_CANVAS_SOURCE_FOCUS_ID);
              const list = new DataTransfer();
              files.forEach((file) => list.items.add(file));
              seedActions.onReferenceFiles(list.files);
            }}
            onCreate={handleSeedCreate}
          />
        </SketchCanvasNode>
      ) : null}

      {sourceDataUrls.map((dataUrl, index) => {
        const rect = layout.rects[createSourceAttachmentNodeId(index)];
        if (!rect || !dataUrl) return null;
        return (
          <SketchCanvasAttachmentNode
            key={`source-${index}`}
            rect={rect}
            focusAreaId={CREATE_CANVAS_SOURCE_FOCUS_ID}
            attachment={{
              id: `reference-${index + 1}`,
              name: `Reference ${index + 1}`,
              detail: formatAttachmentFileSize(undefined),
              status: 'ready',
              sourceAsset: {
                storageKey: `reference-${index + 1}`,
                filename: `Reference ${index + 1}`,
                url: dataUrl,
              },
            }}
            onRemove={() => seedActions.onClearReferences()}
          />
        );
      })}

      {seedRun && seedVariationItems.map((item) => {
        const rect = layout.rects[createSeedVariationNodeId(item.id)];
        if (!rect) return null;
        const isSelected = selectedSeedDesignId === item.design?.id;
        const presentation = isSeedVariationSetCollapsed
          ? isSelected ? 'stack-front' : 'stack-background'
          : 'default';
        if (!item.design) {
          return (
            <SketchCanvasNode
              key={item.id}
              rect={rect}
              focusAreaId={isSeedVariationSetCollapsed ? CREATE_SEED_VARIATION_GROUP_ID : createSeedVariationNodeId(item.id)}
              animationDelayMs={160 + (item.index * 50)}
              interactiveOnEnter
            >
              <CreatePendingVariationCanvasNodeLocal
                run={seedRun}
                title={item.plannedTitle || `Design ${item.index + 1}`}
              />
            </SketchCanvasNode>
          );
        }
        const openSeedVariationSet = () => {
          requestFocusArea(CREATE_SEED_VARIATION_GROUP_ID);
          setSeedVariationSetExpanded(true);
          setSeedVariationSetHovered(false);
        };
        return (
          <SketchCanvasNode
            key={item.id}
            rect={rect}
            focusAreaId={isSeedVariationSetCollapsed ? CREATE_SEED_VARIATION_GROUP_ID : createSeedVariationNodeId(item.id)}
            animationDelayMs={isSeedVariationSetCollapsed ? 0 : 240 + (item.index * 60)}
            interactiveOnEnter={isSeedVariationSetCollapsed}
            className={isSeedVariationSetCollapsed ? (isSelected ? 'z-[34]' : 'z-[22]') : undefined}
            onPointerEnter={() => {
              if (isSeedVariationSetCollapsed) {
                setSeedVariationSetHovered(true);
              }
            }}
            onPointerLeave={() => {
              if (isSeedVariationSetCollapsed) {
                setSeedVariationSetHovered(false);
              }
            }}
            onSurfacePress={() => {
              if (isSeedVariationSetCollapsed) {
                openSeedVariationSet();
              }
            }}
          >
            <CreateVariationCanvasNodeLocal
              title={resolveVariationTitle({
                title: item.design.title,
                plannedTitle: item.plannedTitle,
                branchIndex: item.design.branchIndex,
              })}
              run={seedRun}
              design={item.design}
              selected={isSelected}
              presentation={presentation}
              stackHovered={isSeedVariationSetHovered}
              stackIndex={item.index}
              onPreviewClick={isSeedVariationSetCollapsed ? openSeedVariationSet : undefined}
              onSelect={() => {
                if (isSelected && isSeedVariationSetCollapsed) {
                  openSeedVariationSet();
                  return;
                }
                requestFocusArea(CREATE_SEED_VARIATION_GROUP_ID);
                setSeedVariationSetExpanded(false);
                setSeedVariationSetHovered(false);
                onSelectSeedDesign(item.design!.id);
              }}
              imageActions={{
                onEditDesignImage: async (request) => {
                  await imageActions.onEditDesignImage(seedRun.id, item.design!.id, request);
                  requestFocusArea(createSeedVariationNodeId(item.design!.id));
                },
                onExtendDesignImage: async (request) => {
                  await imageActions.onExtendDesignImage(seedRun.id, item.design!.id, request);
                  setSeedVariationSetExpanded(true);
                  setSeedVariationSetHovered(false);
                  requestFocusArea(createSeedVariationNodeId(item.design!.id));
                },
                onSetActiveRevision: async (activeRevisionId) => {
                  await imageActions.onSetActiveRevision(seedRun.id, item.design!.id, activeRevisionId);
                  requestFocusArea(createSeedVariationNodeId(item.design!.id));
                },
              }}
            />
          </SketchCanvasNode>
        );
      })}

      {showPlanner && layout.rects[CREATE_PLANNER_NODE_ID] ? (
        <SketchCanvasNode
          rect={layout.rects[CREATE_PLANNER_NODE_ID]}
          focusAreaId={CREATE_PLANNER_NODE_ID}
          animationDelayMs={180}
          interactiveOnEnter
        >
          <CreatePlannerNodeLocal
            prompt={workspace?.plannerPrompt ?? ''}
            canPlan={Boolean(workspace?.selectedSeedDesignId)}
            isPlanning={isPlanning}
            error={error}
            onPromptChange={plannerActions.onUpdatePlannerPrompt}
            onGeneratePlan={() => {
              setShouldFocusFirstPageAfterPlan(true);
              plannerActions.onPlanPages(workspace?.plannerPrompt ?? '');
            }}
            onFocusArea={() => requestFocusArea(CREATE_PLANNER_NODE_ID)}
          />
        </SketchCanvasNode>
      ) : null}

      {pages.map((page) => {
        const rect = layout.rects[createPageNodeId(page.id)];
        if (!rect) return null;
        const run = page.runId ? runs[page.runId] ?? null : null;
        return (
          <SketchCanvasNode key={page.id} rect={rect} focusAreaId={createPageNodeId(page.id)} animationDelayMs={180 + (page.order * 80)}>
            <CreatePageCanvasNodeLocal
              page={page}
              isCreating={run?.status === 'queued' || run?.status === 'running'}
              onPromptChange={(prompt) => pageActions.onUpdatePage(page.id, { prompt })}
              onCreate={() => {
                requestFocusArea(createPageVariationGroupFocusId(page.id));
                pageActions.onCreatePageRun(page.id);
              }}
              onSwitchRun={(runId) => pageActions.onSwitchPageRun(page.id, runId)}
            />
          </SketchCanvasNode>
        );
      })}

      {pages.flatMap((page) => {
        const run = page.runId ? runs[page.runId] : null;
        if (!run) return [];
        return run.designs.flatMap((design, index) => {
          const rect = layout.rects[createVariationNodeId(page.id, design.id)];
          if (!rect) return [];
          return (
            <SketchCanvasNode key={`${page.id}-${design.id}`} rect={rect} focusAreaId={createVariationNodeId(page.id, design.id)} animationDelayMs={240 + (index * 60)}>
              <CreateVariationCanvasNodeLocal
                title={resolveVariationTitle({
                  title: design.title || page.title,
                  branchIndex: design.branchIndex,
                })}
                run={run}
                design={design}
                selected={page.selectedVariationId === design.id}
                label={design.title ? undefined : `Design ${index + 1}`}
                onSelect={() => {
                  requestFocusArea(createPageVariationGroupFocusId(page.id));
                  onSelectPageVariation(page.id, design.id);
                }}
                imageActions={{
                  onEditDesignImage: async (request) => {
                    await imageActions.onEditDesignImage(run.id, design.id, request);
                    requestFocusArea(createVariationNodeId(page.id, design.id));
                  },
                  onExtendDesignImage: async (request) => {
                    await imageActions.onExtendDesignImage(run.id, design.id, request);
                    requestFocusArea(createVariationNodeId(page.id, design.id));
                  },
                  onSetActiveRevision: async (activeRevisionId) => {
                    await imageActions.onSetActiveRevision(run.id, design.id, activeRevisionId);
                    requestFocusArea(createVariationNodeId(page.id, design.id));
                  },
                }}
              />
            </SketchCanvasNode>
          );
        });
      })}

      </CreateCameraStage>
      <HandoffDockLocal
        workspace={workspace}
        runs={runs}
        connection={connection}
        codexBridgeStatus={codexBridgeStatus}
        appStatus={appStatus}
        appStatusError={appStatusError}
        actions={exportActions}
        busyPageId={busyHandoverPageId}
        planner={{
          isPlanning,
          onShowPlanner: () => {
            plannerActions.onShowPlanner();
            requestFocusArea(CREATE_PLANNER_NODE_ID);
          },
        }}
      />
    </>
  );
}
