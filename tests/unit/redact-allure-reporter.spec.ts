import fs from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Writer } from 'allure-js-commons/sdk/reporter';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { RedactingWriter } from '../../src/reporters/redact-allure-reporter';
import { REDACTED } from '../../src/utils/redact';
import { FAKE_TOKEN as SECRET } from './env';

// Unit tests of the writer that redacts everything allure-playwright saves. The end-to-end check
// with a real allure-playwright run is in token-leak.spec.ts.

/** A writer that keeps what it gets, instead of writing files. */
function recordingWriter() {
  const calls: { method: string; args: unknown[] }[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };
  const writer: Writer = {
    writeResult: record('writeResult'),
    writeGroup: record('writeGroup'),
    writeAttachment: record('writeAttachment'),
    writeAttachmentFromPath: record('writeAttachmentFromPath'),
    writeEnvironmentInfo: record('writeEnvironmentInfo'),
    writeCategoriesDefinitions: record('writeCategoriesDefinitions'),
    writeGlobals: record('writeGlobals'),
    writePerformanceResults: record('writePerformanceResults'),
  };
  return { writer, calls };
}

test.describe('RedactingWriter', { tag: '@unit' }, () => {
  test('redacts the step names, the step errors and the parameters of a result', () => {
    const { writer, calls } = recordingWriter();
    const result = {
      uuid: 'u1',
      name: 'TC-001 a test',
      statusDetails: { message: `Bearer ${SECRET}`, trace: `at ${SECRET}` },
      steps: [
        {
          name: `Call with ${SECRET}`,
          statusDetails: { message: `Expected "" got {"authorization":"Bearer ${SECRET}"}` },
          parameters: [{ name: 'token', value: SECRET }],
          steps: [],
        },
      ],
    } as unknown as Parameters<Writer['writeResult']>[0];

    new RedactingWriter(writer, [SECRET]).writeResult(result);

    const written = calls[0]?.args[0] as typeof result;
    expect(calls[0]?.method).toBe('writeResult');
    expect(JSON.stringify(written)).not.toContain(SECRET);
    expect(written.steps[0]?.name).toBe(`Call with ${REDACTED}`);
    expect(written.steps[0]?.statusDetails.message).toBe(
      `Expected "" got {"authorization":"Bearer ${REDACTED}"}`,
    );
    expect(written.steps[0]?.parameters).toEqual([{ name: 'token', value: REDACTED }]);
    // The original object is not changed: allure-playwright may still use it.
    expect(JSON.stringify(result)).toContain(SECRET);
  });

  test('redacts attachment content and globals', () => {
    const { writer, calls } = recordingWriter();
    const redacting = new RedactingWriter(writer, [SECRET]);

    redacting.writeAttachment('a-attachment.json', Buffer.from(`{"token":"${SECRET}"}`));
    redacting.writeGlobals('g-globals.json', {
      errors: [{ message: `failed with ${SECRET}` }],
      attachments: [],
    } as unknown as Parameters<Writer['writeGlobals']>[1]);

    expect(String(calls[0]?.args[1])).toBe(`{"token":"${REDACTED}"}`);
    expect(JSON.stringify(calls[1]?.args[1])).toBe(
      `{"errors":[{"message":"failed with ${REDACTED}"}],"attachments":[]}`,
    );
  });

  test('copies an attachment file without the token as it is', () => {
    const { writer, calls } = recordingWriter();
    const source = test.info().outputPath('clean.txt');
    fs.writeFileSync(source, 'no secret here');

    new RedactingWriter(writer, [SECRET]).writeAttachmentFromPath('c-attachment.txt', source);

    expect(calls).toEqual([
      { method: 'writeAttachmentFromPath', args: ['c-attachment.txt', source] },
    ]);
  });

  test('writes a redacted copy of a trace zip and leaves the source file unchanged', () => {
    const { writer, calls } = recordingWriter();
    const source = test.info().outputPath('trace.zip');
    const original = zipSync({ 'trace.network': strToU8(`Bearer ${SECRET}`) });
    fs.writeFileSync(source, original);

    new RedactingWriter(writer, [SECRET]).writeAttachmentFromPath('t-attachment.zip', source);

    expect(calls[0]?.method).toBe('writeAttachment');
    const entries = unzipSync(calls[0]?.args[1] as Buffer);
    expect(strFromU8(entries['trace.network'] ?? new Uint8Array())).toBe(`Bearer ${REDACTED}`);
    expect(Buffer.compare(fs.readFileSync(source), Buffer.from(original))).toBe(0);
  });
});
