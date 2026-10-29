import { expect, test } from '@playwright/test';

import { REDACTED, redact, redactBytes, secretValues } from '../../src/utils/redact';
import { FAKE_TOKEN as SECRET, restoreEnvAfterEach } from './env';

// Unit tests of the redaction helpers. They use a fake token, never the real one.

test.describe('redact', { tag: '@unit' }, () => {
  test('replaces every occurrence of a secret', () => {
    expect(redact(`Bearer ${SECRET}, again ${SECRET}`, [SECRET])).toBe(
      `Bearer ${REDACTED}, again ${REDACTED}`,
    );
  });

  test('replaces every secret in the list', () => {
    expect(
      redact('one-secret-value two-secret-value', ['one-secret-value', 'two-secret-value']),
    ).toBe(`${REDACTED} ${REDACTED}`);
  });

  test('returns text without a secret unchanged', () => {
    expect(redact('nothing to hide', [SECRET])).toBe('nothing to hide');
  });
});

test.describe('redactBytes', { tag: '@unit' }, () => {
  const bytes = (text: string) => Buffer.from(text);

  test('replaces several occurrences, also next to each other', () => {
    const result = redactBytes(bytes(`a ${SECRET} b ${SECRET}${SECRET} c`), [SECRET]);

    expect(result?.toString()).toBe(`a ${REDACTED} b ${REDACTED}${REDACTED} c`);
  });

  test('replaces a secret at the start and at the end of the data', () => {
    const result = redactBytes(bytes(`${SECRET} middle ${SECRET}`), [SECRET]);

    expect(result?.toString()).toBe(`${REDACTED} middle ${REDACTED}`);
  });

  test('replaces data that is only the secret', () => {
    expect(redactBytes(bytes(SECRET), [SECRET])?.toString()).toBe(REDACTED);
  });

  test('reads only the bytes of a view into a larger buffer', () => {
    const whole = bytes(`${SECRET}|inside ${SECRET}|${SECRET}`);
    const view = whole.subarray(SECRET.length + 1, whole.length - SECRET.length - 1);

    expect(redactBytes(view, [SECRET])?.toString()).toBe(`inside ${REDACTED}`);
  });

  test('returns undefined when nothing was found', () => {
    expect(redactBytes(bytes('nothing to hide'), [SECRET])).toBeUndefined();
    expect(redactBytes(bytes(`text with ${SECRET}`), [])).toBeUndefined();
  });

  test('does not change the input', () => {
    const input = bytes(`a ${SECRET}`);

    redactBytes(input, [SECRET]);

    expect(input.toString()).toBe(`a ${SECRET}`);
  });
});

test.describe('secretValues', { tag: '@unit' }, () => {
  restoreEnvAfterEach('TODOIST_API_TOKEN');

  test('contains the token without surrounding whitespace', () => {
    process.env['TODOIST_API_TOKEN'] = `  ${SECRET}\n`;

    expect(secretValues()).toEqual([SECRET]);
  });

  test('ignores a token shorter than 8 characters', () => {
    process.env['TODOIST_API_TOKEN'] = 'short';

    expect(secretValues()).toEqual([]);
    expect(redact('a short text')).toBe('a short text');
    expect(redactBytes(Buffer.from('a short text'))).toBeUndefined();
  });

  test('accepts a token of exactly 8 characters', () => {
    process.env['TODOIST_API_TOKEN'] = '12345678';

    expect(secretValues()).toEqual(['12345678']);
  });

  test('is empty when the token is not set', () => {
    delete process.env['TODOIST_API_TOKEN'];

    expect(secretValues()).toEqual([]);
  });
});
