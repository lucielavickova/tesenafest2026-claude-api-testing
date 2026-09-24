/**
 * Calendar dates as `YYYY-MM-DD` strings, computed in the Todoist account's timezone.
 * The runner's clock and timezone must not decide what "today" is: a CI runner in UTC and an
 * account in Europe/Prague disagree for two hours every night.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The calendar date of `instant` in the given IANA timezone. */
export function dateInTimezone(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Today in the given timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return dateInTimezone(now, timeZone);
}

/** Adds whole days to a `YYYY-MM-DD` date (pure calendar math, no timezone involved). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Tomorrow in the given timezone. */
export function tomorrowIn(timeZone: string, now: Date = new Date()): string {
  return addDays(todayIn(timeZone, now), 1);
}

function parseDate(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${date}".`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
