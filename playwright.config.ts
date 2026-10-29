import { defineConfig } from '@playwright/test';

import { config } from './config';
import { getRunId } from './src/data/runId';

const isCI = !!process.env['CI'];

// Fix the run id in the main process, so all workers use the same `autotest-<run id>-` prefix.
getRunId();

export default defineConfig({
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // 1 worker in CI: runs of different PRs may overlap on the shared Todoist account, and the
  // free plan limits active projects. Locally Playwright decides.
  ...(isCI && { workers: 1 }),
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
  projects: [
    // Unit tests of the framework: no Todoist API and no TODOIST_API_TOKEN.
    { name: 'unit', testDir: './tests/unit' },
    // Deletes stale `autotest-` data before the API tests. A setup project instead of
    // globalSetup, so `--project=unit` does not call the API.
    { name: 'setup', testDir: './tests', testMatch: 'global.setup.ts' },
    // A RegExp, because a glob such as 'unit/**' matches a `unit` folder anywhere in the path.
    {
      name: 'api',
      testDir: './tests',
      testIgnore: /[\\/]tests[\\/]unit[\\/]/,
      dependencies: ['setup'],
    },
  ],
});
