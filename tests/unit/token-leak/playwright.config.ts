import path from 'node:path';

import { defineConfig, type ReporterDescription } from '@playwright/test';

/**
 * Config of the nested run started by tests/unit/token-leak.spec.ts. Only that test uses it.
 * LEAK_CHECK_OUTPUT is the folder for the report and the test results. LEAK_CHECK_REDACT=0
 * leaves out the redaction reporters and uses the plain `list`, to prove that the token really
 * gets into the artifacts and the console output.
 */
const output = process.env['LEAK_CHECK_OUTPUT'];
if (!output) throw new Error('LEAK_CHECK_OUTPUT is not set.');

const redacted = process.env['LEAK_CHECK_REDACT'] !== '0';
// `printSteps`, so the step titles are in the console output too.
const listOptions = { printSteps: true };

const reporters: ReporterDescription[] = [
  redacted
    ? ['../../../src/reporters/redact-list-reporter.ts', listOptions]
    : ['list', listOptions],
  ['html', { open: 'never', outputFolder: path.join(output, 'playwright-report') }],
];
if (redacted) {
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
