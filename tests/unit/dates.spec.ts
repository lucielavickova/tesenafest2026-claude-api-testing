import { expect, test } from '@playwright/test';

import { addDays, todayIn, tomorrowIn } from '../../src/utils/dates';

// Unit tests of the date helpers. Every instant is fixed, so the runner's clock does not matter.

test.describe('todayIn', { tag: '@unit' }, () => {
  test('is already tomorrow in Prague while it is still today in UTC', () => {
    // 23:30 UTC is 00:30 in Prague in winter time (UTC+1).
    const now = new Date('2026-12-31T23:30:00Z');

    expect(todayIn('UTC', now)).toBe('2026-12-31');
    expect(todayIn('Europe/Prague', now)).toBe('2027-01-01');
    expect(tomorrowIn('Europe/Prague', now)).toBe('2027-01-02');
  });

  test('is still yesterday in New York after midnight UTC', () => {
    // 02:00 UTC is 22:00 the day before in New York in summer time (UTC-4).
    const now = new Date('2026-07-01T02:00:00Z');

    expect(todayIn('UTC', now)).toBe('2026-07-01');
    expect(todayIn('America/New_York', now)).toBe('2026-06-30');
    expect(tomorrowIn('America/New_York', now)).toBe('2026-07-01');
  });

  test('follows the change to summer time in Prague', () => {
    // On 2026-03-29 Prague moves from UTC+1 to UTC+2 at 01:00 UTC.
    expect(todayIn('Europe/Prague', new Date('2026-03-28T22:59:00Z'))).toBe('2026-03-28');
    expect(todayIn('Europe/Prague', new Date('2026-03-28T23:00:00Z'))).toBe('2026-03-29');
    expect(todayIn('Europe/Prague', new Date('2026-03-29T21:59:00Z'))).toBe('2026-03-29');
    expect(todayIn('Europe/Prague', new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30');
  });
});

test.describe('addDays', { tag: '@unit' }, () => {
  test('crosses the end of a month and a year in both directions', () => {
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  test('knows 29 February in a leap year only', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  test('rejects a date that is not YYYY-MM-DD', () => {
    expect(() => addDays('29.10.2026', 1)).toThrow('Expected a YYYY-MM-DD date, got "29.10.2026".');
  });
});
