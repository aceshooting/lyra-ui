import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startServer } from './server.mjs';

let server;
let origin;
before(async () => {
  server = await startServer();
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

test('serves benchmark files with isolation headers', async () => {
  const response = await fetch(`${origin}/web/bench.html`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
  await response.arrayBuffer();
});

test('rejects encoded traversal into a sibling sharing the root prefix', async () => {
  const response = await fetch(`${origin}/%2e%2e%2f0002-evidence-sibling/private.txt`);
  assert.equal(response.status, 403);
  await response.arrayBuffer();
});

test('rejects malformed URL escapes without terminating the server', async () => {
  const response = await fetch(`${origin}/%zz`, { signal: AbortSignal.timeout(2000) });
  assert.equal(response.status, 400);
  await response.arrayBuffer();
  const next = await fetch(`${origin}/missing.txt`);
  assert.equal(next.status, 404);
  await next.arrayBuffer();
});
