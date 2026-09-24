import { defineConfig } from '@playwright/test';

import { config } from './config';
import { getRunId } from './src/data/runId';

const isCI = !!process.env['CI'];

// Fix the run id in the main process, so all workers use the same `autotest-<run id>-` prefix.
getRunId();

export default defineConfig({
  testDir: './tests',
  globalSetup: './src/global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // At most 2 workers in CI, because all runs share one Todoist account. Locally Playwright decides.
  ...(isCI && { workers: 2 }),
  reporter: [
    // The redaction reporter must stay first, see src/reporters/redact-reporter.ts.
    ['./src/reporters/redact-reporter.ts'],
    ['list'],
    ['html', { open: 'never' }],
    // Read by scripts/report-flaky.mts in CI.
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: config.baseURL,
    trace: 'retain-on-failure',
  },
});
