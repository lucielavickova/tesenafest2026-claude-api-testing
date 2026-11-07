import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

// End-to-end check of the token redaction: a nested Playwright run with a fake token and a test
// that fails on purpose (tests/unit/token-leak/), an Allure report generated from its results with
// the project allurerc.mjs, then scripts/check-no-token.mts on the HTML report, the test results,
// the Allure results, the Allure report and the Allure history, and a search for the token in the
// console output of the `list` reporter. The real token never reaches the nested run or the check.

// Random, so it is not in the source: on CI Playwright adds the git diff to the HTML report, and a
// literal from a changed file would be found there. A real token is never in the source.
const FAKE_TOKEN = `fake-token-${randomBytes(16).toString('hex')}`;
const ROOT = path.resolve(__dirname, '../..');
// The `allure` package does not export its package.json, so require.resolve cannot find the CLI.
const ALLURE_CLI = path.join(ROOT, 'node_modules', 'allure', 'cli.js');

/** Variables a Playwright worker sets. The nested run must not think it is a worker. */
const WORKER_VARIABLES = ['PLAYWRIGHT_TEST', 'TEST_WORKER_INDEX', 'TEST_PARALLEL_INDEX'];

/** The environment of this worker, with the fake token instead of the real one. */
function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !WORKER_VARIABLES.includes(name)),
  );
  return { ...env, TODOIST_API_TOKEN: FAKE_TOKEN, ...extra };
}

function run(args: string[], env: NodeJS.ProcessEnv, cwd = ROOT) {
  // spawnSync blocks the worker, so the test timeout cannot stop a hanging child. This can.
  const result = spawnSync(process.execPath, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 40_000,
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

/**
 * Runs the failing test into `output`, generates the Allure report there and returns the result of
 * check-no-token on all of it.
 */
function runAndCheck(output: string, mode: 'redacted' | 'plain-allure' | 'not-redacted') {
  const env = childEnv({
    LEAK_CHECK_OUTPUT: output,
    // See tests/unit/token-leak/playwright.config.ts.
    LEAK_CHECK_MODE: mode,
    // The output of the nested run is a pipe, and `list` prints steps only to a terminal.
    PLAYWRIGHT_FORCE_TTY: '1',
  });
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
  const allureResultsDir = path.join(output, 'allure-results');
  // Run in `output` with the project config: its relative output and history paths then point
  // into `output` and not into the project.
  const allure = run(
    [ALLURE_CLI, 'generate', allureResultsDir, '--config', path.join(ROOT, 'allurerc.mjs')],
    env,
    output,
  );
  const allureDirs = ['allure-results', 'allure-report', 'allure-history'].map((dir) =>
    path.join(output, dir),
  );
  const check = run(['scripts/check-no-token.mts', reportDir, resultsDir, ...allureDirs], env);
  return { nested, allure, check, resultsDir, allureResultsDir };
}

test.describe('token redaction end to end', { tag: '@unit' }, () => {
  // Each test is a nested Playwright run and an Allure report.
  test.slow();

  test('a failed test leaves no token in the reports, the results and the console', () => {
    const output = test.info().outputPath('redacted');
    const { nested, allure, check, resultsDir, allureResultsDir } = runAndCheck(output, 'redacted');

    expect(nested.status, `the nested test fails on purpose\n${nested.output}`).toBe(1);
    expect(allure.status, allure.output).toBe(0);
    // The output of the test and the step title, live and in the failure summary.
    expect(nested.output).toContain('token in the output: [REDACTED]');
    expect(nested.output).toContain('Call the local server with [REDACTED]');
    expect(nested.output).not.toContain(FAKE_TOKEN);
    const traces = fs.readdirSync(resultsDir, { recursive: true, encoding: 'utf8' });
    expect(traces.filter((file) => file.endsWith('trace.zip'))).toHaveLength(1);
    // The Allure results have the redacted attachment and step error, so the check below does not
    // pass only because nothing was written.
    const allureFiles = fs.readdirSync(allureResultsDir);
    const allureText = allureFiles
      .map((file) => fs.readFileSync(path.join(allureResultsDir, file), 'utf8'))
      .join('\n');
    expect(allureFiles.some((file) => file.endsWith('-attachment.json'))).toBe(true);
    expect(allureText).toContain('Check the response');
    expect(allureText).toContain('[REDACTED]');
    expect(fs.existsSync(path.join(output, 'allure-report', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(output, 'allure-history', 'history.jsonl'))).toBe(true);
    expect(check.status, check.output).toBe(0);
    expect(check.output).toContain('check-no-token: OK');
  });

  test('with the plain allure-playwright the token is in the Allure results', () => {
    const output = test.info().outputPath('plain-allure');
    const { nested, allure, check } = runAndCheck(output, 'plain-allure');

    expect(nested.status, `the nested test fails on purpose\n${nested.output}`).toBe(1);
    expect(allure.status, allure.output).toBe(0);
    expect(nested.output).not.toContain(FAKE_TOKEN);
    expect(check.status, check.output).toBe(1);
    // allure-playwright writes the attachment of a step and the step error when the step ends,
    // before onTestEnd, so redact-reporter.ts alone does not remove the token from them.
    expect(check.output).toMatch(/allure-results[\\/]\S+-attachment\.json/);
    expect(check.output).toMatch(/allure-results[\\/]\S+-result\.json/);
    // The Playwright HTML report is still redacted.
    expect(check.output).not.toContain(path.join(output, 'playwright-report'));
  });

  test('without the redaction reporters the token is in the artifacts and the console', () => {
    const output = test.info().outputPath('not-redacted');
    const { nested, allure, check } = runAndCheck(output, 'not-redacted');

    expect(nested.status, `the nested test fails on purpose\n${nested.output}`).toBe(1);
    expect(allure.status, allure.output).toBe(0);
    expect(nested.output).toContain(`token in the output: ${FAKE_TOKEN}`);
    expect(nested.output).toContain(`Call the local server with ${FAKE_TOKEN}`);
    expect(check.status, check.output).toBe(1);
    expect(check.output).toContain('trace.zip > ');
    expect(check.output).toContain('index.html');
    expect(check.output).toMatch(/allure-results[\\/]\S+-result\.json/);
    // check-no-token reads the data of the generated report. If a new Allure version encodes it
    // (for example base64 in index.html), the token is not found here and the check must change.
    expect(check.output).toMatch(/allure-report[\\/]awesome[\\/]data[\\/]test-results[\\/]/);
    expect(check.output).toMatch(/allure-report[\\/]awesome[\\/]data[\\/]attachments[\\/]/);
    // The history keeps the error message of every run, so check-no-token must scan it too.
    expect(check.output).toContain('history.jsonl');
  });
});
