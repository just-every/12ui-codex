import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { checkConnection } from './connection.js';
import { runDirectCreateHandover } from './directWorkflow.js';
import { parseDirectCreateHandoverRequest } from './validation.js';

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
};

type CliArgs = Record<string, string | string[] | boolean>;

const readArgs = (): CliArgs => {
  const output: CliArgs = {};
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      output[key] = true;
      continue;
    }
    const existing = output[key];
    if (typeof existing === 'string') {
      output[key] = [existing, next];
    } else if (Array.isArray(existing)) {
      existing.push(next);
    } else {
      output[key] = next;
    }
    index += 1;
  }
  return output;
};

const getStringArg = (args: CliArgs, key: string): string | undefined => (
  typeof args[key] === 'string' ? args[key] : undefined
);

const getStringArgs = (args: CliArgs, keys: string[]): string[] => (
  keys.flatMap((key) => {
    const value = args[key];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return [];
  })
);

const mimeFromPath = (filePath: string): string => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'image/png';
};

const imageDataUrlFromPath = async (filePath: string): Promise<string> => {
  const absolute = path.resolve(filePath);
  const bytes = await readFile(absolute);
  return `data:${mimeFromPath(absolute)};base64,${bytes.toString('base64')}`;
};

const readJsonInput = async (args: CliArgs): Promise<Record<string, unknown>> => {
  const jsonPath = getStringArg(args, 'json');
  if (jsonPath) {
    return JSON.parse(await readFile(path.resolve(jsonPath), 'utf8')) as Record<string, unknown>;
  }
  const stdin = await readStdin();
  if (stdin) return JSON.parse(stdin) as Record<string, unknown>;
  return {};
};

const main = async (): Promise<void> => {
  const args = readArgs();
  const input = await readJsonInput(args);
  const referencePaths = getStringArgs(args, ['reference', 'asset']);
  const request = parseDirectCreateHandoverRequest({
    ...input,
    prompt: getStringArg(args, 'prompt') ?? input.prompt,
    designCount: getStringArg(args, 'count') ?? input.designCount,
    aspect: getStringArg(args, 'aspect') ?? input.aspect,
    quality: getStringArg(args, 'quality') ?? input.quality,
    sketchDataUrl: getStringArg(args, 'sketch')
      ? await imageDataUrlFromPath(getStringArg(args, 'sketch')!)
      : input.sketchDataUrl,
    referenceDataUrls: referencePaths.length > 0
      ? await Promise.all(referencePaths.map(imageDataUrlFromPath))
      : input.referenceDataUrls,
  });
  const origin = getStringArg(args, 'origin');
  if (origin) {
    const connection = await checkConnection(origin);
    if (connection.status !== 'ok') {
      throw new Error(connection.message);
    }
  }
  const result = await runDirectCreateHandover(request);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
