import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { devices, test, expect, type Page } from '@playwright/test';
import type { CreateWorkspace, DesignRun } from '../../src/shared/types.js';

const runsRoot = (): string => (
  process.env.CODEX_12UI_DATA_DIR?.trim()
    ? path.join(process.env.CODEX_12UI_DATA_DIR, 'runs')
    : path.join(process.cwd(), '.runs')
);

const openSketchInput = async (page: Page) => {
  await page.getByTestId('sketch-tool-draw').click();
  await expect(page.getByTestId('sketch-composer-canvas-frame')).toBeVisible();
};

const listen = (server: Server): Promise<number> => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    resolve((server.address() as AddressInfo).port);
  });
});

test('connects the browser UI to a local 12ui origin', async ({ page, request }) => {
  const localUi = createServer((request, response) => {
    if (request.url === '/api/status') {
      const body = JSON.stringify({
        status: 'ok',
        workerOrigin: `http://${request.headers.host}`,
      });
      response.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      });
      response.end(body);
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });
  const localUiPort = await listen(localUi);

  try {
    await page.setViewportSize({ width: 1800, height: 900 });
    await page.goto('/');
    await expect(page.getByText('Codex Design')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aspect ratio' })).toContainText('Portrait');
    await expect(page.getByRole('button', { name: 'Design count' })).toContainText('3');
    await page.getByRole('button', { name: 'Design count' }).click();
    await page.getByRole('button', { name: '6 Designs' }).click();
    await expect(page.getByRole('button', { name: 'Design count' })).toContainText('6');
    await page.getByRole('button', { name: 'Aspect ratio' }).click();
    await page.getByRole('button', { name: 'Landscape' }).click();
    await expect(page.getByRole('button', { name: 'Aspect ratio' })).toContainText('Landscape');
    await expect(page.getByLabel('Add pages prompt')).toHaveCount(0);

    const nodeDragProbe = await page.evaluate(() => {
      const node = document.querySelector<HTMLElement>('[data-canvas-node="true"]');
      const world = document.querySelector<HTMLElement>('.sketch-canvas-stage > div > div[style*="translate3d"]');
      const rect = node?.getBoundingClientRect();
      if (!rect || !world) return null;
      return {
        transform: world.style.transform,
        point: {
          x: rect.left + (rect.width * 0.48),
          y: Math.min(rect.top + (rect.height * 0.74), window.innerHeight - 160),
        },
      };
    });
    expect(nodeDragProbe).not.toBeNull();
    await page.mouse.move(nodeDragProbe!.point.x, nodeDragProbe!.point.y);
    await page.mouse.down();
    await page.mouse.move(nodeDragProbe!.point.x + 180, nodeDragProbe!.point.y + 72, { steps: 14 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => {
      const world = document.querySelector<HTMLElement>('.sketch-canvas-stage > div > div[style*="translate3d"]');
      return world?.style.transform ?? null;
    })).not.toBe(nodeDragProbe!.transform);

    await page.mouse.move(1500, 520);
    await page.mouse.down();
    await page.mouse.move(120, 520, { steps: 18 });
    await page.mouse.up();

    const connectionResponse = await request.post('/api/connection', {
      data: { origin: `http://127.0.0.1:${localUiPort}` },
    });
    expect(connectionResponse.ok()).toBeTruthy();

    await expect(page.getByTestId('handoff-dock')).toContainText(/Codex/);
    await expect(page.getByTestId('handoff-dock')).toContainText('12ui connected');
    await expect(page.getByRole('button', { name: /Handover/ })).toBeVisible();
    await expect(page.getByTestId('handoff-dock')).not.toContainText('0 ready');
  } finally {
    await new Promise<void>((resolve) => localUi.close(() => resolve()));
  }
});

test('loads a saved workspace from the URL', async ({ page, request }) => {
  const created = await request.post('/api/workspaces', {
    data: {
      prompt: 'Reloadable local create workspace',
      sketchDataUrl: null,
      referenceDataUrls: [],
      seedVariationCount: 3,
      aspect: 'portrait',
      quality: 'medium',
    },
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json() as { workspace: { id: string } };

  await page.goto(`/workspaces/${body.workspace.id}`);
  await expect(page.getByLabel('Describe your design')).toHaveValue('Reloadable local create workspace');
  await page.reload();
  await expect(page.getByLabel('Describe your design')).toHaveValue('Reloadable local create workspace');
});

test('shows the infinite canvas dots and accepts sketch strokes', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Codex Design')).toBeVisible();
  await expect(page.getByTestId('sketch-composer-canvas-frame')).toHaveCount(0);
  await openSketchInput(page);
  await page.waitForFunction(() => {
    const sketchCanvas = document.querySelector<HTMLCanvasElement>('[data-testid="sketch-composer-canvas-frame"] canvas');
    return Boolean(sketchCanvas && getComputedStyle(sketchCanvas).pointerEvents === 'auto');
  });
  await page.waitForFunction(() => (
    [...document.querySelectorAll('[aria-hidden="true"]')]
      .some((element) => getComputedStyle(element).backgroundImage.includes('image/svg+xml'))
  ));

  const canvasState = await page.evaluate(() => {
    const dotLayer = [...document.querySelectorAll('[aria-hidden="true"]')]
      .find((element) => getComputedStyle(element).backgroundImage.includes('image/svg+xml'));
    const sketchCanvas = document.querySelector<HTMLCanvasElement>('[data-testid="sketch-composer-canvas-frame"] canvas');
    const rect = sketchCanvas?.getBoundingClientRect();
    return {
      dotLayerOpacity: dotLayer ? getComputedStyle(dotLayer).opacity : null,
      dotLayerBackground: dotLayer ? getComputedStyle(dotLayer).backgroundImage : null,
      sketchCanvas: rect && sketchCanvas ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        pointerEvents: getComputedStyle(sketchCanvas).pointerEvents,
      } : null,
    };
  });
  expect(canvasState.dotLayerOpacity).not.toBeNull();
  expect(canvasState.dotLayerBackground).toContain('image/svg+xml');
  expect(canvasState.sketchCanvas?.pointerEvents).toBe('auto');
  expect(canvasState.sketchCanvas).not.toBeNull();

  const rect = canvasState.sketchCanvas!;
  await page.mouse.move(rect.x + 100, rect.y + 100);
  await page.mouse.down();
  await page.mouse.move(rect.x + 320, rect.y + 210, { steps: 24 });
  await page.mouse.up();

  await expect(page.getByRole('button', { name: 'Create designs' })).toBeEnabled();
  const inkPixels = await page.evaluate(() => {
    const sketchCanvas = document.querySelector<HTMLCanvasElement>('[data-testid="sketch-composer-canvas-frame"] canvas');
    if (!sketchCanvas) return 0;
    const context = sketchCanvas.getContext('2d');
    if (!context) return 0;
    const data = context.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height).data;
    let nonWhite = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] && (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245)) {
        nonWhite += 1;
      }
    }
    return nonWhite;
  });
  expect(inkPixels).toBeGreaterThan(0);
});

test.describe('mobile create canvas', () => {
  const iphone = devices['iPhone 14 Pro'];
  test.use({
    deviceScaleFactor: iphone.deviceScaleFactor,
    hasTouch: iphone.hasTouch,
    isMobile: iphone.isMobile,
    userAgent: iphone.userAgent,
    viewport: iphone.viewport,
  });

  test('keeps the sketch target drawable and prompt focus stable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Codex Design')).toBeVisible();
    await openSketchInput(page);
    await page.waitForFunction(() => {
      const sketchCanvas = document.querySelector<HTMLCanvasElement>('[data-testid="sketch-composer-canvas-frame"] canvas');
      return Boolean(sketchCanvas && getComputedStyle(sketchCanvas).pointerEvents === 'auto');
    });

    const canvasRect = await page.evaluate(() => {
      const sketchCanvas = document.querySelector<HTMLCanvasElement>('[data-testid="sketch-composer-canvas-frame"] canvas');
      if (!sketchCanvas) return null;
      const rect = sketchCanvas.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    expect(canvasRect).not.toBeNull();
    expect(canvasRect!.width).toBeGreaterThan(300);
    expect(canvasRect!.height).toBeGreaterThan(120);

    const promptRectBefore = await page.getByLabel('Describe your design').boundingBox();
    expect(promptRectBefore).not.toBeNull();

    await page.getByLabel('Describe your design').fill('Mobile prompt test');
    await expect(page.getByLabel('Describe your design')).toBeFocused();
    await expect(page.getByLabel('Describe your design')).toHaveValue('Mobile prompt test');
    await expect(page.getByTestId('sketch-composer-canvas-frame')).toHaveCount(0);

    await openSketchInput(page);

    const textFirstRects = await page.evaluate(() => {
      const sketchCanvas = document.querySelector<HTMLCanvasElement>('[data-testid="sketch-composer-canvas-frame"] canvas');
      const prompt = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Describe your design"]');
      const canvas = sketchCanvas?.getBoundingClientRect();
      const promptRect = prompt?.getBoundingClientRect();
      return {
        canvas: canvas ? { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height } : null,
        prompt: promptRect ? { height: promptRect.height } : null,
      };
    });
    expect(textFirstRects.canvas).not.toBeNull();
    expect(textFirstRects.prompt).not.toBeNull();
    expect(textFirstRects.prompt!.height).toBeGreaterThan(promptRectBefore!.height);
    expect(textFirstRects.canvas!.width).toBeGreaterThan(300);
    expect(textFirstRects.canvas!.height).toBeGreaterThan(60);

    const cdp = await page.context().newCDPSession(page);
    const strokePoints = [
      { x: textFirstRects.canvas!.x + textFirstRects.canvas!.width * 0.2, y: textFirstRects.canvas!.y + textFirstRects.canvas!.height * 0.35 },
      { x: textFirstRects.canvas!.x + textFirstRects.canvas!.width * 0.4, y: textFirstRects.canvas!.y + textFirstRects.canvas!.height * 0.45 },
      { x: textFirstRects.canvas!.x + textFirstRects.canvas!.width * 0.6, y: textFirstRects.canvas!.y + textFirstRects.canvas!.height * 0.55 },
      { x: textFirstRects.canvas!.x + textFirstRects.canvas!.width * 0.8, y: textFirstRects.canvas!.y + textFirstRects.canvas!.height * 0.65 },
    ];
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...strokePoints[0], id: 1, radiusX: 2, radiusY: 2, force: 1 }],
    });
    for (const point of strokePoints.slice(1)) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...point, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(page.getByRole('button', { name: 'Create designs' })).toBeEnabled();
    const inkPixels = await page.evaluate(() => {
      const sketchCanvas = document.querySelector<HTMLCanvasElement>('[data-testid="sketch-composer-canvas-frame"] canvas');
      if (!sketchCanvas) return 0;
      const context = sketchCanvas.getContext('2d');
      if (!context) return 0;
      const data = context.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height).data;
      let nonWhite = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] && (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245)) {
          nonWhite += 1;
        }
      }
      return nonWhite;
    });
    expect(inkPixels).toBeGreaterThan(0);
  });
});

test('shows pending seed variation loading panels for an active run', async ({ page }) => {
  const workspaceId = randomUUID();
  const runId = randomUUID();
  const now = new Date().toISOString();
  const run: DesignRun = {
    id: runId,
    status: 'running',
    prompt: 'Loading panel regression',
    batchSize: 3,
    aspect: 'portrait',
    quality: 'medium',
    textModel: 'codex-gpt-5.5-high',
    imageModel: 'codex-gpt-image-2',
    progress: 0.34,
    error: null,
    events: [
      {
        id: 1,
        at: now,
        type: 'planning',
        message: 'Planning three design directions.',
        progress: 0.08,
      },
      {
        id: 2,
        at: now,
        type: 'generating',
        message: 'Generating first concept.',
        progress: 0.34,
      },
    ],
    plannedDesigns: [
      {
        branchIndex: 1,
        title: 'Faithful Moonrise Hero',
        prompt: 'A faithful moonrise hero composition.',
      },
      {
        branchIndex: 2,
        title: 'Product-Led Orbital Landing Page',
        prompt: 'A product-led orbital landing page.',
      },
      {
        branchIndex: 3,
        title: 'Dramatic Earth Code Scene',
        prompt: 'A dramatic Earth and code scene.',
      },
    ],
    designs: [],
    handovers: [],
    createdAt: now,
    updatedAt: now,
  };
  const workspace: CreateWorkspace = {
    id: workspaceId,
    status: 'seed_running',
    prompt: 'Loading panel regression',
    sketchDataUrl: null,
    referenceDataUrls: [],
    aspect: 'portrait',
    quality: 'medium',
    seedVariationCount: 3,
    seedRunId: runId,
    selectedSeedDesignId: null,
    seedHandover: null,
    plannerVisible: false,
    plannerPrompt: '',
    pages: [],
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  const root = runsRoot();
  await mkdir(path.join(root, runId), { recursive: true });
  await mkdir(path.join(root, 'workspaces', workspaceId), { recursive: true });
  await writeFile(path.join(root, runId, 'run.json'), `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  await writeFile(path.join(root, 'workspaces', workspaceId, 'workspace.json'), `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');

  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto(`/workspaces/${workspaceId}`);
  await expect(page.getByTestId('create-pending-variation-Faithful Moonrise Hero')).toContainText('Faithful Moonrise Hero');
  await expect(page.getByTestId('create-pending-variation-Faithful Moonrise Hero')).not.toContainText('Creating design');
  await expect(page.getByTestId('create-pending-variation-Faithful Moonrise Hero')).not.toContainText('Generating first concept.');
  await expect(page.getByText('Rendering image').first()).toBeVisible();
  await expect(page.getByText(/remaining|almost ready/).first()).toBeVisible();
  await expect(page.getByTestId('create-pending-variation-Faithful Moonrise Hero').getByTestId('sketch-progress-bar')).toBeVisible();
  const pendingPanelBox = await page.getByTestId('create-pending-variation-Faithful Moonrise Hero').boundingBox();
  expect(pendingPanelBox).not.toBeNull();
  expect(pendingPanelBox!.y).toBeGreaterThanOrEqual(0);
  expect(pendingPanelBox!.y).toBeLessThan(900);
});

test('shows completed designs at the generated aspect ratio with image downloads', async ({ page }) => {
  const workspaceId = randomUUID();
  const runId = randomUUID();
  const now = new Date().toISOString();
  const run: DesignRun = {
    id: runId,
    status: 'completed',
    prompt: 'Completed card regression',
    batchSize: 1,
    aspect: 'portrait',
    quality: 'medium',
    textModel: 'codex-gpt-5.5-high',
    imageModel: 'codex-gpt-image-2',
    progress: 1,
    error: null,
    events: [],
    plannedDesigns: [
      {
        branchIndex: 1,
        title: 'Portrait Regression Design',
        prompt: 'A portrait regression design.',
      },
    ],
    designs: [
      {
        id: 'design-1',
        branchIndex: 1,
        title: 'Portrait Regression Design',
        prompt: 'A portrait regression design.',
        assetPath: 'assets/portrait-regression.png',
        model: 'codex-gpt-image-2',
        createdAt: now,
      },
    ],
    handovers: [],
    createdAt: now,
    updatedAt: now,
  };
  const workspace: CreateWorkspace = {
    id: workspaceId,
    status: 'ready',
    prompt: 'Completed card regression',
    sketchDataUrl: null,
    referenceDataUrls: [],
    aspect: 'portrait',
    quality: 'medium',
    seedVariationCount: 1,
    seedRunId: runId,
    selectedSeedDesignId: null,
    seedHandover: null,
    plannerVisible: false,
    plannerPrompt: '',
    pages: [],
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  const root = runsRoot();
  await mkdir(path.join(root, runId, 'assets'), { recursive: true });
  await mkdir(path.join(root, 'workspaces', workspaceId), { recursive: true });
  await writeFile(path.join(root, runId, 'run.json'), `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  await writeFile(
    path.join(root, runId, 'assets', 'portrait-regression.png'),
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEElEQVR42mP8z8DwnwEJAA1iA/6kF9aSAAAAAElFTkSuQmCC', 'base64'),
  );
  await writeFile(path.join(root, 'workspaces', workspaceId, 'workspace.json'), `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');

  await page.setViewportSize({ width: 1800, height: 1100 });
  await page.goto(`/workspaces/${workspaceId}`);
  await expect(page.getByTestId('create-variation-1')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download image for Portrait Regression Design' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download image for Portrait Regression Design' })).toHaveAttribute('download', 'portrait-regression-design.png');

  const variationBox = await page.getByTestId('create-variation-1').boundingBox();
  expect(variationBox).not.toBeNull();
  expect(variationBox!.width / variationBox!.height).toBeGreaterThan(0.64);
  expect(variationBox!.width / variationBox!.height).toBeLessThan(0.69);

  const imageFit = await page.getByRole('img', { name: 'Portrait Regression Design' }).evaluate((image) => getComputedStyle(image).objectFit);
  expect(imageFit).toBe('contain');
});

test('reveals the add pages node and creates variations under planned pages', async ({ page }) => {
  const workspaceId = randomUUID();
  const seedRunId = randomUUID();
  const pageRunId = randomUUID();
  const now = new Date().toISOString();
  const seedRun: DesignRun = {
    id: seedRunId,
    status: 'completed',
    prompt: '12ui home page',
    batchSize: 1,
    aspect: 'portrait',
    quality: 'medium',
    textModel: 'codex-gpt-5.5-high',
    imageModel: 'codex-gpt-image-2',
    progress: 1,
    error: null,
    events: [],
    plannedDesigns: [
      {
        branchIndex: 1,
        title: '12ui Home Page',
        prompt: 'A 12ui home page.',
      },
    ],
    designs: [
      {
        id: 'seed-design-1',
        branchIndex: 1,
        title: '12ui Home Page',
        prompt: 'A 12ui home page.',
        assetPath: 'assets/seed.png',
        model: 'codex-gpt-image-2',
        createdAt: now,
      },
    ],
    handovers: [],
    createdAt: now,
    updatedAt: now,
  };
  const plannedWorkspace: CreateWorkspace = {
    id: workspaceId,
    status: 'ready',
    prompt: '12ui home page',
    sketchDataUrl: null,
    referenceDataUrls: [],
    aspect: 'portrait',
    quality: 'medium',
    seedVariationCount: 1,
    seedRunId,
    selectedSeedDesignId: 'seed-design-1',
    seedHandover: null,
    plannerVisible: true,
    plannerPrompt: '',
    pages: [
      {
        id: 'pricing-1',
        title: 'Pricing',
        prompt: 'Generate the Pricing page for the same site.',
        order: 1,
        variationCount: 3,
        runId: null,
        selectedVariationId: null,
        handover: null,
        status: 'planned',
        error: null,
      },
    ],
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  const pageRun: DesignRun = {
    id: pageRunId,
    status: 'completed',
    prompt: 'Generate the Pricing page for the same site.',
    batchSize: 3,
    aspect: 'portrait',
    quality: 'medium',
    textModel: 'codex-gpt-5.5-high',
    imageModel: 'codex-gpt-image-2',
    progress: 1,
    error: null,
    events: [],
    plannedDesigns: [
      {
        branchIndex: 1,
        title: 'Pricing Direction',
        prompt: 'A pricing page direction.',
      },
    ],
    designs: [
      {
        id: 'pricing-design-1',
        branchIndex: 1,
        title: 'Pricing Direction',
        prompt: 'A pricing page direction.',
        assetPath: 'assets/pricing.png',
        model: 'codex-gpt-image-2',
        createdAt: now,
      },
    ],
    handovers: [],
    createdAt: now,
    updatedAt: now,
  };

  const root = runsRoot();
  await mkdir(path.join(root, seedRunId, 'assets'), { recursive: true });
  await mkdir(path.join(root, 'workspaces', workspaceId), { recursive: true });
  await writeFile(path.join(root, seedRunId, 'run.json'), `${JSON.stringify(seedRun, null, 2)}\n`, 'utf8');
  await writeFile(
    path.join(root, seedRunId, 'assets', 'seed.png'),
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEElEQVR42mP8z8DwnwEJAA1iA/6kF9aSAAAAAElFTkSuQmCC', 'base64'),
  );
  await writeFile(path.join(root, 'workspaces', workspaceId, 'workspace.json'), `${JSON.stringify({
    ...plannedWorkspace,
    plannerVisible: false,
    pages: [],
  }, null, 2)}\n`, 'utf8');

  await page.route(`**/api/workspaces/${workspaceId}/page-plan`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ pagePrompt: '' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workspace: plannedWorkspace }),
    });
  });
  await page.route(`**/api/workspaces/${workspaceId}/pages/pricing-1/runs`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        workspace: {
          ...plannedWorkspace,
          pages: plannedWorkspace.pages.map((entry) => (
            entry.id === 'pricing-1' ? { ...entry, runId: pageRunId, status: 'ready' } : entry
          )),
        },
        run: pageRun,
      }),
    });
  });

  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto(`/workspaces/${workspaceId}`);
  await expect(page.getByRole('button', { name: 'Add pages' })).toBeVisible();
  await page.getByRole('button', { name: 'Add pages' }).click();
  await expect(page.getByLabel('Add pages prompt')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate page list' })).toHaveCount(0);
  await expect(page.getByText('Design reference ready')).toHaveCount(0);

  await page.getByRole('button', { name: 'Add pages' }).click();
  await expect(page.getByText('Pricing').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create page designs' })).toBeVisible();

  await page.getByRole('button', { name: 'Create page designs' }).click();
  await expect(page.getByText('Pricing Direction')).toBeVisible();
});
