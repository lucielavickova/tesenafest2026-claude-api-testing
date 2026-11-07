import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from '@playwright/test';

// Runs only in the nested run of tests/unit/token-leak.spec.ts, with a fake token. It puts the
// token everywhere a real test could: request headers and a response body in the trace, a step
// title, an annotation, attachments of the test and of a step, the output and the error message of
// a step. Then it fails, so the trace is kept.

const token = process.env['TODOIST_API_TOKEN'] ?? '';

test.use({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });

test('fails on purpose with the token in its trace', async ({ request }) => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ authorization: req.headers.authorization }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const response = await test.step(`Call the local server with ${token}`, () =>
      request.get(`http://127.0.0.1:${String(port)}/tasks`));

    test.info().annotations.push({ type: 'request', description: `Bearer ${token}` });
    await test.info().attach('token', { body: token, contentType: 'text/plain' });

    // allure-playwright writes an attachment from a step when the step ends, before the
    // redaction reporter gets the result. The response body has the token in it.
    await test.step('Attach the response body', async () => {
      await test.info().attach('response body', {
        body: await response.text(),
        contentType: 'application/json',
      });
    });

    process.stdout.write(`token in the output: ${token}\n`);

    // In a step, so the step error has the token too. allure-playwright writes it when the step
    // ends, before the redaction reporter gets the result.
    await test.step('Check the response', async () => {
      expect(await response.text(), 'fails on purpose').toBe('');
    });
  } finally {
    server.close();
  }
});
