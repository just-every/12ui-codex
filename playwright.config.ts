import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env.CODEX_12UI_E2E_PORT?.trim() || '9971';
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  webServer: {
    command: `CODEX_12UI_PORT=${e2ePort} pnpm dev`,
    url: e2eOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  use: {
    baseURL: e2eOrigin,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
