#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseCliArgs, stringFlag } from './cliArgs.js';
import { userVisibleBrowserAction } from './browserOpenInstructions.js';
import { createWorkspaceAndSeedRun, getWorkspaceContext, getWorkspaceEventLog, localOrigin, waitForWorkspaceEvent } from './cliHttp.js';
import { installCodexDesign } from './installer.js';
import { launchServer } from './launcher.js';
import type { CodexBridgeEventType } from '../shared/types.js';

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
};

const readJsonInput = async (jsonPath?: string): Promise<Record<string, unknown>> => {
  if (jsonPath) return JSON.parse(await readFile(jsonPath, 'utf8')) as Record<string, unknown>;
  const stdin = await readStdin();
  return stdin ? JSON.parse(stdin) as Record<string, unknown> : {};
};

const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const workspaceUrl = (workspaceId: string): string => (
  new URL(`/workspaces/${encodeURIComponent(workspaceId)}`, localOrigin()).toString()
);

const userMessageForWaitResult = (workspaceId: string, result: unknown): string => {
  const event = (result as { event?: { type?: unknown; payload?: Record<string, unknown> | null } | null })?.event;
  if (!event || typeof event.type !== 'string') {
    return `Keep this design workspace open in the Codex in-app browser so the user can continue when ready: ${workspaceUrl(workspaceId)}`;
  }
  if (event.type === 'seed_design_selected') {
    return `Tell the user their design selection was detected. If 12ui is connected, HTML handover has started automatically in the background; otherwise keep this workspace open in the Codex in-app browser and connect 12ui or click Handoff: ${workspaceUrl(workspaceId)}`;
  }
  if (event.type === 'page_variation_selected') {
    return `Tell the user their page variation selection was detected. If 12ui is connected, HTML handover has started automatically in the background; otherwise keep this workspace open in the Codex in-app browser and connect 12ui or click Handoff: ${workspaceUrl(workspaceId)}`;
  }
  if (event.type === 'handover_completed') {
    const payload = event.payload ?? {};
    const status = typeof payload.statusUrl === 'string' ? payload.statusUrl : '';
    const text = typeof payload.handoffText === 'string' ? payload.handoffText : '';
    const html = typeof payload.handoverHtmlUrl === 'string' ? payload.handoverHtmlUrl : '';
    const md = typeof payload.handoverUrl === 'string' ? payload.handoverUrl : '';
    const zip = typeof payload.zipUrl === 'string' ? payload.zipUrl : '';
    return [
      'Tell the user Handover is complete and continue implementation from the returned handover assets.',
      text ? `handoffText:\n${text}` : '',
      status ? `statusUrl: ${status}` : '',
      html ? `handoverHtmlUrl: ${html}` : '',
      md ? `handoverUrl: ${md}` : '',
      zip ? `zipUrl: ${zip}` : '',
      `workspaceUrl: ${workspaceUrl(workspaceId)}`,
    ].filter(Boolean).join(' ');
  }
  if (event.type === 'handover_failed') {
    return `Tell the user Handover failed with the real error from the event. Keep the workspace open in the Codex in-app browser for retry/debugging: ${workspaceUrl(workspaceId)}`;
  }
  return `Show or keep this design workspace open in the Codex in-app browser: ${workspaceUrl(workspaceId)}`;
};

const parseEvents = (value: string | undefined): CodexBridgeEventType[] => {
  const events = (value ?? '').split(',').map((event) => event.trim()).filter(Boolean);
  if (events.length === 0) throw new Error('Missing required argument: --event');
  const allowed = new Set([
    'seed_design_selected',
    'page_variation_selected',
    'handover_started',
    'handover_completed',
    'handover_failed',
  ]);
  for (const event of events) {
    if (!allowed.has(event)) throw new Error(`Unsupported event type: ${event}`);
  }
  return events as CodexBridgeEventType[];
};

const main = async (): Promise<void> => {
  const { command, flags } = parseCliArgs(process.argv.slice(2));
  if (command === 'install') {
    printJson(await installCodexDesign());
    return;
  }
  if (command === 'launch') {
    const result = await launchServer();
    printJson({
      ...result,
      browserUrl: result.origin,
      userMessage: userVisibleBrowserAction(result.origin, 'create or review a design workspace'),
    });
    return;
  }
  if (command === 'create') {
    await launchServer();
    const input = await readJsonInput(stringFlag(flags, 'json'));
    printJson(await createWorkspaceAndSeedRun(input));
    return;
  }
  if (command === 'wait') {
    const workspaceId = stringFlag(flags, 'workspace');
    if (!workspaceId) throw new Error('Missing required argument: --workspace');
    const result = await waitForWorkspaceEvent({
      workspaceId,
      events: parseEvents(stringFlag(flags, 'event')),
      timeoutMs: Number(stringFlag(flags, 'timeout-ms', 'timeoutMs') ?? 1_800_000),
      afterEventId: Number(stringFlag(flags, 'after-event-id', 'afterEventId') ?? 0),
    });
    printJson({
      ...(result && typeof result === 'object' && !Array.isArray(result) ? result : { result }),
      workspaceUrl: workspaceUrl(workspaceId),
      browserUrl: workspaceUrl(workspaceId),
      userMessage: userMessageForWaitResult(workspaceId, result),
    });
    const eventType = (result as { event?: { type?: unknown } })?.event?.type;
    const status = (result as { status?: unknown })?.status;
    if (status !== 'event' || eventType === 'handover_failed') process.exitCode = 1;
    return;
  }
  if (command === 'context') {
    const workspaceId = stringFlag(flags, 'workspace');
    if (!workspaceId) throw new Error('Missing required argument: --workspace');
    const result = await getWorkspaceContext(workspaceId);
    printJson({
      ...(result && typeof result === 'object' && !Array.isArray(result) ? result : { result }),
      workspaceUrl: workspaceUrl(workspaceId),
      browserUrl: workspaceUrl(workspaceId),
      userMessage: userVisibleBrowserAction(workspaceUrl(workspaceId), 'review designs, pick one, and click Handoff'),
    });
    return;
  }
  if (command === 'event-log') {
    const workspaceId = stringFlag(flags, 'workspace');
    if (!workspaceId) throw new Error('Missing required argument: --workspace');
    const result = await getWorkspaceEventLog(workspaceId);
    printJson({
      ...(result && typeof result === 'object' && !Array.isArray(result) ? result : { result }),
      workspaceUrl: workspaceUrl(workspaceId),
      browserUrl: workspaceUrl(workspaceId),
      userMessage: `Use this event log to resume, and keep this URL open in the Codex in-app browser for any further selection or Handoff actions: ${workspaceUrl(workspaceId)}`,
    });
    return;
  }
  process.stderr.write([
    'Usage:',
    '  codex-design install',
    '  codex-design launch --json',
    '  codex-design create --json',
    '  codex-design wait --workspace <id> --event <type[,type]> --timeout-ms <ms>',
    '  codex-design context --workspace <id>',
    '  codex-design event-log --workspace <id>',
    '',
  ].join('\n'));
  process.exitCode = command === 'help' ? 0 : 1;
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
