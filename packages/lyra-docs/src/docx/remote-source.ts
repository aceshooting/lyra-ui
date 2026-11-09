import { DOCX_LIMITS } from './commands.js';
import { ownDataRecord } from './own-data-record.js';
import type { DocxResult } from './types.js';

/**
 * Remote document bounds. The byte ceiling equals the DOCX input ceiling, so every accepted
 * response can still be refused only by admission. The chunk ceiling bounds per-read work for a
 * hostile stream of tiny chunks.
 */
export const DOCX_REMOTE_LIMITS: Readonly<{ bytes: number; chunks: number }> = Object.freeze({
  bytes: DOCX_LIMITS.inputBytes, chunks: 65_536,
});

/** Options for {@link fetchDocxBytes}. */
export interface DocxFetchOptions {
  /** Cancels the request and any body read; the result is then `aborted`. */
  readonly signal?: AbortSignal;
  /** Absolute web base for a relative URL. Defaults to the global `location`, when one exists. */
  readonly baseUrl?: string;
  /** The requesting realm's `fetch`. Defaults to `globalThis.fetch`. */
  readonly fetch?: typeof globalThis.fetch;
}

// The same resource allowlist as the core library's fetch gate: data and blob URLs stay inert as
// data, while navigation-only and executable schemes are refused before any request exists.
const fetchSchemes = new Set(['http:', 'https:', 'blob:', 'data:']);
const parseBase = 'https://lyra.invalid/';

function scheme(url: string): string | null {
  try { return new URL(url, parseBase).protocol; }
  catch { return null; }
}

/**
 * Returns an absolute URL that is safe to fetch, or null. The source is checked before resolution,
 * so an executable scheme never reaches a URL sink, and again after resolution against `base`.
 * Relative input needs an absolute web base.
 */
function safeDocxFetchUrl(url: unknown, base: string | undefined): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  const raw = trimmed && scheme(trimmed);
  if (!raw || !fetchSchemes.has(raw)) return null;
  try {
    const absolute = new URL(trimmed, base === undefined ? undefined : new URL(base)).href;
    return fetchSchemes.has(new URL(absolute).protocol) ? absolute : null;
  } catch { return null; }
}

const refused = (code: 'invalid-option' | 'aborted' | 'fetch-failed' | 'resource-limit'): DocxResult<never> =>
  Object.freeze({ ok: false, code });

class ReadRefusal extends Error {
  constructor(readonly code: 'aborted' | 'fetch-failed' | 'resource-limit') { super(code); }
}

/** Settles with the promise, or rejects as aborted as soon as the signal aborts. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new ReadRefusal('aborted'));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new ReadRefusal('aborted'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); },
      (error: unknown) => { signal.removeEventListener('abort', abort); reject(error); });
  });
}

function cancelBody(response: Response): void {
  try { void response.body?.cancel().catch(() => {}); }
  catch { /* A locked or foreign body has nothing more to release here. */ }
}

async function readBounded(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const limit = DOCX_REMOTE_LIMITS.bytes;
  const advertised = Number(response.headers?.get('content-length'));
  if (Number.isFinite(advertised) && advertised > limit) {
    cancelBody(response);
    throw new ReadRefusal('resource-limit');
  }
  if (!response.body) {
    const buffer = await untilAborted(response.arrayBuffer(), signal);
    if (!(buffer instanceof ArrayBuffer)) throw new ReadRefusal('fetch-failed');
    if (buffer.byteLength > limit) throw new ReadRefusal('resource-limit');
    return new Uint8Array(buffer.slice(0));
  }
  const reader = response.body.getReader();
  let output = new Uint8Array(0), total = 0, chunks = 0;
  const stop = async (code: ReadRefusal['code']): Promise<never> => {
    try { await reader.cancel(); }
    catch { /* The refusal stays authoritative when cancellation also fails. */ }
    throw new ReadRefusal(code);
  };
  try {
    while (true) {
      let next: ReadableStreamReadResult<Uint8Array>;
      try { next = await untilAborted(reader.read(), signal); }
      catch (error) { return await stop(error instanceof ReadRefusal ? error.code : 'fetch-failed'); }
      if (signal.aborted) return await stop('aborted');
      if (next.done) break;
      const value = next.value;
      if (!(value instanceof Uint8Array)) return await stop('fetch-failed');
      if (++chunks > DOCX_REMOTE_LIMITS.chunks) return await stop('resource-limit');
      const size = total + value.byteLength;
      if (size > limit) return await stop('resource-limit');
      if (size > output.byteLength) {
        let capacity = Math.max(output.byteLength, Math.min(limit, Math.max(1024, value.byteLength)));
        while (capacity < size) capacity = Math.min(limit, Math.max(size, capacity * 2));
        const grown = new Uint8Array(capacity);
        grown.set(output.subarray(0, total));
        output = grown;
      }
      // Copy before the next read: a producer may reuse its view after read() settles.
      output.set(value, total);
      total = size;
    }
  } finally {
    try { reader.releaseLock(); }
    catch { /* Released by cancellation already. */ }
  }
  return output.slice(0, total);
}

/**
 * Fetch DOCX bytes for `open()` under the shared remote-content rules: a scheme allowlist checked
 * before and after resolution, a 16 MiB byte ceiling enforced from Content-Length and while
 * streaming, a chunk ceiling, and cancellation. Only `fetch()` is used, with same-origin
 * credentials; the bytes still pass DOCX admission when opened. Results never carry server or
 * network messages: failures are `invalid-option` (unsafe URL or options), `aborted`,
 * `resource-limit`, or `fetch-failed` (network, non-OK status, or malformed response).
 */
export async function fetchDocxBytes(url: string, options: DocxFetchOptions = {}): Promise<DocxResult<Uint8Array>> {
  const checked = ownDataRecord(options);
  if (!checked || Object.keys(checked).some(key => key !== 'signal' && key !== 'baseUrl' && key !== 'fetch')) return refused('invalid-option');
  const { signal, baseUrl, fetch: fetcher = globalThis.fetch } = checked as DocxFetchOptions;
  if ((signal !== undefined && !(signal instanceof AbortSignal)) || (baseUrl !== undefined && typeof baseUrl !== 'string') ||
    typeof fetcher !== 'function') return refused('invalid-option');
  const base = baseUrl ?? (globalThis as { location?: { href?: unknown } }).location?.href;
  const target = safeDocxFetchUrl(url, typeof base === 'string' ? base : undefined);
  if (target === null) return refused('invalid-option');
  if (signal?.aborted) return refused('aborted');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let response: Response | undefined;
  try {
    let candidate: unknown;
    try {
      const request = Promise.resolve(fetcher(target, { signal: controller.signal, credentials: 'same-origin' }));
      // A response that arrives after cancellation is released unread.
      request.then(late => { if (controller.signal.aborted && late && typeof late === 'object') cancelBody(late); }, () => {});
      candidate = await untilAborted(request, controller.signal);
    } catch { return refused(controller.signal.aborted ? 'aborted' : 'fetch-failed'); }
    if (!candidate || typeof candidate !== 'object') return refused('fetch-failed');
    response = candidate as Response;
    if (typeof response.arrayBuffer !== 'function') { cancelBody(response); return refused('fetch-failed'); }
    if (controller.signal.aborted) { cancelBody(response); return refused('aborted'); }
    // A redirect cannot leave the allowlist in a browser; check anyway so a foreign fetch cannot either.
    const final = typeof response.url === 'string' && response.url ? scheme(response.url) : null;
    if (!response.ok || (final !== null && !fetchSchemes.has(final))) { cancelBody(response); return refused('fetch-failed'); }
    try { return Object.freeze({ ok: true, value: await readBounded(response, controller.signal) }); }
    catch (error) { return refused(controller.signal.aborted ? 'aborted' : error instanceof ReadRefusal ? error.code : 'fetch-failed'); }
  } catch {
    if (response) cancelBody(response);
    return refused(controller.signal.aborted ? 'aborted' : 'fetch-failed');
  } finally {
    signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}
