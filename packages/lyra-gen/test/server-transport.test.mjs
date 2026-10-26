import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setImmediate } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

// Set the override to exercise the example inside an isolated installed tarball.
const example = process.env.LYRA_GEN_TRANSPORT_EXAMPLE
  ? pathToFileURL(process.env.LYRA_GEN_TRANSPORT_EXAMPLE)
  : new URL('../examples/server-transport.mjs', import.meta.url);
const { AnswerTransportError, createAnswerHandler, requestAnswer, runInProcessDemo } = await import(example.href);
const catalog = { id: 'transport-test', version: '1', components: { text: { tag: 'p', properties: {}, text: true } } };
const view = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'answer', revision: 0, root: { id: 'text', type: 'text', text: 'Answer' } };
const context = { catalog, surfaceId: 'answer', revision: 0 };
const endpoint = 'https://example.invalid/answer';
const request = (body = JSON.stringify({ question: 'A question' }), signal) => new Request(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal });
const handler = overrides => createAnswerHandler({ ...context, authorize: async () => true, generate: async () => ({ value: view, tokensUsed: 0 }), ...overrides });
const client = overrides => requestAnswer({ ...context, endpoint, question: 'A question', ...overrides });
const json = body => new Response(body, { headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve; let reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };

test('the executable fake-provider example works without any external request', async () => {
  const demo = await runInProcessDemo();
  assert.equal(demo.demo, 'in-process fake provider');
  assert.equal(demo.providerTokens, 0);
  assert.equal(demo.view.root.text, 'Deterministic fake answer.');
  const printed = execFileSync(process.execPath, [fileURLToPath(example)], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(printed), demo);
});

test('server and client agree on the reviewed catalog, host identity and actual usage', async () => {
  let calls = 0;
  const answer = handler({ generate: async input => {
    calls++;
    assert.equal(input.maxTokens, 2048);
    assert.equal(input.question, 'A question');
    assert.equal(input.surfaceId, 'answer');
    assert.equal(input.revision, 0);
    assert.ok(input.prompt.includes(catalog.id));
    assert.equal(typeof input.schema, 'object');
    assert.equal(input.signal.aborted, false);
    return { value: view, tokensUsed: 7 };
  } });
  const result = await client({ fetchImpl: answer });
  assert.deepEqual(result, view);
  assert.equal(Object.isFrozen(result.root), true);
  assert.equal(calls, 1);
});

test('authorization, method, type and malformed bounded requests never invoke the provider', async () => {
  let calls = 0;
  const generate = async () => { calls++; return { value: view, tokensUsed: 0 }; };
  assert.equal((await handler({ generate, authorize: async () => false })(request())).status, 403);
  const answer = handler({ generate });
  assert.equal((await answer(new Request(endpoint))).status, 405);
  assert.equal((await answer(new Request(endpoint, { method: 'POST', body: '{}' }))).status, 415);
  for (const source of ['{', '{"question":"one","question":"two"}', '{"question":"ok","catalog":"other"}', JSON.stringify({ question: '' }), JSON.stringify({ question: 'x'.repeat(9000) })]) {
    assert.equal((await answer(request(source))).status, 400);
  }
  assert.equal(calls, 0);
});

test('provider usage, catalog, identity, schema and execution failures fail closed without details', async () => {
  for (const tokensUsed of [undefined, -1, 0.5, Infinity, 2049]) {
    assert.equal((await handler({ generate: async () => ({ value: view, tokensUsed }) })(request())).status, 502);
  }
  for (const value of [
    { ...view, catalog: { id: 'other', version: '1' } },
    { ...view, surfaceId: 'other' }, { ...view, revision: 1 },
    { ...view, root: { ...view.root, type: 'script' } },
    { ...view, root: { ...view.root, props: { onclick: 'run()' } } },
  ]) assert.equal((await handler({ generate: async () => ({ value, tokensUsed: 0 }) })(request())).status, 422);
  let reads = 0;
  const accessor = await handler({ generate: async () => ({ value: view, get tokensUsed() { reads++; return 0; } }) })(request());
  assert.equal(accessor.status, 502);
  assert.equal(reads, 0);
  const failed = await handler({ generate: async () => { throw new Error('Credential or provider detail.'); } })(request());
  assert.equal(failed.status, 502);
  assert.equal(await failed.text(), '{"error":"provider"}');
});

test('server deadlines and request cancellation bound ignored provider or authorization work', async () => {
  let providerSignal;
  const timed = await handler({ timeoutMs: 10, generate: async input => { providerSignal = input.signal; return new Promise(() => {}); } })(request());
  assert.equal(timed.status, 504);
  assert.equal(providerSignal.aborted, true);
  const permission = deferred();
  const entered = deferred();
  const controller = new AbortController();
  let calls = 0;
  const active = handler({ authorize: async () => { entered.resolve(); return permission.promise; }, generate: async () => { calls++; return { value: view, tokensUsed: 0 }; } })(request(undefined, controller.signal));
  await entered.promise;
  controller.abort();
  assert.equal((await active).status, 408);
  permission.resolve(true);
  await setImmediate();
  assert.equal(calls, 0);
});

test('client holds a complete-looking JSON prefix until EOF and decodes split UTF-8 safely', async () => {
  const text = JSON.stringify({ ...view, root: { ...view.root, text: 'Answer 🌍' } });
  let streamController;
  const body = new ReadableStream({ start(controller) { streamController = controller; } });
  let settled = false;
  const active = client({ fetchImpl: async () => json(body) });
  void active.then(() => { settled = true; }, () => { settled = true; });
  for (const byte of new TextEncoder().encode(text)) streamController.enqueue(new Uint8Array([byte]));
  await setImmediate();
  assert.equal(settled, false);
  streamController.close();
  assert.equal((await active).root.text, 'Answer 🌍');
});

test('client rejects HTTP, content type, identity, malformed, truncated and invalid UTF-8 responses', async () => {
  for (const response of [
    new Response('Provider detail', { status: 503 }), new Response('{}'),
    json(JSON.stringify({ ...view, surfaceId: 'other' })), json(JSON.stringify({ ...view, revision: 2 })),
    json(JSON.stringify({ ...view, catalog: { id: 'wrong', version: '1' } })),
    json(JSON.stringify(view).slice(0, -1)), json(`${JSON.stringify(view)}{}`),
    json(new Uint8Array([0xc3, 0x28])),
  ]) await assert.rejects(client({ fetchImpl: async () => response }), error => error instanceof AnswerTransportError && !error.message.includes('Provider detail'));
  await assert.rejects(client({ fetchImpl: async () => { throw new Error('Private network detail.'); } }), error => error instanceof AnswerTransportError && error.code === 'transport');
});

test('client byte limits cancel the response body rather than retaining its unbounded tail', async () => {
  let canceled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(view))); }, cancel() { canceled = true; } });
  await assert.rejects(client({ maxBytes: 10, fetchImpl: async () => json(body) }), error => error.code === 'bytes');
  assert.equal(canceled, true);
});

test('client cancellation and deadlines reject ignored fetches and dispose late response bodies', async () => {
  const pending = deferred();
  const entered = deferred();
  const controller = new AbortController();
  let fetchSignal;
  const active = client({ signal: controller.signal, fetchImpl: async input => { fetchSignal = input.signal; entered.resolve(); return pending.promise; } });
  await entered.promise;
  controller.abort();
  await assert.rejects(active, error => error.code === 'aborted');
  assert.equal(fetchSignal.aborted, true);
  let canceled = false;
  pending.resolve(json(new ReadableStream({ cancel() { canceled = true; } })));
  await setImmediate();
  assert.equal(canceled, true);
  await assert.rejects(client({ timeoutMs: 10, fetchImpl: async () => new Promise(() => {}) }), error => error.code === 'timeout');
});

test('already aborted requests perform no authorization, provider or client fetch work', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const answer = handler({ authorize: async () => { calls++; return true; } });
  assert.equal((await answer(request(undefined, controller.signal))).status, 408);
  await assert.rejects(client({ signal: controller.signal, fetchImpl: async () => { calls++; return json(JSON.stringify(view)); } }), error => error.code === 'aborted');
  assert.equal(calls, 0);
});

test('invalid client questions are rejected before serialization or Fetch', async () => {
  let calls = 0;
  let serialized = 0;
  for (const question of ['', 'x'.repeat(2001), { toJSON() { serialized++; return 'unexpected'; } }]) {
    await assert.rejects(client({ question, fetchImpl: async () => { calls++; return json(JSON.stringify(view)); } }), error => error.code === 'request');
  }
  assert.equal(calls, 0);
  assert.equal(serialized, 0);
});

test('server refusals cancel unread request producers without consuming them', async () => {
  for (const scenario of ['method', 'content-type', 'denied', 'authorization-error', 'aborted']) {
    let canceled = 0;
    let pulls = 0;
    const body = new ReadableStream({ pull() { pulls++; }, cancel() { canceled++; } }, { highWaterMark: 0 });
    const controller = new AbortController();
    if (scenario === 'aborted') controller.abort();
    const input = new Request(endpoint, { method: scenario === 'method' ? 'DELETE' : 'POST',
      headers: { 'content-type': scenario === 'content-type' ? 'text/plain' : 'application/json' },
      body, duplex: 'half', signal: controller.signal });
    const answer = handler({ authorize: () => {
      if (scenario === 'authorization-error') throw new Error('Private authorization detail.');
      return false;
    } });
    const expected = { method: 405, 'content-type': 415, denied: 403, 'authorization-error': 502, aborted: 408 };
    assert.equal((await answer(input)).status, expected[scenario], scenario);
    assert.equal(canceled, 1, `${scenario}: unread producer was not canceled`);
    assert.equal(pulls, 0, `${scenario}: refused body was consumed`);
  }
});

test('server refusal does not wait for a nonsettling producer cancellation hook', { timeout: 2000 }, async () => {
  let canceled = false;
  const body = new ReadableStream({ cancel() { canceled = true; return new Promise(() => {}); } }, { highWaterMark: 0 });
  const input = new Request(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' });
  assert.equal((await handler({ authorize: () => false })(input)).status, 403);
  assert.equal(canceled, true);
});

test('producer cancellation failures do not replace refusal responses or leak rejections', async () => {
  for (const cancel of [() => { throw new Error('Producer cancellation detail.'); },
    () => Promise.reject(new Error('Producer cancellation detail.'))]) {
    const input = request();
    let calls = 0;
    Object.defineProperty(input, 'body', { value: { cancel() { calls++; return cancel(); } } });
    assert.equal((await handler({ authorize: () => false })(input)).status, 403);
    assert.equal(calls, 1);
    await setImmediate();
  }
});

test('client cleanup failures preserve the HTTP or content-type refusal', async () => {
  for (const status of [200, 503]) for (const fail of [
    () => { throw new Error('Producer cleanup detail.'); },
    () => Promise.reject(new Error('Producer cleanup detail.')),
  ]) {
    let canceled = 0;
    const response = new Response(null, { status });
    Object.defineProperty(response, 'body', { value: { cancel() { canceled++; return fail(); } } });
    await assert.rejects(client({ fetchImpl: async () => response }), error =>
      error instanceof AnswerTransportError && error.code === (status === 200 ? 'content-type' : 'http') && error.status === status);
    assert.equal(canceled, 1);
    await setImmediate();
  }
});
