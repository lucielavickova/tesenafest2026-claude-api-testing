import path from 'node:path';

import { defineConfig, type ReporterDescription } from '@playwright/test';

/**
 * Config of the nested run started by tests/unit/token-leak.spec.ts. Only that test uses it.
 * LEAK_CHECK_OUTPUT is the folder for the report and the test results. LEAK_CHECK_REDACT=0
 * leaves out the redaction reporter, to prove that the token really gets into the artifacts.
 */
const output = process.env['LEAK_CHECK_OUTPUT'];
if (!output) throw new Error('LEAK_CHECK_OUTPUT is not set.');

const reporters: ReporterDescription[] = [
  ['html', { open: 'never', outputFolder: path.join(output, 'playwright-report') }],
];
if (process.env['LEAK_CHECK_REDACT'] !== '0') {
  // First, as in the main playwright.config.ts.
  reporters.unshift(['../../../src/reporters/redact-reporter.ts']);
}

export default defineConfig({
  testDir: '.',
  testMatch: 'leak.fixture.ts',
  outputDir: path.join(output, 'test-results'),
  retries: 0,
  workers: 1,
  reporter: reporters,
  use: { trace: 'retain-on-failure' },
});
