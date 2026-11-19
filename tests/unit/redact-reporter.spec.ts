import fs from 'node:fs';

import { expect, test } from '@playwright/test';
import type { TestCase, TestResult } from '@playwright/test/reporter';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import RedactReporter from '../../src/reporters/redact-reporter';
import { REDACTED } from '../../src/utils/redact';
import { FAKE_TOKEN as SECRET, restoreEnvAfterEach } from './env';

// Unit tests of the redaction reporter. It reads the token when it is created, so every test
// sets a fake token first.

/** The parts of a test result the reporter changes. */
function resultWith(parts: Partial<TestResult>): TestResult {
  return {
    annotations: [],
    attachments: [],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    ...parts,
  } as unknown as TestResult;
}

/** A test whose annotations the reporter changes. */
function testWith(annotations: TestCase['annotations'] = []): TestCase {
  return { annotations } as unknown as TestCase;
}

test.describe('RedactReporter', { tag: '@unit' }, () => {
  restoreEnvAfterEach('TODOIST_API_TOKEN');

  test.beforeEach(() => {
    process.env['TODOIST_API_TOKEN'] = SECRET;
  });

  test('redacts the token in every entry of a trace zip', () => {
    const tracePath = test.info().outputPath('trace.zip');
    fs.writeFileSync(
      tracePath,
      zipSync({
        'trace.network': strToU8(`{"name":"authorization","value":"Bearer ${SECRET}"}`),
        'resources/body.json': strToU8(`{"echo":"${SECRET}"}`),
        'trace.stacks': strToU8('no secret here'),
      }),
    );

    new RedactReporter().onTestEnd(
      testWith(),
      resultWith({
        attachments: [{ name: 'trace', contentType: 'application/zip', path: tracePath }],
      }),
    );

    const entries = unzipSync(fs.readFileSync(tracePath));
    expect(strFromU8(entries['trace.network'] ?? new Uint8Array())).toBe(
      `{"name":"authorization","value":"Bearer ${REDACTED}"}`,
    );
    expect(strFromU8(entries['resources/body.json'] ?? new Uint8Array())).toBe(
      `{"echo":"${REDACTED}"}`,
    );
    expect(strFromU8(entries['trace.stacks'] ?? new Uint8Array())).toBe('no secret here');
  });

  test('leaves a trace zip without the token unchanged', () => {
    const tracePath = test.info().outputPath('trace.zip');
    const original = zipSync({ 'trace.network': strToU8('no secret here') });
    fs.writeFileSync(tracePath, original);

    new RedactReporter().onTestEnd(
      testWith(),
      resultWith({
        attachments: [{ name: 'trace', contentType: 'application/zip', path: tracePath }],
      }),
    );

    expect(fs.readFileSync(tracePath).equals(Buffer.from(original))).toBe(true);
  });

  test('redacts attachments, errors, steps, annotations and output', () => {
    const textPath = test.info().outputPath('log.txt');
    fs.writeFileSync(textPath, `token=${SECRET}`);
    const error = { message: `got ${SECRET}`, cause: { stack: `at ${SECRET}` } };
    const stepError = { value: SECRET };
    const step = {
      title: `Call with ${SECRET}`,
      annotations: [{ type: 'info', description: `step ${SECRET}` }],
      steps: [],
      error: stepError,
    };
    const testCase = testWith([{ type: 'skip', description: `needs ${SECRET}` }, { type: 'slow' }]);
    const result = resultWith({
      annotations: [{ type: 'request', description: `Bearer ${SECRET}` }],
      attachments: [
        { name: 'body', contentType: 'text/plain', body: Buffer.from(`a ${SECRET}`) },
        { name: 'log', contentType: 'text/plain', path: textPath },
      ],
      errors: [error],
      error,
      steps: [
        { title: 'Outer step', annotations: [], steps: [step] },
      ] as unknown as TestResult['steps'],
      stdout: [`out ${SECRET}`, Buffer.from(`buffer ${SECRET}`)],
      stderr: [`err ${SECRET}`],
    });

    new RedactReporter().onTestEnd(testCase, result);

    expect(result.attachments[0]?.body?.toString()).toBe(`a ${REDACTED}`);
    expect(fs.readFileSync(textPath, 'utf8')).toBe(`token=${REDACTED}`);
    expect(error).toEqual({ message: `got ${REDACTED}`, cause: { stack: `at ${REDACTED}` } });
    expect(step.title).toBe(`Call with ${REDACTED}`);
    expect(stepError.value).toBe(REDACTED);
    expect(step.annotations).toEqual([{ type: 'info', description: `step ${REDACTED}` }]);
    expect(testCase.annotations).toEqual([
      { type: 'skip', description: `needs ${REDACTED}` },
      { type: 'slow' },
    ]);
    expect(result.annotations).toEqual([{ type: 'request', description: `Bearer ${REDACTED}` }]);
    expect(result.stdout.map(String)).toEqual([`out ${REDACTED}`, `buffer ${REDACTED}`]);
    expect(result.stderr).toEqual([`err ${REDACTED}`]);
  });

  test('redacts errors outside of tests', () => {
    const error = { message: `Cannot load the spec: ${SECRET}` };

    new RedactReporter().onError(error);

    expect(error.message).toBe(`Cannot load the spec: ${REDACTED}`);
  });
});
