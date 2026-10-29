import { deleteStaleTestData } from '../src/data/cleanup';
import { apiTest as test } from '../src/fixtures/api.fixture';

// Runs once before the API tests (project "setup" in playwright.config.ts): removes `autotest-`
// data that earlier runs left behind and that is older than 1 hour. Never runs for the unit tests.
// eslint-disable-next-line playwright/expect-expect -- cleanup only, a failure throws
test('delete stale test data', async ({ api }) => {
  const summary = await deleteStaleTestData(api);
  // Counts only, never names or headers.
  process.stdout.write(
    `setup: deleted stale test data (projects: ${String(summary.projects)}, ` +
      `labels: ${String(summary.labels)}, inbox tasks: ${String(summary.tasks)})
`,
  );
});
