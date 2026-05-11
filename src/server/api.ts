import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CodexBridgeContextResponse,
  CodexBridgeEventType,
  CodexBridgeStatusResponse,
  AppStatusResponse,
  ConnectionResponse,
  CreateRunResponse,
  CreateWorkspaceResponse,
  CreateWorkspaceRunResponse,
  DirectCreateHandoverResponse,
  HandoverResponse,
  WorkspaceHandoverResponse,
} from '../shared/types.js';
import { projectRoot, serverConfig } from './config.js';
import { readRun, createRunRecord, onRunChange, addRunEvent, addHandover } from './runStore.js';
import {
  parseCreateRunRequest,
  parseCreateWorkspaceRequest,
  parseDesignId,
  parseDirectCreateHandoverRequest,
  parsePageId,
  parsePlanWorkspacePagesRequest,
  parseUpdateWorkspacePageRequest,
  parseUpdateWorkspaceSeedSelectionRequest,
  parseWorkspaceId,
} from './validation.js';
import { startGeneration } from './generation.js';
import { readRunAsset } from './assets.js';
import { fetchLocalHandoverAsset, readLocalExtractRunId, submitTwelveUiHandover } from './twelveUi.js';
import { checkConnection, getConnection } from './connection.js';
import {
  emitCodexBridgeEvent,
  getCodexBridgeStatus,
  readCodexBridgeEvents,
  streamCodexBridgeEvents,
  streamCodexBridgeStatus,
  waitForCodexBridgeEvent,
} from './codexBridge.js';
import { runDirectCreateHandover } from './directWorkflow.js';
import {
  createWorkspace,
  onWorkspaceChange,
  patchWorkspacePage,
  readWorkspace,
  setWorkspaceSeedHandover,
  setWorkspacePageHandover,
  setWorkspacePageRun,
  setWorkspacePages,
  setWorkspaceSeedRun,
  setWorkspaceSeedSelection,
  setWorkspaceStatus,
  writeWorkspace,
} from './workspaceStore.js';
import { planWorkspacePages } from './pagePlanner.js';
import { buildPageRunRequest } from './pageGeneration.js';
import { getAppStatus } from './appStatus.js';

type ApiHandler = (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;

const clientDist = path.join(projectRoot, 'dist/client');

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
};

const sendError = (response: ServerResponse, status: number, error: string): void => {
  sendJson(response, status, { error });
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
};

const parseHandoffTextRequest = (body: unknown): {
  handoffText: string;
  selectedImages: unknown[];
} => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Expected a handoff text request object.');
  }
  const record = body as Record<string, unknown>;
  if (typeof record.handoffText !== 'string' || !record.handoffText.trim()) {
    throw new Error('handoffText is required.');
  }
  return {
    handoffText: record.handoffText.trim(),
    selectedImages: Array.isArray(record.selectedImages) ? record.selectedImages : [],
  };
};

const streamSseRun = async (
  runId: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  const writeRun = (run: unknown): void => {
    response.write(`event: run\n`);
    response.write(`data: ${JSON.stringify(run)}\n\n`);
  };
  writeRun(await readRun(runId));
  const unsubscribe = onRunChange(runId, writeRun);
  request.on('close', unsubscribe);
};

const refreshWorkspace = async (workspaceId: string) => {
  const workspace = await readWorkspace(workspaceId);
  let next = workspace;

  if (next.seedRunId && next.status === 'seed_running') {
    const seedRun = await readRun(next.seedRunId);
    if (seedRun.status === 'completed') {
      next = { ...next, status: 'ready', error: null };
    } else if (seedRun.status === 'failed') {
      next = { ...next, status: 'failed', error: seedRun.error ?? 'Seed generation failed.' };
    }
  }

  const pages = await Promise.all(next.pages.map(async (page) => {
    if (!page.runId || page.status !== 'running') return page;
    const run = await readRun(page.runId);
    if (run.status === 'completed') {
      return {
        ...page,
        status: 'ready' as const,
        selectedVariationId: page.selectedVariationId ?? run.designs[0]?.id ?? null,
        error: null,
      };
    }
    if (run.status === 'failed') {
      return { ...page, status: 'failed' as const, error: run.error ?? 'Page generation failed.' };
    }
    return page;
  }));

  if (pages !== next.pages || next !== workspace) {
    next = { ...next, pages };
    if (JSON.stringify(next) !== JSON.stringify(workspace)) {
      return writeWorkspace(next);
    }
  }
  return next;
};

const streamSseWorkspace = async (
  workspaceId: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  const write = (workspace: unknown): void => {
    response.write(`event: workspace\n`);
    response.write(`data: ${JSON.stringify(workspace)}\n\n`);
  };
  write(await refreshWorkspace(workspaceId));
  const unsubscribe = onWorkspaceChange(workspaceId, write);
  request.on('close', unsubscribe);
};

const handleCreateRun = async (response: ServerResponse, body: unknown): Promise<void> => {
  const parsed = parseCreateRunRequest(body);
  const run = await createRunRecord(parsed);
  await addRunEvent(run.id, {
    type: 'queued',
    message: 'Run queued.',
    progress: 0,
  });
  void startGeneration(run.id, parsed);
  const latest = await readRun(run.id);
  sendJson(response, 201, { run: latest } satisfies CreateRunResponse);
};

const handleHandover = async (
  response: ServerResponse,
  runId: string,
  body: unknown,
): Promise<void> => {
  const designId = parseDesignId(
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).designId
      : null,
  );
  const run = await readRun(runId);
  const design = run.designs.find((entry) => entry.id === designId);
  if (!design) {
    sendError(response, 404, 'Design not found.');
    return;
  }
  await addRunEvent(runId, {
    type: 'handover',
    message: `Sending ${design.title} to 12ui Convert.`,
    progress: run.progress,
  });
  const handover = await submitTwelveUiHandover({
    runId,
    designId,
    assetPath: design.assetPath,
  });
  const nextRun = await addHandover(runId, handover);
  sendJson(response, 200, { handover, run: nextRun } satisfies HandoverResponse);
};

const handleCreateWorkspace = async (response: ServerResponse, body: unknown): Promise<void> => {
  const workspace = await createWorkspace(parseCreateWorkspaceRequest(body));
  sendJson(response, 201, { workspace } satisfies CreateWorkspaceResponse);
};

const handleSeedRun = async (
  response: ServerResponse,
  workspaceId: string,
): Promise<void> => {
  const workspace = await readWorkspace(workspaceId);
  const request = {
    prompt: workspace.prompt,
    sketchDataUrl: workspace.sketchDataUrl,
    referenceDataUrls: workspace.referenceDataUrls,
    batchSize: workspace.seedVariationCount,
    aspect: workspace.aspect,
    quality: workspace.quality,
  };
  const run = await createRunRecord(request);
  await setWorkspaceSeedRun(workspaceId, run.id);
  await addRunEvent(run.id, {
    type: 'queued',
    message: 'Seed run queued.',
    progress: 0,
  });
  void startGeneration(run.id, request);
  sendJson(response, 201, {
    workspace: await refreshWorkspace(workspaceId),
    run: await readRun(run.id),
  } satisfies CreateWorkspaceRunResponse);
};

const handleSeedSelection = async (
  response: ServerResponse,
  workspaceId: string,
  body: unknown,
): Promise<void> => {
  const { selectedSeedDesignId } = parseUpdateWorkspaceSeedSelectionRequest(body);
  const workspace = await readWorkspace(workspaceId);
  if (!workspace.seedRunId) throw new Error('Create seed designs before selecting one.');
  const run = await readRun(workspace.seedRunId);
  const selectedDesign = run.designs.find((design) => design.id === selectedSeedDesignId);
  if (!selectedDesign) {
    throw new Error('Selected seed design was not found.');
  }
  const nextWorkspace = await setWorkspaceSeedSelection(workspaceId, selectedSeedDesignId);
  await emitCodexBridgeEvent({
    workspaceId,
    type: 'seed_design_selected',
    message: `Seed design selected: ${selectedDesign.title}.`,
    payload: {
      runId: run.id,
      designId: selectedDesign.id,
      title: selectedDesign.title,
      prompt: selectedDesign.prompt,
      assetPath: selectedDesign.assetPath,
      assetUrl: `/api/runs/${encodeURIComponent(run.id)}/assets/${selectedDesign.assetPath.split('/').map(encodeURIComponent).join('/')}`,
    },
  });
  sendJson(response, 200, {
    workspace: nextWorkspace,
  } satisfies CreateWorkspaceResponse);
};

const handleSeedHandover = async (
  response: ServerResponse,
  workspaceId: string,
): Promise<void> => {
  const workspace = await refreshWorkspace(workspaceId);
  if (!workspace.seedRunId || !workspace.selectedSeedDesignId) {
    throw new Error('Select a seed design before handover.');
  }
  const run = await readRun(workspace.seedRunId);
  const design = run.designs.find((entry) => entry.id === workspace.selectedSeedDesignId);
  if (!design) throw new Error('Selected seed design was not found.');
  await emitCodexBridgeEvent({
    workspaceId,
    type: 'handover_started',
    message: `Started handover for seed design: ${design.title}.`,
    payload: {
      runId: run.id,
      designId: design.id,
      title: design.title,
      assetPath: design.assetPath,
    },
  });
  try {
    const handover = await submitTwelveUiHandover({
      runId: run.id,
      designId: design.id,
      assetPath: design.assetPath,
    });
    await addHandover(run.id, handover);
    const nextWorkspace = await setWorkspaceSeedHandover(workspaceId, handover);
    await emitCodexBridgeEvent({
      workspaceId,
      type: 'handover_completed',
      message: `Handover ready for seed design: ${design.title}.`,
      payload: {
        runId: run.id,
        designId: design.id,
        title: design.title,
        handoverUrl: handover.handoverUrl,
        handoverHtmlUrl: handover.handoverHtmlUrl,
        zipUrl: handover.zipUrl,
      },
    });
    sendJson(response, 200, {
      workspace: nextWorkspace,
      handover,
    } satisfies WorkspaceHandoverResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Handover failed.');
    await emitCodexBridgeEvent({
      workspaceId,
      type: 'handover_failed',
      message: `Handover failed for seed design: ${message}`,
      payload: {
        runId: run.id,
        designId: design.id,
        title: design.title,
        error: message,
      },
    });
    throw error;
  }
};

const handlePagePlan = async (
  response: ServerResponse,
  workspaceId: string,
  body: unknown,
): Promise<void> => {
  const { pagePrompt } = parsePlanWorkspacePagesRequest(body);
  await setWorkspaceStatus(workspaceId, 'planning', null);
  try {
    const workspace = await readWorkspace(workspaceId);
    if (!workspace.selectedSeedDesignId) {
      throw new Error('Select a seed design before planning pages.');
    }
    const plannedPages = await planWorkspacePages(workspace, pagePrompt);
    const usedPageIds = new Set(workspace.pages.map((page) => page.id));
    const nextPages = plannedPages.map((page, index) => {
      let id = page.id;
      let suffix = workspace.pages.length + index + 1;
      while (usedPageIds.has(id)) {
        suffix += 1;
        id = `${page.id}-${suffix}`;
      }
      usedPageIds.add(id);
      return {
        ...page,
        id,
        order: workspace.pages.length + index + 1,
      };
    });
    sendJson(response, 200, {
      workspace: await setWorkspacePages(workspaceId, [
        ...workspace.pages.map((page) => ({
          id: page.id,
          title: page.title,
          prompt: page.prompt,
          order: page.order,
          variationCount: page.variationCount,
        })),
        ...nextPages,
      ]),
    } satisfies CreateWorkspaceResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Page planning failed.');
    await setWorkspaceStatus(workspaceId, 'failed', message);
    throw error;
  }
};

const handleUpdatePage = async (
  response: ServerResponse,
  workspaceId: string,
  pageId: string,
  body: unknown,
): Promise<void> => {
  const patch = parseUpdateWorkspacePageRequest(body);
  const workspace = await readWorkspace(workspaceId);
  const page = workspace.pages.find((entry) => entry.id === pageId);
  if (!page) throw new Error('Workspace page not found.');
  let selectedDesign = null as Awaited<ReturnType<typeof readRun>>['designs'][number] | null;
  if (patch.selectedVariationId && page.runId) {
    const run = await readRun(page.runId);
    selectedDesign = run.designs.find((design) => design.id === patch.selectedVariationId) ?? null;
    if (!selectedDesign) {
      throw new Error('Selected page variation was not found.');
    }
  }
  const nextWorkspace = await patchWorkspacePage(workspaceId, pageId, {
    ...patch,
    ...(patch.selectedVariationId ? { status: 'ready' as const, error: null } : {}),
  });
  if (patch.selectedVariationId && page.runId && selectedDesign) {
    await emitCodexBridgeEvent({
      workspaceId,
      type: 'page_variation_selected',
      message: `${page.title} variation selected: ${selectedDesign.title}.`,
      payload: {
        pageId,
        pageTitle: page.title,
        runId: page.runId,
        designId: selectedDesign.id,
        title: selectedDesign.title,
        prompt: selectedDesign.prompt,
        assetPath: selectedDesign.assetPath,
        assetUrl: `/api/runs/${encodeURIComponent(page.runId)}/assets/${selectedDesign.assetPath.split('/').map(encodeURIComponent).join('/')}`,
      },
    });
  }
  sendJson(response, 200, {
    workspace: nextWorkspace,
  } satisfies CreateWorkspaceResponse);
};

const handlePageRun = async (
  response: ServerResponse,
  workspaceId: string,
  pageId: string,
): Promise<void> => {
  const workspace = await readWorkspace(workspaceId);
  const page = workspace.pages.find((entry) => entry.id === pageId);
  if (!page) throw new Error('Workspace page not found.');
  if (!workspace.selectedSeedDesignId) throw new Error('Select a seed design before creating pages.');
  const request = await buildPageRunRequest(workspace, page);
  const run = await createRunRecord(request);
  await setWorkspacePageRun(workspaceId, pageId, run.id);
  await addRunEvent(run.id, {
    type: 'queued',
    message: `${page.title} run queued.`,
    progress: 0,
  });
  void startGeneration(run.id, request);
  sendJson(response, 201, {
    workspace: await refreshWorkspace(workspaceId),
    run: await readRun(run.id),
  } satisfies CreateWorkspaceRunResponse);
};

const handlePageHandover = async (
  response: ServerResponse,
  workspaceId: string,
  pageId: string,
): Promise<void> => {
  const workspace = await refreshWorkspace(workspaceId);
  const page = workspace.pages.find((entry) => entry.id === pageId);
  if (!page) throw new Error('Workspace page not found.');
  if (!page.runId || !page.selectedVariationId) throw new Error('Select a page variation before handover.');
  const run = await readRun(page.runId);
  const design = run.designs.find((entry) => entry.id === page.selectedVariationId);
  if (!design) throw new Error('Selected page variation was not found.');
  await emitCodexBridgeEvent({
    workspaceId,
    type: 'handover_started',
    message: `Started handover for ${page.title}: ${design.title}.`,
    payload: {
      pageId,
      pageTitle: page.title,
      runId: run.id,
      designId: design.id,
      title: design.title,
      assetPath: design.assetPath,
    },
  });
  try {
    const handover = await submitTwelveUiHandover({
      runId: run.id,
      designId: design.id,
      assetPath: design.assetPath,
    });
    await addHandover(run.id, handover);
    const nextWorkspace = await setWorkspacePageHandover(workspaceId, pageId, handover);
    await emitCodexBridgeEvent({
      workspaceId,
      type: 'handover_completed',
      message: `Handover ready for ${page.title}: ${design.title}.`,
      payload: {
        pageId,
        pageTitle: page.title,
        runId: run.id,
        designId: design.id,
        title: design.title,
        handoverUrl: handover.handoverUrl,
        handoverHtmlUrl: handover.handoverHtmlUrl,
        zipUrl: handover.zipUrl,
      },
    });
    sendJson(response, 200, {
      workspace: nextWorkspace,
      handover,
    } satisfies WorkspaceHandoverResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Handover failed.');
    await emitCodexBridgeEvent({
      workspaceId,
      type: 'handover_failed',
      message: `Handover failed for ${page.title}: ${message}`,
      payload: {
        pageId,
        pageTitle: page.title,
        runId: run.id,
        designId: design.id,
        title: design.title,
        error: message,
      },
    });
    throw error;
  }
};

const parseCodexEventTypes = (url: URL): CodexBridgeEventType[] => {
  const raw = [
    ...url.searchParams.getAll('event'),
    ...url.searchParams.getAll('type'),
    ...(url.searchParams.get('events') ?? '').split(','),
    ...(url.searchParams.get('types') ?? '').split(','),
  ].map((value) => value.trim()).filter(Boolean);
  const allowed = new Set<CodexBridgeEventType>([
    'seed_design_selected',
    'page_variation_selected',
    'handover_started',
    'handover_completed',
    'handover_failed',
  ]);
  return raw.filter((value): value is CodexBridgeEventType => allowed.has(value as CodexBridgeEventType));
};

const handleCodexContext = async (
  response: ServerResponse,
  workspaceId: string,
): Promise<void> => {
  const workspace = await refreshWorkspace(workspaceId);
  const { sketchDataUrl, referenceDataUrls, ...rest } = workspace;
  sendJson(response, 200, {
    workspace: {
      ...rest,
      hasSketch: Boolean(sketchDataUrl),
      referenceCount: referenceDataUrls.length,
    },
    bridgeStatus: getCodexBridgeStatus(workspaceId),
  } satisfies CodexBridgeContextResponse);
};

const handleTextHandoff = async (
  response: ServerResponse,
  workspaceId: string,
  body: unknown,
): Promise<void> => {
  const request = parseHandoffTextRequest(body);
  const event = await emitCodexBridgeEvent({
    workspaceId,
    type: 'handover_completed',
    message: 'Text handoff ready.',
    payload: {
      handoffText: request.handoffText,
      selectedImages: request.selectedImages,
    },
  });
  sendJson(response, 200, { event });
};

export const handleApiRequest: ApiHandler = async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  if (!url.pathname.startsWith('/api/')) return false;

  try {
    if (request.method === 'GET' && url.pathname === '/api/status') {
      sendJson(response, 200, { status: await getAppStatus() } satisfies AppStatusResponse);
      return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/runs') {
      await handleCreateRun(response, await readJsonBody(request));
      return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/direct-create-handover') {
      const parsed = parseDirectCreateHandoverRequest(await readJsonBody(request));
      const result = await runDirectCreateHandover(parsed);
      sendJson(response, 201, { result } satisfies DirectCreateHandoverResponse);
      return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/workspaces') {
      await handleCreateWorkspace(response, await readJsonBody(request));
      return true;
    }

    const workspaceMatch = /^\/api\/workspaces\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'GET' && workspaceMatch) {
      sendJson(response, 200, {
        workspace: await refreshWorkspace(parseWorkspaceId(workspaceMatch[1])),
      } satisfies CreateWorkspaceResponse);
      return true;
    }

    const workspaceEventsMatch = /^\/api\/workspaces\/([^/]+)\/events$/.exec(url.pathname);
    if (request.method === 'GET' && workspaceEventsMatch) {
      await streamSseWorkspace(parseWorkspaceId(workspaceEventsMatch[1]), request, response);
      return true;
    }

    const seedRunMatch = /^\/api\/workspaces\/([^/]+)\/seed-runs$/.exec(url.pathname);
    if (request.method === 'POST' && seedRunMatch) {
      await handleSeedRun(response, parseWorkspaceId(seedRunMatch[1]));
      return true;
    }

    const seedSelectionMatch = /^\/api\/workspaces\/([^/]+)\/seed-selection$/.exec(url.pathname);
    if (request.method === 'PATCH' && seedSelectionMatch) {
      await handleSeedSelection(response, parseWorkspaceId(seedSelectionMatch[1]), await readJsonBody(request));
      return true;
    }

    const pagePlanMatch = /^\/api\/workspaces\/([^/]+)\/page-plan$/.exec(url.pathname);
    if (request.method === 'POST' && pagePlanMatch) {
      await handlePagePlan(response, parseWorkspaceId(pagePlanMatch[1]), await readJsonBody(request));
      return true;
    }

    const seedHandoverMatch = /^\/api\/workspaces\/([^/]+)\/seed-handover$/.exec(url.pathname);
    if (request.method === 'POST' && seedHandoverMatch) {
      await handleSeedHandover(response, parseWorkspaceId(seedHandoverMatch[1]));
      return true;
    }

    const pageMatch = /^\/api\/workspaces\/([^/]+)\/pages\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'PATCH' && pageMatch) {
      await handleUpdatePage(
        response,
        parseWorkspaceId(pageMatch[1]),
        parsePageId(pageMatch[2]),
        await readJsonBody(request),
      );
      return true;
    }

    const pageRunMatch = /^\/api\/workspaces\/([^/]+)\/pages\/([^/]+)\/runs$/.exec(url.pathname);
    if (request.method === 'POST' && pageRunMatch) {
      await handlePageRun(response, parseWorkspaceId(pageRunMatch[1]), parsePageId(pageRunMatch[2]));
      return true;
    }

    const pageHandoverMatch = /^\/api\/workspaces\/([^/]+)\/pages\/([^/]+)\/handover$/.exec(url.pathname);
    if (request.method === 'POST' && pageHandoverMatch) {
      await handlePageHandover(response, parseWorkspaceId(pageHandoverMatch[1]), parsePageId(pageHandoverMatch[2]));
      return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/connection') {
      sendJson(response, 200, { connection: getConnection() } satisfies ConnectionResponse);
      return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/connection') {
      const body = await readJsonBody(request);
      const origin = body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).origin
        : null;
      const connection = await checkConnection(origin);
      sendJson(response, connection.status === 'ok' ? 200 : 400, { connection } satisfies ConnectionResponse);
      return true;
    }

    const codexContextMatch = /^\/api\/codex\/workspaces\/([^/]+)\/context$/.exec(url.pathname);
    if (request.method === 'GET' && codexContextMatch) {
      await handleCodexContext(response, parseWorkspaceId(codexContextMatch[1]));
      return true;
    }

    const codexStatusMatch = /^\/api\/codex\/workspaces\/([^/]+)\/status$/.exec(url.pathname);
    if (request.method === 'GET' && codexStatusMatch) {
      const workspaceId = parseWorkspaceId(codexStatusMatch[1]);
      sendJson(response, 200, { status: getCodexBridgeStatus(workspaceId) } satisfies CodexBridgeStatusResponse);
      return true;
    }

    const codexStatusEventsMatch = /^\/api\/codex\/workspaces\/([^/]+)\/status\/events$/.exec(url.pathname);
    if (request.method === 'GET' && codexStatusEventsMatch) {
      streamCodexBridgeStatus(parseWorkspaceId(codexStatusEventsMatch[1]), request, response);
      return true;
    }

    const codexEventsMatch = /^\/api\/codex\/workspaces\/([^/]+)\/events$/.exec(url.pathname);
    if (request.method === 'GET' && codexEventsMatch) {
      streamCodexBridgeEvents(parseWorkspaceId(codexEventsMatch[1]), request, response);
      return true;
    }

    const codexHandoffTextMatch = /^\/api\/codex\/workspaces\/([^/]+)\/handoff-text$/.exec(url.pathname);
    if (request.method === 'POST' && codexHandoffTextMatch) {
      await handleTextHandoff(response, parseWorkspaceId(codexHandoffTextMatch[1]), await readJsonBody(request));
      return true;
    }

    const codexEventLogMatch = /^\/api\/codex\/workspaces\/([^/]+)\/event-log$/.exec(url.pathname);
    if (request.method === 'GET' && codexEventLogMatch) {
      const workspaceId = parseWorkspaceId(codexEventLogMatch[1]);
      sendJson(response, 200, {
        events: await readCodexBridgeEvents(workspaceId),
        bridgeStatus: getCodexBridgeStatus(workspaceId),
      });
      return true;
    }

    const codexWaitMatch = /^\/api\/codex\/workspaces\/([^/]+)\/wait$/.exec(url.pathname);
    if (request.method === 'GET' && codexWaitMatch) {
      const workspaceId = parseWorkspaceId(codexWaitMatch[1]);
      const timeoutMs = Math.max(1_000, Math.min(30 * 60_000, Number(url.searchParams.get('timeoutMs')) || 10 * 60_000));
      sendJson(
        response,
        200,
        await waitForCodexBridgeEvent(workspaceId, parseCodexEventTypes(url), timeoutMs, request),
      );
      return true;
    }

    const runMatch = /^\/api\/runs\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'GET' && runMatch) {
      sendJson(response, 200, { run: await readRun(decodeURIComponent(runMatch[1])) });
      return true;
    }

    const eventsMatch = /^\/api\/runs\/([^/]+)\/events$/.exec(url.pathname);
    if (request.method === 'GET' && eventsMatch) {
      await streamSseRun(decodeURIComponent(eventsMatch[1]), request, response);
      return true;
    }

    const assetMatch = /^\/api\/runs\/([^/]+)\/assets\/(.+)$/.exec(url.pathname);
    if (request.method === 'GET' && assetMatch) {
      const asset = await readRunAsset(decodeURIComponent(assetMatch[1]), decodeURIComponent(assetMatch[2]));
      response.writeHead(200, {
        'content-type': asset.contentType,
        'cache-control': 'no-store',
        'content-length': asset.bytes.byteLength,
      });
      response.end(asset.bytes);
      return true;
    }

    const handoverMatch = /^\/api\/runs\/([^/]+)\/handover$/.exec(url.pathname);
    if (request.method === 'POST' && handoverMatch) {
      await handleHandover(response, decodeURIComponent(handoverMatch[1]), await readJsonBody(request));
      return true;
    }

    const handoverAssetMatch = /^\/api\/runs\/([^/]+)\/handovers\/([^/]+)\/(handover\.(?:md|html))$/.exec(url.pathname);
    if (request.method === 'GET' && handoverAssetMatch) {
      const run = await readRun(decodeURIComponent(handoverAssetMatch[1]));
      const designId = decodeURIComponent(handoverAssetMatch[2]);
      const asset = handoverAssetMatch[3] as 'handover.md' | 'handover.html';
      const handover = run.handovers.find((entry) => entry.designId === designId);
      if (!handover) {
        sendError(response, 404, 'Handover not found.');
        return true;
      }
      const assetResponse = await fetchLocalHandoverAsset({ handover, asset });
      if (asset === 'handover.html') {
        const html = await assetResponse.text();
        const extractRunId = readLocalExtractRunId(handover);
        const rewritten = extractRunId
          ? html.replaceAll(
            `/api/design/extract-runs/${encodeURIComponent(extractRunId)}/assets/`,
            `/api/runs/${encodeURIComponent(run.id)}/handovers/${encodeURIComponent(designId)}/assets/`,
          )
          : html;
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
        response.end(rewritten);
        return true;
      }
      response.writeHead(200, {
        'content-type': assetResponse.headers.get('content-type') || 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(Buffer.from(await assetResponse.arrayBuffer()));
      return true;
    }

    const nestedHandoverAssetMatch = /^\/api\/runs\/([^/]+)\/handovers\/([^/]+)\/assets\/(.+)$/.exec(url.pathname);
    if (request.method === 'GET' && nestedHandoverAssetMatch) {
      const run = await readRun(decodeURIComponent(nestedHandoverAssetMatch[1]));
      const designId = decodeURIComponent(nestedHandoverAssetMatch[2]);
      const assetId = decodeURIComponent(nestedHandoverAssetMatch[3]);
      const handover = run.handovers.find((entry) => entry.designId === designId);
      if (!handover) {
        sendError(response, 404, 'Handover not found.');
        return true;
      }
      const assetResponse = await fetchLocalHandoverAsset({ handover, asset: assetId });
      response.writeHead(200, {
        'content-type': assetResponse.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(Buffer.from(await assetResponse.arrayBuffer()));
      return true;
    }

    sendError(response, 404, 'API route not found.');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Request failed.');
    sendError(response, 400, message);
    return true;
  }
};

const serveStatic = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const absolute = path.join(clientDist, path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, ''));
  const filePath = await stat(absolute).then((info) => info.isFile() ? absolute : path.join(clientDist, 'index.html')).catch(() => path.join(clientDist, 'index.html'));
  const extension = path.extname(filePath);
  const contentType = extension === '.js'
    ? 'text/javascript; charset=utf-8'
    : extension === '.css'
      ? 'text/css; charset=utf-8'
      : 'text/html; charset=utf-8';
  response.writeHead(200, { 'content-type': contentType });
  createReadStream(filePath).pipe(response);
};

export const createCodex12UiServer = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const vite = isProduction
    ? null
    : await import('vite').then(({ createServer: createViteServer }) => createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: projectRoot,
    }));

  return createServer(async (request, response) => {
    if (await handleApiRequest(request, response)) return;
    if (vite) {
      vite.middlewares(request, response, () => undefined);
      return;
    }
    await serveStatic(request, response);
  });
};

export const listen = async (): Promise<void> => {
  const server = await createCodex12UiServer();
  server.listen(serverConfig.port, serverConfig.host, () => {
    console.log(`codex-12ui running at http://${serverConfig.host}:${serverConfig.port}`);
    console.log(`text model: ${serverConfig.textModel}`);
    console.log(`image model: ${serverConfig.imageModel}`);
  });
};
