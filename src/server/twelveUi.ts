import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { HandoverResult } from '../shared/types.js';
import { runDir } from './runStore.js';
import { getTwelveUiOrigin } from './connection.js';
import { getTwelveUiApiKey } from './twelveUiAuthStore.js';

type FetchLike = typeof fetch;

const readTextOrJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
};

const pickString = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const isLocalOrigin = (origin: string): boolean => {
  const hostname = new URL(origin).hostname;
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
};

const devSessionToken = (): string => process.env.DEV_SESSION_TOKEN?.trim() || 'devtoken';

const localAssetPath = (runId: string, assetId: string): string => (
  `/api/design/extract-runs/${encodeURIComponent(runId)}/assets/${encodeURIComponent(assetId)}`
);

const fetchJson = async (fetchImpl: FetchLike, url: URL, init?: RequestInit): Promise<{ response: Response; body: unknown }> => {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new Error(`Request to ${url.toString()} failed: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
  const body = await readTextOrJson(response);
  return { response, body };
};

const readRunId = (body: unknown): string => {
  const record = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const runId = typeof record.runId === 'string'
    ? record.runId.trim()
    : record.run && typeof record.run === 'object' && !Array.isArray(record.run) && typeof (record.run as Record<string, unknown>).runId === 'string'
      ? String((record.run as Record<string, unknown>).runId).trim()
      : '';
  if (!runId) throw new Error('Local extract response did not include a runId.');
  return runId;
};

const readLocalExtractRun = (body: unknown): Record<string, unknown> => {
  const record = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const run = record.run && typeof record.run === 'object' && !Array.isArray(record.run)
    ? record.run as Record<string, unknown>
    : record;
  return run;
};

const waitForLocalExtractCompletion = async (args: {
  fetchImpl: FetchLike;
  origin: string;
  extractRunId: string;
  timeoutMs?: number;
}): Promise<unknown> => {
  const deadline = Date.now() + (args.timeoutMs ?? 600_000);
  let lastBody: unknown = null;
  while (Date.now() < deadline) {
    const { response, body } = await fetchJson(
      args.fetchImpl,
      new URL(`/api/design/extract-runs/${encodeURIComponent(args.extractRunId)}`, args.origin),
      { headers: { 'x-session-token': devSessionToken() } },
    );
    lastBody = body;
    if (!response.ok) {
      throw new Error(`Local extract run ${args.extractRunId} status returned ${response.status}: ${JSON.stringify(body)}`);
    }
    const run = readLocalExtractRun(body);
    const status = typeof run.status === 'string' ? run.status : '';
    if (status === 'completed' || status === 'complete') return body;
    if (status === 'failed') {
      const error = typeof run.error === 'string' ? run.error : JSON.stringify(run.error ?? body);
      throw new Error(`Local extract run ${args.extractRunId} failed: ${error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Local extract run ${args.extractRunId} was not completed before timeout: ${JSON.stringify(lastBody)}`);
};

const waitForLocalExtractAsset = async (args: {
  fetchImpl: FetchLike;
  origin: string;
  extractRunId: string;
  assetId: string;
  timeoutMs?: number;
}): Promise<void> => {
  const deadline = Date.now() + (args.timeoutMs ?? 180_000);
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const response = await args.fetchImpl(new URL(localAssetPath(args.extractRunId, args.assetId), args.origin), {
      headers: { 'x-session-token': devSessionToken() },
    });
    lastStatus = response.status;
    if (response.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Local extract asset ${args.assetId} was not ready before timeout; last status ${lastStatus}.`);
};

export const extractHandoverLinks = (raw: unknown): Omit<HandoverResult, 'designId' | 'runId' | 'raw' | 'createdAt'> => {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const links = record.links && typeof record.links === 'object' && !Array.isArray(record.links)
    ? record.links as Record<string, unknown>
    : {};
  return {
    statusUrl: pickString(record, ['status', 'statusUrl', 'url']) ?? pickString(links, ['status', 'statusUrl', 'url']),
    handoverUrl: pickString(record, ['handover', 'handoverUrl', 'handoverMd']) ?? pickString(links, ['handover', 'handoverUrl', 'handoverMd']),
    handoverHtmlUrl: pickString(record, ['handoverHtml', 'handoverHtmlUrl']) ?? pickString(links, ['handoverHtml', 'handoverHtmlUrl']),
    zipUrl: pickString(record, ['zip', 'zipUrl', 'handoverZip']) ?? pickString(links, ['zip', 'zipUrl', 'handoverZip']),
  };
};

export const submitTwelveUiHandover = async (args: {
  runId: string;
  designId: string;
  assetPath: string;
  fetchImpl?: FetchLike;
}): Promise<HandoverResult> => {
  const origin = getTwelveUiOrigin();
  const apiKey = getTwelveUiApiKey();
  if (!apiKey && isLocalOrigin(origin)) {
    return submitLocalDesignExtract(args);
  }
  if (!apiKey) {
    throw new Error('TWELVE_UI_API_KEY is required to call the 12ui handover API.');
  }
  const fetchImpl = args.fetchImpl ?? fetch;
  const absoluteAssetPath = path.join(runDir(args.runId), args.assetPath);
  const bytes = await readFile(absoluteAssetPath);
  const form = new FormData();
  form.set('file', new Blob([bytes], { type: 'image/png' }), `${args.designId}.png`);
  const response = await fetchImpl(new URL('/api/v1/convert', origin), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  const raw = await readTextOrJson(response);
  if (!response.ok) {
    throw new Error(`12ui handover failed with ${response.status}: ${JSON.stringify(raw)}`);
  }
  return {
    designId: args.designId,
    runId: args.runId,
    ...extractHandoverLinks(raw),
    raw,
    createdAt: new Date().toISOString(),
  };
};

export const submitLocalDesignExtract = async (args: {
  runId: string;
  designId: string;
  assetPath: string;
  fetchImpl?: FetchLike;
}): Promise<HandoverResult> => {
  const origin = getTwelveUiOrigin();
  const fetchImpl = args.fetchImpl ?? fetch;
  const absoluteAssetPath = path.join(runDir(args.runId), args.assetPath);
  const bytes = await readFile(absoluteAssetPath);
  const form = new FormData();
  form.set('file', new Blob([bytes], { type: 'image/png' }), `${args.designId}.png`);
  form.set('profile', 'fast');
  form.set('designKind', 'interface');
  form.set('extractionPrompt', 'Extract this generated interface into a coding-agent handover. Preserve layout, text, imagery, spacing, and colors.');

  const { response, body } = await fetchJson(fetchImpl, new URL('/api/design/extract', origin), {
    method: 'POST',
    headers: { 'x-session-token': devSessionToken() },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Local 12ui extract failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  const extractRunId = readRunId(body);
  const completedBody = await waitForLocalExtractCompletion({
    fetchImpl,
    origin,
    extractRunId,
  });
  await waitForLocalExtractAsset({
    fetchImpl,
    origin,
    extractRunId,
    assetId: 'handover-html',
  });
  await waitForLocalExtractAsset({
    fetchImpl,
    origin,
    extractRunId,
    assetId: 'handover-md',
  });

  return {
    designId: args.designId,
    runId: args.runId,
    statusUrl: new URL(`/api/design/extract-runs/${encodeURIComponent(extractRunId)}`, origin).toString(),
    handoverUrl: `/api/runs/${encodeURIComponent(args.runId)}/handovers/${encodeURIComponent(args.designId)}/handover.md`,
    handoverHtmlUrl: `/api/runs/${encodeURIComponent(args.runId)}/handovers/${encodeURIComponent(args.designId)}/handover.html`,
    raw: {
      mode: 'local-design-extract',
      origin,
      extractRunId,
      createResponse: body,
      completedResponse: completedBody,
    },
    createdAt: new Date().toISOString(),
  };
};

export const fetchLocalHandoverAsset = async (args: {
  handover: HandoverResult;
  asset: string;
  fetchImpl?: FetchLike;
}): Promise<Response> => {
  const raw = args.handover.raw && typeof args.handover.raw === 'object' && !Array.isArray(args.handover.raw)
    ? args.handover.raw as Record<string, unknown>
    : {};
  if (raw.mode !== 'local-design-extract') throw new Error('Handover asset proxy only supports local extract handovers.');
  const origin = typeof raw.origin === 'string' ? raw.origin : getTwelveUiOrigin();
  const extractRunId = typeof raw.extractRunId === 'string' ? raw.extractRunId : '';
  if (!extractRunId) throw new Error('Local extract handover is missing extractRunId.');
  const assetId = args.asset === 'handover.md'
    ? 'handover-md'
    : args.asset === 'handover.html'
      ? 'handover-html'
      : args.asset;
  const response = await (args.fetchImpl ?? fetch)(new URL(localAssetPath(extractRunId, assetId), origin), {
    headers: { 'x-session-token': devSessionToken() },
  });
  if (!response.ok) throw new Error(`Local handover asset ${assetId} returned ${response.status}.`);
  return response;
};

const handoverAssetUrl = (handover: HandoverResult, asset: string): string | undefined => {
  if (asset === 'handover.md') return handover.handoverUrl;
  if (asset === 'handover.html') return handover.handoverHtmlUrl;
  if (asset === 'handover.zip' || asset === 'zip') return handover.zipUrl;
  return undefined;
};

export const fetchHandoverAsset = async (args: {
  handover: HandoverResult;
  asset: string;
  fetchImpl?: FetchLike;
}): Promise<Response> => {
  const raw = args.handover.raw && typeof args.handover.raw === 'object' && !Array.isArray(args.handover.raw)
    ? args.handover.raw as Record<string, unknown>
    : {};
  if (raw.mode === 'local-design-extract') return fetchLocalHandoverAsset(args);
  const url = handoverAssetUrl(args.handover, args.asset);
  if (!url) throw new Error(`Handover asset ${args.asset} is not available.`);
  const headers: Record<string, string> = {};
  const apiKey = getTwelveUiApiKey();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const response = await (args.fetchImpl ?? fetch)(new URL(url, getTwelveUiOrigin()), { headers });
  if (!response.ok) throw new Error(`Handover asset ${args.asset} returned ${response.status}.`);
  return response;
};

export const readLocalExtractRunId = (handover: HandoverResult): string | null => {
  const raw = handover.raw && typeof handover.raw === 'object' && !Array.isArray(handover.raw)
    ? handover.raw as Record<string, unknown>
    : {};
  return typeof raw.extractRunId === 'string' ? raw.extractRunId : null;
};
