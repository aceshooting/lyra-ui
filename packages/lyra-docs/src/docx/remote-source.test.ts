import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOCX_REMOTE_LIMITS, fetchDocxBytes } from './remote-source.js';
import { DOCX_LIMITS } from './commands.js';

type FetchCall = { url: string; init: RequestInit | undefined };
function recordingFetch(respond: (url: string, init: RequestInit | undefined) => Promise<Response> | Response) {
  const calls: FetchCall[] = [];
  const fetch = ((url: string, init?: RequestInit) => { calls.push({ url, init }); return Promise.resolve(respond(url, init)); }) as typeof globalThis.fetch;
  return { calls, fetch };
}
/** A stream that yields the given chunks, recording cancellation. */
function chunked(chunks: readonly Uint8Array[], state = { cancelled: 0, pulls: 0 }) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.pulls++;
      if (index < chunks.length) controller.enqueue(chunks[index++]!);
      else controller.close();
    },
    cancel() { state.cancelled++; },
  });
  return { body, state };
}

test('the URL gate mirrors the shared fetch allowlist and checks the resolved address', async () => {
  const requested = async (url: unknown, baseUrl?: string) => {
    const { calls, fetch } = recordingFetch(() => new Response(new Uint8Array([1])));
    const result = await fetchDocxBytes(url as string, { fetch, ...(baseUrl === undefined ? {} : { baseUrl }) });
    return result.ok ? calls[0]!.url : null;
  };
  for (const url of ['https://example.test/a.docx', 'http://example.test/a.docx', 'files/a.docx', '/a.docx',
    '//example.test/a.docx', 'blob:https://example.test/uuid', 'data:application/octet-stream;base64,AA==']) {
    assert.notEqual(await requested(url, 'https://host.test/app/'), null, url);
  }
  assert.equal(await requested('  files/a.docx ', 'https://host.test/app/'), 'https://host.test/app/files/a.docx');
  for (const url of ['javascript:alert(1)', 'java\tscript:alert(1)', ' JAVASCRIPT:alert(1)', 'file:///etc/passwd',
    'ftp://example.test/a.docx', 'mailto:a@example.test', 'vbscript:x', '', '   ', 'https://[bad', 42, null, undefined, {}]) {
    assert.equal(await requested(url, 'https://host.test/'), null, String(url));
  }
  assert.equal(await requested('relative.docx'), null, 'a relative URL without a base is refused');
  assert.equal(await requested('relative.docx', 'about:blank'), null, 'a non-web base cannot launder a relative URL');
  assert.equal(await requested('relative.docx', 'javascript:void(0)//'), null, 'an executable base is refused after resolution');
});

test('a disallowed or malformed URL is refused before fetch is called', async () => {
  const { calls, fetch } = recordingFetch(() => new Response(new Uint8Array([1])));
  for (const url of ['javascript:alert(1)', 'file:///x.docx', '', 'relative.docx']) {
    assert.deepEqual(await fetchDocxBytes(url, { fetch }), { ok: false, code: 'invalid-option' }, url);
  }
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', { fetch, signal: 'nope' as unknown as AbortSignal }),
    { ok: false, code: 'invalid-option' });
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', { fetch: 'nope' as unknown as typeof globalThis.fetch }),
    { ok: false, code: 'invalid-option' });
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', 'nope' as never), { ok: false, code: 'invalid-option' });
  assert.equal(calls.length, 0);
});

test('a successful response returns an owned copy of its bytes', async () => {
  const { calls, fetch } = recordingFetch(() => new Response(chunked([new Uint8Array([1, 2]), new Uint8Array([3])]).body));
  const result = await fetchDocxBytes('doc.docx', { fetch, baseUrl: 'https://host.test/dir/' });
  assert.deepEqual(result, { ok: true, value: new Uint8Array([1, 2, 3]) });
  assert.equal(calls[0]!.url, 'https://host.test/dir/doc.docx');
  assert.equal(calls[0]!.init?.credentials, 'same-origin');
  assert.ok(calls[0]!.init?.signal instanceof AbortSignal);
});

test('an advertised Content-Length above the ceiling is refused before reading', async () => {
  const stream = chunked([new Uint8Array([1])]);
  const { fetch } = recordingFetch(() => new Response(stream.body, { headers: { 'content-length': String(DOCX_LIMITS.inputBytes + 1) } }));
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', { fetch }), { ok: false, code: 'resource-limit' });
  assert.equal(stream.state.cancelled, 1, 'the unread body is cancelled');
});

test('a body that exceeds the ceiling without Content-Length is cancelled mid-stream', async () => {
  const big = new Uint8Array(1024 * 1024);
  const chunks = Array.from({ length: DOCX_LIMITS.inputBytes / big.byteLength + 4 }, () => big);
  const stream = chunked(chunks);
  const { fetch } = recordingFetch(() => new Response(stream.body));
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', { fetch }), { ok: false, code: 'resource-limit' });
  assert.equal(stream.state.cancelled, 1);
  assert.ok(stream.state.pulls < chunks.length, 'reading stops at the ceiling');
});

test('a body of hostile tiny chunks is refused at the chunk ceiling', async () => {
  const tiny = new Uint8Array(1);
  let pulls = 0, cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { pulls++; controller.enqueue(tiny); },
    cancel() { cancelled++; },
  }, { highWaterMark: 0 });
  const { fetch } = recordingFetch(() => new Response(body));
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', { fetch }), { ok: false, code: 'resource-limit' });
  assert.equal(cancelled, 1);
  assert.ok(pulls <= DOCX_REMOTE_LIMITS.chunks + 2);
});

test('a bodyless response is still bounded', async () => {
  const response = { ok: true, status: 200, url: '', body: null, headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(DOCX_LIMITS.inputBytes + 1) } as unknown as Response;
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', { fetch: (async () => response) as typeof globalThis.fetch }),
    { ok: false, code: 'resource-limit' });
  const small = { ...response, arrayBuffer: async () => new Uint8Array([7]).buffer } as unknown as Response;
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', { fetch: (async () => small) as typeof globalThis.fetch }),
    { ok: true, value: new Uint8Array([7]) });
});

test('HTTP errors, network failures and malformed responses fail closed without raw messages', async () => {
  const stream = chunked([new Uint8Array([1])]);
  const failures: (() => Promise<Response> | Response)[] = [
    () => new Response(stream.body, { status: 404, statusText: 'secret path not found' }),
    () => { throw new TypeError('network details'); },
    () => Promise.reject(new Error('private server message')),
    () => 'not a response' as unknown as Response,
    () => new Response(new ReadableStream({ pull(controller) { controller.error(new Error('reset by peer')); } })),
    () => ({ ok: true, status: 200, url: 'javascript:alert(1)', body: null, headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(1) }) as unknown as Response,
  ];
  for (const failure of failures) {
    const result = await fetchDocxBytes('https://x.test/a.docx', { fetch: (async () => failure()) as typeof globalThis.fetch });
    assert.deepEqual(result, { ok: false, code: 'fetch-failed' });
  }
  assert.equal(stream.state.cancelled, 1, 'an error body is cancelled unread');
});

test('an already-aborted signal never calls fetch', async () => {
  const { calls, fetch } = recordingFetch(() => new Response(new Uint8Array([1])));
  const controller = new AbortController(); controller.abort();
  assert.deepEqual(await fetchDocxBytes('https://x.test/a.docx', { fetch, signal: controller.signal }), { ok: false, code: 'aborted' });
  assert.equal(calls.length, 0);
});

test('aborting while the request or body is pending settles as aborted and cancels the body', async () => {
  const controller = new AbortController();
  let forwarded: AbortSignal | undefined;
  const pending = fetchDocxBytes('https://x.test/a.docx', { signal: controller.signal, fetch: ((_url: string, init?: RequestInit) => {
    forwarded = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  }) as typeof globalThis.fetch });
  controller.abort();
  assert.deepEqual(await pending, { ok: false, code: 'aborted' });
  assert.equal(forwarded?.aborted, true, 'the request itself is aborted');

  const body = new AbortController();
  let cancelled = 0, pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(stream) { pulls++; if (pulls === 1) { stream.enqueue(new Uint8Array([1])); body.abort(); } else stream.enqueue(new Uint8Array([2])); },
    cancel() { cancelled++; },
  }, { highWaterMark: 0 });
  const result = await fetchDocxBytes('https://x.test/a.docx', { signal: body.signal, fetch: (async () => new Response(stream)) as typeof globalThis.fetch });
  assert.deepEqual(result, { ok: false, code: 'aborted' });
  assert.equal(cancelled, 1);
});

test('a response that resolves after abort is discarded', async () => {
  const controller = new AbortController();
  const stream = chunked([new Uint8Array([1])]);
  const result = fetchDocxBytes('https://x.test/a.docx', { signal: controller.signal, fetch: (async () => {
    controller.abort();
    return new Response(stream.body);
  }) as typeof globalThis.fetch });
  assert.deepEqual(await result, { ok: false, code: 'aborted' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(stream.state.cancelled, 1);
});
