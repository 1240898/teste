import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

// The built-in Node test runner does not set NODE_ENV like Jest does. Set it
// before importing the app so its request logger stays disabled in this test.
process.env.NODE_ENV = 'test';
const { createApp } = await import('../../../backend/src/app.js');

test('the Express API serves the health contract with the configured CORS origin', async (context) => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const { port } = server.address();
  const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
    headers: { Origin: origin, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).status, 'ok');
});
