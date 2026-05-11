import React from 'react';
import type {
  CodexBridgeStatus,
  CreateWorkspace,
  AppStatus,
  DesignAspect,
  DesignCreativityMode,
  DesignQuality,
  DesignRun,
  CreateWorkspaceSeedRunRequest,
  DirectDesignCount,
  LocalUiConnection,
} from '../shared/types.js';
import {
  createPageHandover,
  createDesignImageEdit,
  createDesignImageExtension,
  createSeedHandover,
  createPageRun,
  createSeedRun,
  createWorkspace,
  getAppStatus,
  getCodexBridgeStatus,
  getConnection,
  getRun,
  getWorkspace,
  planWorkspacePages,
  sendTextHandoff,
  startTwelveUiConnect,
  updateDesignActiveRevision,
  updateActivePageRun,
  updateActiveSeedRun,
  updateConnection,
  updateWorkspacePlanner,
  updateSeedSelection,
  updateWorkspacePage,
} from './api.js';
import { WorkspaceCanvas } from './create-workspace/WorkspaceCanvas.js';
import type { RunMap } from './create-nodes/types.js';
import type { SketchComposerHandle } from './create-ui/app/screens/design-create/SketchComposer';
import { useReconnectingEventSource, useReconnectingEventSources } from './useReconnectingEventSource.js';

const isActiveRun = (run: DesignRun | undefined): boolean => (
  Boolean(run && run.status !== 'completed' && run.status !== 'failed')
);

const runIdsForWorkspace = (workspace: CreateWorkspace | null): string[] => {
  if (!workspace) return [];
  return Array.from(new Set([
    workspace.seedRunId,
    ...(workspace.seedRunIds ?? []),
    ...workspace.pages.flatMap((page) => [
      page.runId,
      ...(page.runIds ?? []),
    ]),
  ].filter((runId): runId is string => Boolean(runId))));
};

const workspaceIdFromLocation = (): string | null => {
  if (typeof window === 'undefined') return null;
  const pathMatch = /^\/workspaces\/([^/?#]+)/.exec(window.location.pathname);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const queryWorkspaceId = new URLSearchParams(window.location.search).get('workspace');
  return queryWorkspaceId?.trim() || null;
};

const updateWorkspaceUrl = (workspaceId: string): void => {
  if (typeof window === 'undefined') return;
  const nextPath = `/workspaces/${encodeURIComponent(workspaceId)}`;
  if (window.location.pathname === nextPath) return;
  window.history.replaceState(null, '', nextPath);
};

const fileToDataUrl = async (file: File | null): Promise<string | null> => {
  if (!file) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
};

const blurActiveElement = (): void => {
  if (typeof document === 'undefined') return;
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

export const App = () => {
  const sketchRef = React.useRef<SketchComposerHandle | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [seedVariationCount, setSeedVariationCount] = React.useState<DirectDesignCount>(3);
  const [aspect, setAspect] = React.useState<DesignAspect>('portrait');
  const [quality, setQuality] = React.useState<DesignQuality>('medium');
  const [creativityMode, setCreativityMode] = React.useState<DesignCreativityMode>('standard');
  const [hasSketch, setHasSketch] = React.useState(false);
  const [referenceDataUrls, setReferenceDataUrls] = React.useState<string[]>([]);
  const [workspace, setWorkspace] = React.useState<CreateWorkspace | null>(null);
  const [runs, setRuns] = React.useState<RunMap>({});
  const [error, setError] = React.useState<string | null>(null);
  const [isPlanning, setPlanning] = React.useState(false);
  const [busyHandoverPageId, setBusyHandoverPageId] = React.useState<string | null>(null);
  const [connection, setConnection] = React.useState<LocalUiConnection | null>(null);
  const [connectionOrigin, setConnectionOrigin] = React.useState('http://127.0.0.1:9918');
  const [isConnecting, setConnecting] = React.useState(false);
  const [codexBridgeStatus, setCodexBridgeStatus] = React.useState<CodexBridgeStatus | null>(null);
  const [appStatus, setAppStatus] = React.useState<AppStatus | null>(null);
  const [appStatusError, setAppStatusError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getAppStatus()
      .then((status) => {
        if (cancelled) return;
        setAppStatus(status);
        setAppStatusError(null);
      })
      .catch((statusError) => {
        if (cancelled) return;
        setAppStatus(null);
        setAppStatusError(statusError instanceof Error ? statusError.message : 'Node server status check failed.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void getConnection().then((nextConnection) => {
      if (cancelled) return;
      setConnection(nextConnection);
      setConnectionOrigin(nextConnection.origin);
      if (nextConnection.auth?.source === 'local') {
        setConnecting(true);
        void updateConnection(nextConnection.origin)
          .then((checkedConnection) => {
            if (cancelled) return;
            setConnection(checkedConnection);
            setConnectionOrigin(checkedConnection.origin);
          })
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setConnecting(false);
          });
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const workspaceId = workspaceIdFromLocation();
    if (!workspaceId) return;
    let cancelled = false;
    void getWorkspace(workspaceId)
      .then((loadedWorkspace) => {
        if (cancelled) return;
        setWorkspace(loadedWorkspace);
        setPrompt(loadedWorkspace.prompt);
        setSeedVariationCount(loadedWorkspace.seedVariationCount);
        setAspect(loadedWorkspace.aspect);
        setQuality(loadedWorkspace.quality);
        setCreativityMode(loadedWorkspace.creativityMode);
        setReferenceDataUrls(loadedWorkspace.referenceDataUrls);
        setHasSketch(Boolean(loadedWorkspace.sketchDataUrl));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load workspace.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useReconnectingEventSource<CreateWorkspace>({
    url: workspace ? `/api/workspaces/${encodeURIComponent(workspace.id)}/events` : null,
    eventName: 'workspace',
    onMessage: setWorkspace,
  });

  React.useEffect(() => {
    if (!workspace) {
      setCodexBridgeStatus(null);
      return undefined;
    }
    let cancelled = false;
    void getCodexBridgeStatus(workspace.id).then((status) => {
      if (!cancelled) setCodexBridgeStatus(status);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  useReconnectingEventSource<CodexBridgeStatus>({
    url: workspace ? `/api/codex/workspaces/${encodeURIComponent(workspace.id)}/status/events` : null,
    eventName: 'codex_bridge_status',
    onMessage: setCodexBridgeStatus,
  });

  const runIds = React.useMemo(() => runIdsForWorkspace(workspace), [workspace]);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all(runIds.filter((runId) => !runs[runId]).map(async (runId) => getRun(runId)))
      .then((loadedRuns) => {
        if (cancelled || loadedRuns.length === 0) return;
        setRuns((current) => {
          const next = { ...current };
          for (const run of loadedRuns) next[run.id] = run;
          return next;
        });
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load run.'));
    return () => {
      cancelled = true;
    };
  }, [runIds.join('|'), runs]);

  const activeRunIds = React.useMemo(
    () => runIds.filter((runId) => isActiveRun(runs[runId])),
    [runIds.join('|'), runs],
  );
  const activeRunEventUrls = React.useMemo(
    () => activeRunIds.map((runId) => `/api/runs/${encodeURIComponent(runId)}/events`),
    [activeRunIds.join('|')],
  );

  useReconnectingEventSources<DesignRun>({
    urls: activeRunEventUrls,
    eventName: 'run',
    onMessage: (nextRun) => {
      setRuns((current) => ({ ...current, [nextRun.id]: nextRun }));
      if ((nextRun.status === 'completed' || nextRun.status === 'failed') && workspace) {
        void getWorkspace(workspace.id).then(setWorkspace).catch(() => undefined);
      }
    },
  });

  const readSeedInput = async (): Promise<CreateWorkspaceSeedRunRequest> => {
    const sketchFile = await (sketchRef.current?.exportFile() ?? Promise.resolve(null));
    const sketchDataUrl = await fileToDataUrl(sketchFile);
    return {
      prompt,
      sketchDataUrl,
      referenceDataUrls,
      seedVariationCount,
      aspect,
      quality,
      creativityMode,
    };
  };

  const createWorkspaceIfNeeded = async (
    seedInput: CreateWorkspaceSeedRunRequest,
  ): Promise<CreateWorkspace> => {
    if (workspace) return workspace;
    const nextWorkspace = await createWorkspace({
      ...seedInput,
    });
    setWorkspace(nextWorkspace);
    updateWorkspaceUrl(nextWorkspace.id);
    return nextWorkspace;
  };

  const submitSeedRun = async (): Promise<void> => {
    setError(null);
    blurActiveElement();
    try {
      const seedInput = await readSeedInput();
      const currentWorkspace = await createWorkspaceIfNeeded(seedInput);
      const result = await createSeedRun(currentWorkspace.id, seedInput);
      setWorkspace(result.workspace);
      setRuns((current) => ({ ...current, [result.run.id]: result.run }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create seed designs.');
    }
  };

  const selectSeedDesign = async (designId: string): Promise<void> => {
    if (!workspace) return;
    setError(null);
    try {
      setWorkspace(await updateSeedSelection(workspace.id, { selectedSeedDesignId: designId }));
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : 'Failed to select seed design.');
    }
  };

  const switchSeedRun = async (runId: string): Promise<void> => {
    if (!workspace) return;
    setError(null);
    try {
      setWorkspace(await updateActiveSeedRun(workspace.id, { runId }));
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : 'Failed to switch seed run.');
    }
  };

  const submitPagePlan = async (pagePrompt?: string): Promise<void> => {
    if (!workspace) return;
    setError(null);
    setPlanning(true);
    try {
      setWorkspace(await planWorkspacePages(workspace.id, { pagePrompt }));
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : 'Failed to plan pages.');
      void getWorkspace(workspace.id).then(setWorkspace).catch(() => undefined);
    } finally {
      setPlanning(false);
    }
  };

  const showPagePlanner = (): void => {
    if (!workspace) return;
    setError(null);
    const workspaceId = workspace.id;
    setWorkspace((current) => (
      current?.id === workspaceId ? { ...current, plannerVisible: true } : current
    ));
    void updateWorkspacePlanner(workspaceId, { plannerVisible: true })
      .then(setWorkspace)
      .catch((plannerError) => {
        setError(plannerError instanceof Error ? plannerError.message : 'Failed to show page planner.');
        void getWorkspace(workspaceId).then(setWorkspace).catch(() => undefined);
      });
  };

  const updatePlannerPrompt = (plannerPrompt: string): void => {
    if (!workspace) return;
    const workspaceId = workspace.id;
    setWorkspace((current) => (
      current?.id === workspaceId ? { ...current, plannerPrompt } : current
    ));
    void updateWorkspacePlanner(workspaceId, { plannerPrompt })
      .then(setWorkspace)
      .catch((plannerError) => {
        setError(plannerError instanceof Error ? plannerError.message : 'Failed to update page planner.');
        void getWorkspace(workspaceId).then(setWorkspace).catch(() => undefined);
      });
  };

  const patchPage = async (
    pageId: string,
    patch: Parameters<typeof updateWorkspacePage>[2],
  ): Promise<void> => {
    if (!workspace) return;
    setError(null);
    try {
      setWorkspace(await updateWorkspacePage(workspace.id, pageId, patch));
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Failed to update page.');
    }
  };

  const submitPageRun = async (pageId: string): Promise<void> => {
    if (!workspace) return;
    setError(null);
    try {
      const result = await createPageRun(workspace.id, pageId);
      setWorkspace(result.workspace);
      setRuns((current) => ({ ...current, [result.run.id]: result.run }));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to create page variations.');
    }
  };

  const switchPageRun = async (pageId: string, runId: string): Promise<void> => {
    if (!workspace) return;
    setError(null);
    try {
      setWorkspace(await updateActivePageRun(workspace.id, pageId, { runId }));
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : 'Failed to switch page run.');
    }
  };

  const selectPageVariation = (pageId: string, designId: string): void => {
    void patchPage(pageId, { selectedVariationId: designId });
  };

  const editDesignImage = async (
    runId: string,
    designId: string,
    request: Parameters<typeof createDesignImageEdit>[2],
  ): Promise<void> => {
    setError(null);
    try {
      const result = await createDesignImageEdit(runId, designId, request);
      setRuns((current) => ({ ...current, [result.run.id]: result.run }));
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Failed to edit design image.');
      throw editError;
    }
  };

  const extendDesignImage = async (
    runId: string,
    designId: string,
    request: Parameters<typeof createDesignImageExtension>[2],
  ): Promise<void> => {
    setError(null);
    try {
      const result = await createDesignImageExtension(runId, designId, request);
      setRuns((current) => ({ ...current, [result.run.id]: result.run }));
    } catch (extensionError) {
      setError(extensionError instanceof Error ? extensionError.message : 'Failed to extend design image.');
      throw extensionError;
    }
  };

  const setDesignActiveRevision = async (
    runId: string,
    designId: string,
    activeRevisionId: string | null,
  ): Promise<void> => {
    setError(null);
    try {
      const result = await updateDesignActiveRevision(runId, designId, { activeRevisionId });
      setRuns((current) => ({ ...current, [result.run.id]: result.run }));
    } catch (revisionError) {
      setError(revisionError instanceof Error ? revisionError.message : 'Failed to switch design revision.');
      throw revisionError;
    }
  };

  const submitPageHandover = async (pageId: string) => {
    if (!workspace) throw new Error('Create a workspace before handoff.');
    setError(null);
    setBusyHandoverPageId(pageId);
    try {
      const result = await createPageHandover(workspace.id, pageId);
      setWorkspace(result.workspace);
      return result;
    } catch (handoverError) {
      setError(handoverError instanceof Error ? handoverError.message : 'Failed to create handover.');
      throw handoverError;
    } finally {
      setBusyHandoverPageId(null);
    }
  };

  const submitSeedHandover = async () => {
    if (!workspace) throw new Error('Create a workspace before handoff.');
    setError(null);
    setBusyHandoverPageId('__seed__');
    try {
      const result = await createSeedHandover(workspace.id);
      setWorkspace(result.workspace);
      return result;
    } catch (handoverError) {
      setError(handoverError instanceof Error ? handoverError.message : 'Failed to create handover.');
      throw handoverError;
    } finally {
      setBusyHandoverPageId(null);
    }
  };

  const submitTextHandoff = async (handoffText: string, selectedImages: unknown[]): Promise<void> => {
    if (!workspace) throw new Error('Create a workspace before handoff.');
    await sendTextHandoff(workspace.id, { handoffText, selectedImages });
  };

  const submitConnection = async (): Promise<void> => {
    setError(null);
    setConnecting(true);
    try {
      const currentConnection = connection ?? await getConnection();
      if (!currentConnection.auth?.configured) {
        const started = await startTwelveUiConnect();
        window.location.href = started.connectUrl;
        return;
      }
      setConnection(await updateConnection(connectionOrigin));
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : 'Failed to connect to local 12ui UI.');
      void getConnection().then(setConnection).catch(() => undefined);
    } finally {
      setConnecting(false);
    }
  };

  const readReferenceFiles = (files: FileList | null): void => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    void Promise.all(imageFiles.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error(`Could not read ${file.name} as an image data URL.`));
      };
      reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    }))).then((dataUrls) => {
      setReferenceDataUrls((current) => [...current, ...dataUrls]);
    }).catch((readError) => {
      setError(readError instanceof Error ? readError.message : 'Failed to read reference images.');
    });
  };

  return (
    <main className="createShell">
      <WorkspaceCanvas
        sketchRef={sketchRef}
        workspace={workspace}
        runs={runs}
        draft={{
          prompt,
          seedVariationCount,
          aspect,
          quality,
          creativityMode,
          hasSketch,
          referenceCount: referenceDataUrls.length,
        }}
        seedActions={{
          setPrompt,
          setSeedVariationCount,
          setAspect,
          setQuality,
          setCreativityMode,
          onReferenceFiles: readReferenceFiles,
          onClearReferences: () => setReferenceDataUrls([]),
          onCreateSeed: submitSeedRun,
          onSwitchSeedRun: switchSeedRun,
          onClearSketch: () => {
            sketchRef.current?.clear();
            setHasSketch(false);
          },
        }}
        plannerActions={{
          onPlanPages: submitPagePlan,
          onShowPlanner: showPagePlanner,
          onUpdatePlannerPrompt: updatePlannerPrompt,
        }}
        pageActions={{
          onUpdatePage: (pageId, patch) => {
            void patchPage(pageId, patch);
          },
          onCreatePageRun: submitPageRun,
          onSwitchPageRun: switchPageRun,
        }}
        imageActions={{
          onEditDesignImage: editDesignImage,
          onExtendDesignImage: extendDesignImage,
          onSetActiveRevision: setDesignActiveRevision,
        }}
        exportActions={{
          onCreateSeedHandover: submitSeedHandover,
          onCreateHandover: submitPageHandover,
          onSendTextHandoff: submitTextHandoff,
          connectionOrigin,
          setConnectionOrigin,
          onConnect: submitConnection,
        }}
        connection={{ connection, isConnecting }}
        codexBridgeStatus={codexBridgeStatus}
        appStatus={appStatus}
        appStatusError={appStatusError}
        selectedSeedDesignId={workspace?.selectedSeedDesignId ?? null}
        onSelectSeedDesign={selectSeedDesign}
        onSelectPageVariation={selectPageVariation}
        error={error ?? workspace?.error ?? null}
        isPlanning={isPlanning || workspace?.status === 'planning'}
        busyHandoverPageId={busyHandoverPageId}
        onInkChange={setHasSketch}
      />
    </main>
  );
};
