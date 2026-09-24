import { randomBytes } from 'node:crypto';

/** Every name created by the tests starts with this, so leftovers are easy to spot. */
export const TEST_DATA_PREFIX = 'autotest-';

const RUN_ID_VARIABLE = 'AUTOTEST_RUN_ID';
/** Names start with the test case ID when the test has one, then `autotest-`. */
const TEST_DATA_NAME = /^(?:TC-\d+[a-z]?-)?autotest-/;
const RUN_TIMESTAMP = /^(?:TC-\d+[a-z]?-)?autotest-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/;

/**
 * Builds a run id such as `20260924T101500Z-gh12345678` (CI) or `20260924T101500Z-local`.
 * The UTC start time comes first, so the global setup can tell how old leftover data is,
 * even for labels, which have no creation date in the API.
 */
export function createRunId(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const githubRunId = process.env['GITHUB_RUN_ID'];
  return `${stamp}-${githubRunId ? `gh${githubRunId}` : 'local'}`;
}

/**
 * The id of the current test run. The first call (in playwright.config.ts, in the main process)
 * stores it in the environment, so all workers, which inherit that environment, share it.
 */
export function getRunId(): string {
  const existing = process.env[RUN_ID_VARIABLE];
  if (existing) return existing;
  const runId = createRunId();
  process.env[RUN_ID_VARIABLE] = runId;
  return runId;
}

/** `autotest-<run id>-` */
export function runPrefix(): string {
  return `${TEST_DATA_PREFIX}${getRunId()}-`;
}

/**
 * A name unique across workers and runs, for example `TC-002-autotest-<run id>-task-3f9a1c`.
 * The test case ID comes first, so a leftover in Todoist shows at a glance which test created it.
 */
export function uniqueName(kind: string, testCaseId?: string): string {
  const owner = testCaseId ? `${testCaseId}-` : '';
  return `${owner}${runPrefix()}${kind}-${randomBytes(3).toString('hex')}`;
}

/** True for names created by the tests: `autotest-...` or `TC-002-autotest-...`. */
export function isTestDataName(name: string): boolean {
  return TEST_DATA_NAME.test(name);
}

const TEST_CASE_TAG = /^@(TC-\d+[a-z]?)$/;
const TEST_CASE_TITLE = /^(TC-\d+[a-z]?)\b/;

/**
 * The test case ID of a test, such as `TC-002` or `TC-015a`: from its `@TC-...` tag,
 * otherwise from the start of its title. Undefined when the test has neither.
 */
export function testCaseIdOf(test: { tags: readonly string[]; title: string }): string | undefined {
  for (const tag of test.tags) {
    const match = TEST_CASE_TAG.exec(tag);
    if (match) return match[1];
  }
  return TEST_CASE_TITLE.exec(test.title)?.[1];
}

/** Start time of the run that created a name, or undefined when the name has no run id. */
export function parseRunTimestamp(name: string): Date | undefined {
  const match = RUN_TIMESTAMP.exec(name);
  if (!match) return undefined;
  const [year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}
