import assert from 'node:assert/strict';
import test from 'node:test';
import { editor, flush } from '../../test/docx-editor-harness.js';
import { DOCX_LIMITS } from './commands.js';
import type { DocxRefusalCode, DocxResult, DocxSource } from './types.js';

/**
 * `openUrl()` driven on a real, unconnected element: the request, its cancellation by newer sources, and
 * the localized fail-closed reporting. Admission of the downloaded bytes is the normal `open()` path.
 */
function remote(respond: (url: string, init: RequestInit) => Promise<Response> | Response, baseURI = 'https://host.test/app/') {
  const requests: { url: string; signal: AbortSignal }[] = [];
  const fetch = (url: string, init: RequestInit) => { requests.push({ url, signal: init.signal! }); return respond(url, init); };
  const { i, stub } = editor({ mount: {} });
  Object.defineProperty(i, 'ownerDocument', { value: { baseURI, defaultView: { fetch } }, configurable: true });
  const loads: { source: DocxSource; name: string; signal: AbortSignal | undefined }[] = [];
  const reported: DocxRefusalCode[] = [];
  stub('load', async (source: DocxSource, name: string, signal?: AbortSignal) => {
    loads.push({ source, name, signal });
    return { ok: true, value: { documentId: 'remote', value: 0 } };
  });
  stub('reportError', (code: DocxRefusalCode) => { reported.push(code); });
  const openUrl = (url: string, options?: { signal?: AbortSignal; name?: string }) =>
    (i['openUrl'] as (url: string, options?: { signal?: AbortSignal; name?: string }) => Promise<DocxResult<unknown>>).call(i, url, options);
  return { i, requests, loads, reported, openUrl };
}
const pending = () => {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
};

test('a relative URL resolves against the document base and its bytes take the ordinary open path', async () => {
  const h = remote(() => new Response(new Uint8Array([1, 2, 3])));
  const result = await h.openUrl('docs/report.docx', { name: 'Report.docx' });
  assert.deepEqual(result, { ok: true, value: { documentId: 'remote', value: 0 } });
  assert.equal(h.requests[0]!.url, 'https://host.test/app/docs/report.docx');
  assert.deepEqual(h.loads.map(load => [load.source, load.name]), [[{ kind: 'docx', bytes: new Uint8Array([1, 2, 3]) }, 'Report.docx']]);
  assert.deepEqual(h.reported, []);
  assert.equal(h.i['openingFile'], false);
  assert.equal(h.i['remoteLoad'], null);
});

test('unsafe URLs, failed responses and oversized bodies are reported with localized codes and never opened', async () => {
  const cases: [string, () => Response, DocxRefusalCode][] = [
    ['javascript:alert(1)', () => new Response(new Uint8Array([1])), 'invalid-option'],
    ['file:///etc/passwd', () => new Response(new Uint8Array([1])), 'invalid-option'],
    ['https://x.test/missing.docx', () => new Response('private server detail', { status: 500 }), 'fetch-failed'],
    ['https://x.test/huge.docx', () => new Response(new Uint8Array([1]),
      { headers: { 'content-length': String(DOCX_LIMITS.inputBytes + 1) } }), 'resource-limit'],
  ];
  for (const [url, respond, code] of cases) {
    const h = remote(respond);
    assert.deepEqual(await h.openUrl(url), { ok: false, code }, url);
    assert.deepEqual(h.reported, [code], url);
    assert.equal(h.loads.length, 0, url);
    assert.equal(h.i['openingFile'], false, url);
    if (code === 'invalid-option') assert.equal(h.requests.length, 0, `${url} is never requested`);
  }
});

test('a newer URL, open, new document or disconnect cancels a pending download without reporting it', async () => {
  for (const supersede of ['url', 'bytes', 'new', 'disconnect'] as const) {
    const first = pending();
    let calls = 0;
    const h = remote(() => ++calls === 1 ? first.promise : new Response(new Uint8Array([4])));
    h.i['openInProgress'] = false;
    const older = h.openUrl('https://x.test/older.docx');
    await flush();
    assert.equal(h.i['openingFile'], true, supersede);
    if (supersede === 'url') await h.openUrl('https://x.test/newer.docx');
    else if (supersede === 'bytes') await (h.i['open'] as (bytes: Uint8Array) => Promise<unknown>).call(h.i, new Uint8Array([5]));
    else if (supersede === 'new') await (h.i['newDocument'] as () => Promise<unknown>).call(h.i);
    else { (h.i['supersedeSource'] as () => number).call(h.i); h.i.isConnected = false; }
    assert.equal(h.requests[0]!.signal.aborted, true, `${supersede}: the older request is aborted`);
    first.resolve(new Response(new Uint8Array([9])));
    assert.deepEqual(await older, { ok: false, code: 'aborted' }, supersede);
    assert.deepEqual(h.reported, [], supersede);
    assert.ok(h.loads.every(load => load.source.kind !== 'docx' || load.source.bytes[0] !== 9), `${supersede}: stale bytes never open`);
  }
});

test('the caller signal cancels the download, before or during the request, without an error report', async () => {
  const before = remote(() => new Response(new Uint8Array([1])));
  const aborted = new AbortController(); aborted.abort();
  assert.deepEqual(await before.openUrl('https://x.test/a.docx', { signal: aborted.signal }), { ok: false, code: 'aborted' });
  assert.equal(before.requests.length, 0);

  const during = pending();
  const h = remote(() => during.promise);
  const controller = new AbortController();
  const result = h.openUrl('https://x.test/a.docx', { signal: controller.signal });
  await flush();
  controller.abort();
  assert.deepEqual(await result, { ok: false, code: 'aborted' });
  assert.equal(h.requests[0]!.signal.aborted, true);
  assert.deepEqual([h.reported, h.loads.length, h.i['openingFile']], [[], 0, false]);
});

test('a URL is not requested by an element without a connected mount or a fetching window', async () => {
  for (const state of ['disconnected', 'no mount', 'no window'] as const) {
    const h = remote(() => new Response(new Uint8Array([1])));
    if (state === 'disconnected') h.i.isConnected = false;
    if (state === 'no mount') h.i.mount = null;
    if (state === 'no window') Object.defineProperty(h.i, 'ownerDocument', { value: { baseURI: 'https://x.test/', defaultView: null } });
    assert.deepEqual(await h.openUrl('https://x.test/a.docx'), { ok: false, code: 'invalid-mount' }, state);
    assert.equal(h.requests.length, 0, state);
  }
});
