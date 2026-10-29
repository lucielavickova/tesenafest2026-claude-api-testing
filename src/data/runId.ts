/** Every name created by the tests starts with this, so leftovers are easy to spot. */
export const TEST_DATA_PREFIX = 'autotest-';

const RUN_ID_VARIABLE = 'AUTOTEST_RUN_ID';
/** Names start with the test case ID when the test has one, then `autotest-`. */
const TEST_DATA_NAME = /^(?:TC-\d+[a-z]?-)?autotest-/;
/** `...-w0-20261029T101503123Z`: the UTC time the item was created, with milliseconds. */
const CREATED_AT =
  /^(?:TC-\d+[a-z]?-)?autotest-[^-]+-w\d+-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z/;
/** Old format `autotest-20260924T101500Z-local-task-3f9a1c`: the UTC start time of the run. */
const OLD_RUN_START = /^(?:TC-\d+[a-z]?-)?autotest-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/;

/** Builds a run id: `gh12345678` (the GitHub run id) in CI, `local` outside CI. */
export function createRunId(): string {
  const githubRunId = process.env['GITHUB_RUN_ID'];
  return githubRunId ? `gh${githubRunId}` : 'local';
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

let lastCreatedAt = 0;

/**
 * A name unique across workers and runs, for example `TC-002-autotest-local-w0-20261029T101503123Z`.
 * The test case ID comes first, so a leftover in Todoist shows at a glance which test created it.
 * The UTC time at the end tells the setup project how old leftover data is, even for labels,
 * which have no creation date in the API.
 * Unique because:
 * - `w<n>` is the parallel index of the worker. Two workers that run at the same time never share
 *   it. Todoist rejects a second label with the same name.
 * - Within one worker, a name in the same millisecond as the previous one gets the next millisecond.
 */
export function generateUniqueName(testCaseId?: string, now: Date = new Date()): string {
  lastCreatedAt = Math.max(now.getTime(), lastCreatedAt + 1);
  const owner = testCaseId ? `${testCaseId}-` : '';
  const worker = process.env['TEST_PARALLEL_INDEX'] ?? '0';
  const createdAt = new Date(lastCreatedAt).toISOString().replace(/[-:.]/g, '');
  return `${owner}${runPrefix()}w${worker}-${createdAt}`;
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

/**
 * The UTC time a test data name was created, or undefined when the name has no readable time.
 * For a name in the old format, the start time of the run that created it. Older branches still
 * create such names, and their data must not be deleted while their run is in progress.
 */
export function parseCreatedAt(name: string): Date | undefined {
  const match = CREATED_AT.exec(name) ?? OLD_RUN_START.exec(name);
  if (!match) return undefined;
  const [year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0, ms = 0] = match
    .slice(1)
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
}
