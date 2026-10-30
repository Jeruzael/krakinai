import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  // Playwright clears outputDir on startup. A fresh path retains prior QA evidence.
  outputDir: `qa-results/playwright-runs/${Date.now()}-${randomUUID()}`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'qa-results/playwright.json' }],
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: {
    command: 'node scripts/qa/serve-smoke.mjs',
    url: `${baseURL}/__qa_ready`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
