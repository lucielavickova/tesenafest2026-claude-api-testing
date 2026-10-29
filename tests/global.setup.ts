import { test } from '@playwright/test';

import globalSetup from '../src/global-setup';

// Runs once before the API tests (project "setup" in playwright.config.ts). `playwright.request`
// puts the calls in the trace.
// eslint-disable-next-line playwright/expect-expect -- cleanup only, a failure throws
test('delete stale test data', async ({ playwright }) => {
  await globalSetup(playwright.request);
});
