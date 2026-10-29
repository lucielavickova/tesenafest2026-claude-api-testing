import { expect, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

import { summarize } from '../../scripts/lib/trace-summary.mts';
import { FAKE_TOKEN } from './env';

// Unit tests of the trace reader of the ci-failure-triage subagent, on a small trace built here in
// the format Playwright writes (one JSON object per line, bodies under resources/).

const ndjson = (events: object[]) =>
  strToU8(events.map((event) => JSON.stringify(event)).join('\n'));

function trace(): Uint8Array {
  return zipSync({
    'test.trace': ndjson([
      { type: 'before', callId: 'step@1', title: 'Create a task with unique content' },
      { type: 'after', callId: 'step@1' },
      { type: 'before', callId: 'step@2', title: 'Check the create response' },
      {
        type: 'after',
        callId: 'step@2',
        error: { message: '\u001b[31mExpected\u001b[39m /priority must be string' },
      },
    ]),
    '0-trace.network': ndjson([
      {
        type: 'resource-snapshot',
        snapshot: {
          request: {
            method: 'POST',
            url: 'https://api.todoist.com/api/v1/tasks',
            headers: [{ name: 'Authorization', value: `Bearer ${FAKE_TOKEN}` }],
            postData: { text: '', _file: 'resources/request.json' },
          },
          response: { status: 200, content: { _file: 'resources/response.json' } },
        },
      },
    ]),
    'resources/request.json': strToU8('{"content":"TC-002-autotest"}'),
    'resources/response.json': strToU8('{"id":"6x","priority":1}'),
  });
}

test.describe('trace summary', { tag: '@unit' }, () => {
  test('lists the steps and marks the failed one with its error, without colors', () => {
    const summary = summarize(trace());

    expect(summary).toContain('  Create a task with unique content');
    expect(summary).toContain('  FAILED Check the create response');
    expect(summary).toContain('Expected /priority must be string');
    expect(summary).not.toContain('\u001b[');
  });

  test('lists every API call with method, URL, status and both bodies', () => {
    const summary = summarize(trace());

    expect(summary).toContain('POST https://api.todoist.com/api/v1/tasks -> 200');
    expect(summary).toContain('request:  {"content":"TC-002-autotest"}');
    expect(summary).toContain('response: {"id":"6x","priority":1}');
  });

  test('never prints the request headers', () => {
    const summary = summarize(trace());

    expect(summary).not.toContain('Authorization');
    expect(summary).not.toContain(FAKE_TOKEN);
  });
});
