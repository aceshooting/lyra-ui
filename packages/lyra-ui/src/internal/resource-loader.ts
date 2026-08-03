import { safeFetchUrl } from './safe-url.js';

/** Default cap for remote resources before a viewer hands them to a parser. */
export const DEFAULT_MAX_RESOURCE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_MAX_TABLE_ROWS = 10_000;
export const DEFAULT_MAX_TABLE_COLUMNS = 1_000;

export class LyraResourceLimitError extends Error {
  constructor(message = 'The resource exceeds the configured size limit.') {
    super(message);
    this.name = 'LyraResourceLimitError';
  }
}

/** Marks a deliberately localized component message safe to show to users. */
export class LyraUserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LyraUserFacingError';
  }
}

/** A validated, absolute request URL paired with the browsing context that owns the requesting
 * element. Keeping the owner alongside the URL prevents an adopted element from accidentally
 * using the parent realm's `fetch()` after resolving against a different document's base URL. */
export interface OwnerFetchTarget {
  readonly url: string;
  readonly view: Window & typeof globalThis;
}

/** Resolves a consumer-supplied fetch source against an element's current owner document.
 *
 * The source is checked both before and after URL resolution: the first check rejects executable
 * or navigation-only schemes before they reach any URL sink, while the second preserves that
 * allowlist for the absolute result. A disconnected element or detached document has no active
 * resource lifecycle (and the latter has no meaningful fetch realm), so both deliberately fail
 * closed. */
export function resolveOwnerFetchTarget(
  element: Element,
  source: unknown,
): OwnerFetchTarget | null {
  if (!element.isConnected) return null;
  const view = element.ownerDocument.defaultView;
  if (!view || typeof view.fetch !== 'function') return null;
  const safeSource = safeFetchUrl(source, view.URL);
  if (safeSource === null) return null;

  try {
    const url = safeFetchUrl(
      new view.URL(safeSource, element.ownerDocument.baseURI).href,
      view.URL,
    );
    return url === null ? null : { url, view };
  } catch {
    return null;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

export function isResourceLimitError(error: unknown): boolean {
  return error instanceof LyraResourceLimitError;
}

function validateLimit(limit: number): number {
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_MAX_RESOURCE_BYTES;
}

/** Rejects tabular dimensions before the data is retained or rendered. */
export function assertTableDimensions(rowCount: number, columnCount: number, maxRows = DEFAULT_MAX_TABLE_ROWS, maxColumns = DEFAULT_MAX_TABLE_COLUMNS): void {
  if (rowCount > maxRows) throw new LyraResourceLimitError('The table contains too many rows.');
  if (columnCount > maxColumns) throw new LyraResourceLimitError('The table contains too many columns.');
}

/** Rejects parsed tabular data before it is retained or rendered. */
export function assertTableSize(rows: readonly unknown[][], maxRows = DEFAULT_MAX_TABLE_ROWS, maxColumns = DEFAULT_MAX_TABLE_COLUMNS): void {
  if (rows.length > maxRows) throw new LyraResourceLimitError('The table contains too many rows.');
  if (rows.some((row) => row.length > maxColumns)) throw new LyraResourceLimitError('The table contains too many columns.');
}

function checkContentLength(response: Response, limit: number): void {
  const headers = (response as Response & { headers?: Headers }).headers;
  const contentLength = Number(headers?.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > limit) throw new LyraResourceLimitError();
}

/** Reads a response with a hard cap, including when the server omits Content-Length. */
export async function readResponseArrayBuffer(response: Response, maxBytes = DEFAULT_MAX_RESOURCE_BYTES): Promise<ArrayBuffer> {
  const limit = validateLimit(maxBytes);
  checkContentLength(response, limit);
  if (!response.body) {
    const source = response as Response & { arrayBuffer?: () => Promise<ArrayBuffer>; text?: () => Promise<string> };
    const buffer = source.arrayBuffer
      ? await source.arrayBuffer()
      : new TextEncoder().encode(await source.text?.() ?? '').buffer;
    if (buffer.byteLength > limit) throw new LyraResourceLimitError();
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new LyraResourceLimitError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer;
}

export async function readResponseText(response: Response, maxBytes = DEFAULT_MAX_RESOURCE_BYTES): Promise<string> {
  return new TextDecoder().decode(await readResponseArrayBuffer(response, maxBytes));
}
