/** Node 22 Fetch API example. The executable demo uses no network or model provider. */
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { initialCatalog, subsetCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { createJsonViewStream } from '@aceshooting/lyra-gen/json-stream.js';
import { buildCatalogPrompt, exportCatalogJsonSchema } from '@aceshooting/lyra-gen/prompts.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';
import { parseJson, snapshotJson } from '@aceshooting/lyra-gen/schema.js';

export class AnswerTransportError extends Error {
  constructor(code, status = 0) {
    super('The generated answer is unavailable.');
    this.name = 'AnswerTransportError';
    this.code = code;
    this.status = status;
  }
}
const bound = (value, fallback, ceiling) => Number.isSafeInteger(value) && value > 0 ? Math.min(value, ceiling) : fallback;
const unavailable = (code, status) => new Response(JSON.stringify({ error: code }), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const jsonType = response => /^application\/json(?:\s*;|$)/iu.test(response.headers.get('content-type') ?? '');

function cancelBody(body) {
  // A producer's cleanup must not delay a refusal or replace its response with an exception.
  try { void body?.cancel().catch(() => {}); } catch { /* Best-effort cleanup, including locked bodies. */ }
}

/** Race ignored cancellation too; a late provider/fetch rejection remains handled. */
async function bounded(signal, timeoutMs, work) {
  const controller = new AbortController();
  let expired = false;
  const deadline = performance.now() + timeoutMs;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => { expired = true; controller.abort(); }, timeoutMs);
  let stop;
  const canceled = new Promise((_, reject) => {
    stop = () => reject(new AnswerTransportError(expired ? 'timeout' : 'aborted'));
    controller.signal.addEventListener('abort', stop, { once: true });
  });
  try {
    if (controller.signal.aborted) throw new AnswerTransportError('aborted');
    const check = () => {
      if (performance.now() >= deadline) { expired = true; controller.abort(); }
      if (controller.signal.aborted) throw new AnswerTransportError(expired ? 'timeout' : 'aborted');
    };
    return await Promise.race([Promise.resolve().then(async () => {
      check();
      const result = await work(controller.signal, check);
      check();
      return result;
    }), canceled]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', stop);
  }
}

async function readBody(body, signal, maxBytes, onText, check) {
  if (!body) throw new AnswerTransportError('body');
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    check();
    for (;;) {
      const chunk = await reader.read();
      check();
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array)) throw new AnswerTransportError('encoding');
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new AnswerTransportError('bytes');
      onText(decoder.decode(chunk.value, { stream: true }));
    }
    onText(decoder.decode());
  } catch (error) {
    cancel();
    throw error instanceof AnswerTransportError || signal.aborted ? error : new AnswerTransportError('encoding');
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

/** Host options own catalog, identity, authorization and provider execution. */
export function createAnswerHandler(options) {
  const { catalog, surfaceId, revision, authorize, generate } = options;
  const maxRequestBytes = bound(options.maxRequestBytes, 8192, 8192);
  const maxResponseBytes = bound(options.maxResponseBytes, 65_536, 262_144);
  const maxTokens = bound(options.maxTokens, 2048, 16_384);
  const timeoutMs = bound(options.timeoutMs, 5000, 60_000);
  return async request => {
    try {
      if (request.method !== 'POST') return unavailable('method', 405);
      if (!jsonType(request)) return unavailable('content-type', 415);
      return await bounded(request.signal, timeoutMs, async (signal, check) => {
        if (await authorize(request, signal) !== true) throw new AnswerTransportError('authorization', 403);
        check();
        let source = '';
        await readBody(request.body, signal, maxRequestBytes, text => { source += text; }, check);
        check();
        const parsed = parseJson(source, { maxBytes: maxRequestBytes });
        const input = parsed.ok ? parsed.value : undefined;
        if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(key => key !== 'question') || typeof input.question !== 'string' || !input.question.trim() || input.question.length > 2000) throw new AnswerTransportError('request', 400);
        const generated = await generate({
          prompt: buildCatalogPrompt(catalog), schema: exportCatalogJsonSchema(catalog),
          question: input.question, surfaceId, revision, maxTokens, signal,
        });
        check();
        const admitted = snapshotJson(generated, { maxBytes: maxResponseBytes });
        if (!admitted.ok || !admitted.value || typeof admitted.value !== 'object' || Array.isArray(admitted.value)) throw new AnswerTransportError('provider-response', 502);
        const result = admitted.value;
        if (!Number.isSafeInteger(result.tokensUsed) || result.tokensUsed < 0 || result.tokensUsed > maxTokens) throw new AnswerTransportError('usage', 502);
        const checked = validateView(result.value, catalog, { limits: { maxBytes: maxResponseBytes } });
        if (!checked.ok || checked.value.surfaceId !== surfaceId || checked.value.revision !== revision) throw new AnswerTransportError('view', 422);
        check();
        return new Response(JSON.stringify(checked.value), {
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
        });
      });
    } catch (error) {
      if (error instanceof AnswerTransportError) return unavailable(error.code, error.status || (error.code === 'timeout' ? 504 : error.code === 'aborted' ? 408 : 400));
      return unavailable(request.signal.aborted ? 'aborted' : 'provider', request.signal.aborted ? 408 : 502);
    } finally {
      cancelBody(request.body);
    }
  };
}

/** The client independently admits the complete bytes; it never returns a partial view. */
export async function requestAnswer(options) {
  const { catalog, endpoint, question, surfaceId, revision, signal } = options;
  if (typeof question !== 'string' || !question.trim() || question.length > 2000) throw new AnswerTransportError('request', 400);
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = bound(options.maxBytes, 65_536, 262_144);
  const timeoutMs = bound(options.timeoutMs, 5000, 60_000);
  return bounded(signal, timeoutMs, async (activeSignal, check) => {
    check();
    const response = await fetchImpl(new Request(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }), signal: activeSignal,
    }));
    try { check(); } catch (error) {
      cancelBody(response.body);
      throw error;
    }
    if (!response.ok || !jsonType(response)) {
      cancelBody(response.body);
      throw new AnswerTransportError(response.ok ? 'content-type' : 'http', response.status);
    }
    const parser = createJsonViewStream({ catalog, limits: { maxBytes } });
    try {
      await readBody(response.body, activeSignal, maxBytes, text => {
        const partial = parser.push(text);
        if (partial.status === 'error') throw new AnswerTransportError('view');
      }, check);
      check();
      const result = parser.finish();
      if (result.status !== 'complete' || !result.view || result.view.surfaceId !== surfaceId || result.view.revision !== revision) throw new AnswerTransportError('view');
      return result.view;
    } catch (error) {
      parser.cancel();
      throw error;
    }
  }).catch(error => {
    if (error instanceof AnswerTransportError) throw error;
    throw new AnswerTransportError(signal?.aborted ? 'aborted' : 'transport');
  });
}

/** Deterministic synthetic provider and in-process Fetch adapter; not a provider benchmark. */
export async function runInProcessDemo() {
  const selected = subsetCatalog(initialCatalog, ['text']);
  if (!selected.ok) throw new Error('The example catalog is unavailable.');
  const catalog = selected.value;
  const surfaceId = 'transport-demo';
  const revision = 0;
  const handler = createAnswerHandler({
    catalog, surfaceId, revision,
    authorize: async () => true, // Demo only: replace with the application's current viewer policy.
    generate: async () => ({
      value: { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId, revision,
        root: { id: 'answer', type: 'text', text: 'Deterministic fake answer.' } },
      tokensUsed: 0, // No provider or tokenizer ran.
    }),
  });
  const view = await requestAnswer({
    catalog, surfaceId, revision, endpoint: 'https://example.invalid/answer', question: 'Show the transport example.',
    fetchImpl: request => handler(request),
  });
  return { demo: 'in-process fake provider', providerTokens: 0, view };
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(await runInProcessDemo(), null, 2));
}
