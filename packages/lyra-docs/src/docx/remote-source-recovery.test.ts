import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchDocxBytes } from './remote-source.js';

const address = 'https://example.test/document.docx';
const fetchResponse = (response: unknown): typeof fetch => async () => response as Response;

for (const property of ['arrayBuffer', 'url', 'ok']) {
  test(`a throwing response ${property} accessor fails closed and cancels its unread body`, async () => {
    let cancelled = 0, reads = 0;
    const response = {
      ok: true, url: address, headers: new Headers(),
      body: { cancel() { cancelled++; return Promise.resolve(); } },
      arrayBuffer: async () => { reads++; return new ArrayBuffer(0); },
    };
    Object.defineProperty(response, property, { get() { throw new Error('Private adapter details'); } });
    assert.deepEqual(await fetchDocxBytes(address, { fetch: fetchResponse(response) }), { ok: false, code: 'fetch-failed' });
    assert.equal(cancelled, 1);
    assert.equal(reads, 0);
  });
}

test('an unread response with no arrayBuffer capability releases its body', async () => {
  let cancelled = 0;
  const response = { body: { cancel() { cancelled++; return Promise.resolve(); } } };
  assert.deepEqual(await fetchDocxBytes(address, { fetch: fetchResponse(response) }), { ok: false, code: 'fetch-failed' });
  assert.equal(cancelled, 1);
});

test('a failing response cancellation does not expose a private cleanup error', async () => {
  const response = { ok: false, url: address, arrayBuffer: async () => new ArrayBuffer(0),
    body: { cancel() { throw new Error('Private cleanup details'); } } };
  assert.deepEqual(await fetchDocxBytes(address, { fetch: fetchResponse(response) }), { ok: false, code: 'fetch-failed' });
});

for (const value of [null, 'bytes', new Uint8Array([1]), {}]) {
  test(`refuses a bodyless adapter returning ${Object.prototype.toString.call(value)} instead of an ArrayBuffer`, async () => {
    const response = { ok: true, url: address, body: null, headers: new Headers(), arrayBuffer: async () => value };
    assert.deepEqual(await fetchDocxBytes(address, { fetch: fetchResponse(response) }), { ok: false, code: 'fetch-failed' });
  });
}

for (const value of [null, 'bytes', new Uint16Array([1]), new ArrayBuffer(2)]) {
  test(`cancels a stream emitting ${Object.prototype.toString.call(value)} instead of byte chunks`, async () => {
    let cancelled = 0;
    const body = new ReadableStream<unknown>({ start(controller) { controller.enqueue(value); }, cancel() { cancelled++; } });
    const response = new Response(body as ReadableStream<Uint8Array>);
    assert.deepEqual(await fetchDocxBytes(address, { fetch: fetchResponse(response) }), { ok: false, code: 'fetch-failed' });
    assert.equal(cancelled, 1);
    assert.equal(body.locked, false);
  });
}

test('a completed read remains successful when a foreign reader has already released its lock', async () => {
  let reads = 0, releases = 0;
  const response = { ok: true, url: address, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0),
    body: { getReader: () => ({
      read: async () => ++reads === 1 ? { value: new Uint8Array([1, 2]), done: false } : { done: true },
      releaseLock() { releases++; throw new Error('Already released'); },
    }) } };
  assert.deepEqual(await fetchDocxBytes(address, { fetch: fetchResponse(response) }), { ok: true, value: new Uint8Array([1, 2]) });
  assert.equal(reads, 2);
  assert.equal(releases, 1);
});
