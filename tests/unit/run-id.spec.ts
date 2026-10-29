import { expect, test } from '@playwright/test';

import {
  createRunId,
  getRunId,
  isTestDataName,
  parseCreatedAt,
  testCaseIdOf,
  uniqueName,
} from '../../src/data/runId';
import { restoreEnvAfterEach } from './env';

// Unit tests of the run id and test data names.

test.describe('createRunId', { tag: '@unit' }, () => {
  restoreEnvAfterEach('GITHUB_RUN_ID');

  test('is "local" outside CI', () => {
    delete process.env['GITHUB_RUN_ID'];

    expect(createRunId()).toBe('local');
  });

  test('is the GitHub run id in CI', () => {
    process.env['GITHUB_RUN_ID'] = '12345678';

    expect(createRunId()).toBe('gh12345678');
  });
});

test.describe('uniqueName', { tag: '@unit' }, () => {
  restoreEnvAfterEach('TEST_PARALLEL_INDEX');

  test('has the test case ID, the run id, the worker and the UTC time it was created', () => {
    process.env['TEST_PARALLEL_INDEX'] = '3';
    const before = Date.now();

    const name = uniqueName('TC-004');

    const createdAt = parseCreatedAt(name)?.getTime() ?? 0;
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThan(before + 1000);
    const time = new Date(createdAt).toISOString().replace(/[-:.]/g, '');
    expect(name).toBe(`TC-004-autotest-${getRunId()}-w3-${time}`);
  });

  test('starts with autotest- without a test case ID', () => {
    expect(uniqueName()).toMatch(/^autotest-/);
  });

  test('gives the next millisecond to a name in the same millisecond', () => {
    const now = new Date();

    const first = uniqueName('TC-004', now);
    const second = uniqueName('TC-004', now);

    expect(second).not.toBe(first);
    expect((parseCreatedAt(second)?.getTime() ?? 0) - (parseCreatedAt(first)?.getTime() ?? 0)).toBe(
      1,
    );
  });
});

test.describe('parseCreatedAt', { tag: '@unit' }, () => {
  test('reads the UTC time with milliseconds', () => {
    expect(parseCreatedAt('autotest-local-w0-20260924T101500123Z')).toEqual(
      new Date('2026-09-24T10:15:00.123Z'),
    );
  });

  test('reads the time after a test case ID and with text after the time', () => {
    expect(parseCreatedAt('TC-015a-autotest-gh1-w12-20261231T235959999Z renamed')).toEqual(
      new Date('2026-12-31T23:59:59.999Z'),
    );
  });

  test('reads the start time of the run from a name in the old format', () => {
    expect(parseCreatedAt('TC-015a-autotest-20261231T235959Z-gh1-label-abcdef')).toEqual(
      new Date('2026-12-31T23:59:59Z'),
    );
  });

  test('is undefined for a name without a time', () => {
    expect(parseCreatedAt('autotest-project-abcdef')).toBeUndefined();
    expect(parseCreatedAt('autotest-local-w0-abcdef')).toBeUndefined();
    expect(parseCreatedAt('Inbox')).toBeUndefined();
  });
});

test.describe('isTestDataName', { tag: '@unit' }, () => {
  test('is true for names created by the tests', () => {
    expect(isTestDataName('autotest-local-w0-20260924T101500123Z')).toBe(true);
    expect(isTestDataName('TC-002-autotest-local-w0-20260924T101500123Z')).toBe(true);
    expect(isTestDataName('TC-015a-autotest-x')).toBe(true);
  });

  test('is false for other names', () => {
    expect(isTestDataName('Inbox')).toBe(false);
    expect(isTestDataName('my autotest-project')).toBe(false);
    expect(isTestDataName('Autotest-project')).toBe(false);
    expect(isTestDataName('TC-002 autotest-project')).toBe(false);
  });
});

test.describe('testCaseIdOf', { tag: '@unit' }, () => {
  test('takes the ID from the tag before the title', () => {
    expect(testCaseIdOf({ tags: ['@smoke', '@TC-002'], title: 'TC-003 Something' })).toBe('TC-002');
  });

  test('keeps a suffix such as TC-015a', () => {
    expect(testCaseIdOf({ tags: ['@TC-015a'], title: 'Due date in words' })).toBe('TC-015a');
    expect(testCaseIdOf({ tags: [], title: 'TC-015b Due date in words' })).toBe('TC-015b');
  });

  test('takes the ID from the start of the title when no tag has one', () => {
    expect(testCaseIdOf({ tags: ['@regression'], title: 'TC-007 Task with a label' })).toBe(
      'TC-007',
    );
  });

  test('is undefined when neither the tags nor the title start with an ID', () => {
    expect(testCaseIdOf({ tags: ['@unit'], title: 'a helper works' })).toBeUndefined();
    expect(testCaseIdOf({ tags: [], title: 'Covers TC-002 too' })).toBeUndefined();
  });
});
