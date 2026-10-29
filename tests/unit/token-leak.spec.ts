import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

// End-to-end check of the token redaction: a nested Playwright run with a fake token and a test
// that fails on purpose (tests/unit/token-leak/), then scripts/check-no-token.mts on its report
// and test results. The real token never reaches the nested run or the check.

const FAKE_TOKEN = 'fake-token-for-the-leak-check-0123456789';
const ROOT = path.resolve(__dirname, '../..');

/** The environment of this worker without the real token and Playwright's own variables. */
function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !/^(TODOIST_API_TOKEN|TEST_|PW_|PLAYWRIGHT_)/.test(name),
    ),
  );
  return { ...env, TODOIST_API_TOKEN: FAKE_TOKEN, ...extra };
}

function run(args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

/** Runs the failing test into `output` and returns the result of check-no-token on it. */
function runAndCheck(output: string, redact: boolean) {
  const env = childEnv({ LEAK_CHECK_OUTPUT: output, LEAK_CHECK_REDACT: redact ? '1' : '0' });
  const nested = run(
    [
      require.resolve('@playwright/test/cli'),
      'test',
      '--config',
      'tests/unit/token-leak/playwright.config.ts',
    ],
    env,
  );
  const reportDir = path.join(output, 'playwright-report');
  const resultsDir = path.join(output, 'test-results');
  const check = run(['scripts/check-no-token.mts', reportDir, resultsDir], env);
  return { nested, check, reportDir, resultsDir };
}

test.describe('token redaction end to end', { tag: '@unit' }, () => {
  // Two nested Playwright runs.
  test.slow();

  test('a failed test leaves no token in the report and the test results', () => {
    const output = test.info().outputPath('redacted');
    const { nested, check, resultsDir } = runAndCheck(output, true);

    expect(nested.status, `the nested test fails on purpose\n${nested.output}`).toBe(1);
    const traces = fs.readdirSync(resultsDir, { recursive: true, encoding: 'utf8' });
    expect(traces.filter((file) => file.endsWith('trace.zip'))).toHaveLength(1);
    expect(check.status, check.output).toBe(0);
    expect(check.output).toContain('check-no-token: OK');
  });

  test('without the redaction reporter the check finds the token', () => {
    const output = test.info().outputPath('not-redacted');
    const { nested, check } = runAndCheck(output, false);

    expect(nested.status, `the nested test fails on purpose\n${nested.output}`).toBe(1);
    expect(check.status, check.output).toBe(1);
    expect(check.output).toContain('trace.zip > ');
    expect(check.output).toContain('index.html');
  });
});
