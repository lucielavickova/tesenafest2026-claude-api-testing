import { expect, test } from '@playwright/test';

import { isStale, STALE_AFTER_MS } from '../../src/data/cleanup';

// Unit tests of the rule that decides which leftovers the setup project deletes.

const NAME = 'autotest-gh1-w0-20260924T101500000Z';
const OLD_FORMAT_NAME = 'autotest-20260924T101500Z-gh1-project-abcdef';
const CREATED = new Date('2026-09-24T10:15:00Z').getTime();
const after = (ms: number) => new Date(CREATED + ms);

test.describe('isStale', { tag: '@unit' }, () => {
  test('is false for data younger than 1 hour', () => {
    expect(isStale(NAME, after(30 * 60 * 1000))).toBe(false);
  });

  test('is false for data exactly 1 hour old', () => {
    expect(isStale(NAME, after(STALE_AFTER_MS))).toBe(false);
  });

  test('is true for data older than 1 hour', () => {
    expect(isStale(NAME, after(STALE_AFTER_MS + 1000))).toBe(true);
    expect(isStale(`TC-002-${NAME}`, after(STALE_AFTER_MS + 1000))).toBe(true);
  });

  test('reads the age of a name in the old format from the start time of its run', () => {
    expect(isStale(OLD_FORMAT_NAME, after(30 * 60 * 1000))).toBe(false);
    expect(isStale(OLD_FORMAT_NAME, after(STALE_AFTER_MS + 1000))).toBe(true);
  });

  test('is true for a test data name without a time', () => {
    expect(isStale('autotest-project-abcdef', after(0))).toBe(true);
  });

  test('is false for a name that is not test data, however old', () => {
    expect(isStale('Inbox', after(365 * 24 * STALE_AFTER_MS))).toBe(false);
    expect(isStale('Groceries 20260924T101500Z', after(365 * 24 * STALE_AFTER_MS))).toBe(false);
  });
});
