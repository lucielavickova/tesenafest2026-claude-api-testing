import { randomBytes } from 'node:crypto';

/** Every name created by the tests starts with this, so leftovers are easy to spot. */
export const TEST_DATA_PREFIX = 'autotest-';

const RUN_ID_VARIABLE = 'AUTOTEST_RUN_ID';
const RUN_TIMESTAMP = /^autotest-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/;

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

/** A name unique across workers and runs, for example `autotest-<run id>-task-3f9a1c`. */
export function uniqueName(kind: string): string {
  return `${runPrefix()}${kind}-${randomBytes(3).toString('hex')}`;
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
