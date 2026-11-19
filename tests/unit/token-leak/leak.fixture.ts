import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from '@playwright/test';

// Runs only in the nested run of tests/unit/token-leak.spec.ts, with a fake token. It puts the
// token everywhere a real test could: request headers and a response body in the trace, a step
// title, an annotation, an attachment, the output and the error message. Then it fails, so the
// trace is kept.

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
    process.stdout.write(`token in the output: ${token}\n`);

    expect(await response.text(), 'fails on purpose').toBe('');
  } finally {
    server.close();
  }
});
