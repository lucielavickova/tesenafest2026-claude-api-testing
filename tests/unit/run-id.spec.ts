import { expect, test } from '@playwright/test';

import { createRunId, isTestDataName, parseRunTimestamp, testCaseIdOf } from '../../src/data/runId';

// Unit tests of the run id and test data names.

const START = new Date('2026-09-24T10:15:00.123Z');

test.describe('createRunId', { tag: '@unit' }, () => {
  let saved: string | undefined;

  test.beforeEach(() => {
    saved = process.env['GITHUB_RUN_ID'];
  });

  test.afterEach(() => {
    if (saved === undefined) delete process.env['GITHUB_RUN_ID'];
    else process.env['GITHUB_RUN_ID'] = saved;
  });

  test('starts with the UTC start time and ends with "local" outside CI', () => {
    delete process.env['GITHUB_RUN_ID'];

    expect(createRunId(START)).toBe('20260924T101500Z-local');
  });

  test('ends with the GitHub run id in CI', () => {
    process.env['GITHUB_RUN_ID'] = '12345678';

    expect(createRunId(START)).toBe('20260924T101500Z-gh12345678');
  });
});

test.describe('parseRunTimestamp', { tag: '@unit' }, () => {
  test('reads the start time of a name created in this run format', () => {
    const name = `autotest-${createRunId(START)}-task-3f9a1c`;

    expect(parseRunTimestamp(name)).toEqual(new Date('2026-09-24T10:15:00Z'));
  });

  test('reads the start time after a test case ID', () => {
    expect(parseRunTimestamp('TC-015a-autotest-20261231T235959Z-gh1-label-abcdef')).toEqual(
      new Date('2026-12-31T23:59:59Z'),
    );
  });

  test('is undefined for a name without a run id', () => {
    expect(parseRunTimestamp('autotest-project-abcdef')).toBeUndefined();
    expect(parseRunTimestamp('Inbox')).toBeUndefined();
  });
});

test.describe('isTestDataName', { tag: '@unit' }, () => {
  test('is true for names created by the tests', () => {
    expect(isTestDataName('autotest-20260924T101500Z-local-task-3f9a1c')).toBe(true);
    expect(isTestDataName('TC-002-autotest-20260924T101500Z-local-task-3f9a1c')).toBe(true);
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
