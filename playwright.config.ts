import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: '**/*.e2e.ts', fullyParallel: true, workers: 2,
  expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:5178', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort', url: 'http://127.0.0.1:5178', reuseExistingServer: false },
})
