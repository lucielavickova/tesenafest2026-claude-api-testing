import { defineConfig } from '@playwright/test';

import { config } from './config';

const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // At most 2 workers in CI, because all runs share one Todoist account. Locally Playwright decides.
  ...(isCI && { workers: 2 }),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: config.baseURL,
    trace: 'retain-on-failure',
  },
});
