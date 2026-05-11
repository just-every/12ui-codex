import { createRunRecord, readRun } from './runStore.js';
import { startGeneration } from './generation.js';
import type { CreateRunRequest } from '../shared/types.js';

const request: CreateRunRequest = {
  prompt: 'Create a clean SaaS dashboard landing page with a compact nav, a focused metrics area, and one strong call to action.',
  sketchDataUrl: null,
  referenceDataUrls: [],
  batchSize: 1,
  aspect: 'portrait',
  quality: 'medium',
  creativityMode: 'standard',
};

const run = await createRunRecord(request);
await startGeneration(run.id, request);
const finished = await readRun(run.id);
if (finished.status !== 'completed') {
  throw new Error(finished.error || `Smoke run ended with ${finished.status}.`);
}
console.log(JSON.stringify({
  runId: finished.id,
  status: finished.status,
  designs: finished.designs.map((design) => design.assetPath),
}, null, 2));
