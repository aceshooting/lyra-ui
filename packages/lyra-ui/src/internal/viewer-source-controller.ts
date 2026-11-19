import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  isAbortError,
  readResponseArrayBuffer,
  readResponseText,
  resolveOwnerFetchTarget,
} from './resource-loader.js';

/** The element a {@link ViewerSourceController} serves. */
export type ViewerSourceHost = HTMLElement & ReactiveControllerHost;

/** Identifies one `begin()` call; pass it to {@link ViewerSourceController.isStale} after every await. */
export interface ViewerSourceToken {
  readonly generation: number;
  /** Aborted when a newer load begins or the host disconnects; undefined without an owner window. */
  readonly signal: AbortSignal | undefined;
  /** The browsing context that issued the request. */
  readonly view: Window & typeof globalThis;
}

/** `begin()` could not resolve the source through the shared URL gate (scheme, realm, connection). */
export class ViewerSourceUrlNotAllowedError extends Error {
  constructor() {
    super('The resource URL is not allowed.');
    this.name = 'ViewerSourceUrlNotAllowedError';
  }
}

/** A non-2xx response; the body is cancelled before this is thrown. */
export class ViewerSourceHttpError extends Error {
  constructor(readonly status: number, readonly statusText: string) {
    super(`${status} ${statusText}`);
    this.name = 'ViewerSourceHttpError';
  }
}

export interface ViewerSourceOptions {
  /** Consumes an ok response. Read it through the controller (or `resource-loader`) so the byte
   * ceiling applies, and call `isStale(token)` after every `await` before writing state. */
  load(response: Response, token: ViewerSourceToken): Promise<void>;
  /** Called for a current (not stale, not aborted) failure of the URL gate, the fetch or `load`. */
  onError(error: unknown, token: ViewerSourceToken): void;
  /** Byte ceiling for {@link ViewerSourceController.readArrayBuffer}/`readText`. */
  readonly maxBytes?: number;
}

/**
 * The fetch lifecycle every remote-source viewer repeats: gate the URL through the owner-realm
 * `safeFetchUrl` resolver, fetch with an abortable signal, cancel the response body on every early
 * exit (non-ok, stale, thrown), and expose one staleness predicate covering a newer generation, an
 * aborted signal, a disconnected host and a document move to another window.
 */
export class ViewerSourceController implements ReactiveController {
  private current = 0;
  private abortController: AbortController | undefined;

  constructor(
    private readonly host: ViewerSourceHost,
    private readonly options: ViewerSourceOptions,
  ) {
    host.addController(this);
  }

  /** The generation of the most recent `begin()`/`cancel()`. */
  get generation(): number {
    return this.current;
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this.cancel();
  }

  /** Invalidates and aborts any in-flight load without starting another. */
  cancel(): void {
    this.current += 1;
    this.abortController?.abort();
    this.abortController = undefined;
  }

  /** True once `token` was superseded, aborted, or its host disconnected or moved to another window. */
  isStale(token: ViewerSourceToken): boolean {
    return (
      token.generation !== this.current ||
      token.signal?.aborted === true ||
      !this.host.isConnected ||
      this.host.ownerDocument.defaultView !== token.view
    );
  }

  /** Reads the body under the byte ceiling; never uses the raw `arrayBuffer()`. */
  readArrayBuffer(response: Response, maxBytes = this.options.maxBytes): Promise<ArrayBuffer> {
    return readResponseArrayBuffer(response, maxBytes);
  }

  /** Reads the body as text under the byte ceiling. */
  readText(response: Response, maxBytes = this.options.maxBytes): Promise<string> {
    return readResponseText(response, maxBytes);
  }

  /**
   * Starts a load of `src`, superseding the previous one. An empty `src` only cancels. Resolves
   * after `load`/`onError` settle; a stale or aborted load never calls `onError`.
   */
  async begin(src: unknown): Promise<void> {
    this.cancel();
    if (src === undefined || src === null || src === '') return;
    const view = this.host.ownerDocument.defaultView;
    const generation = this.current;
    const controller = view ? new view.AbortController() : undefined;
    this.abortController = controller;
    const token: ViewerSourceToken = {
      generation,
      signal: controller?.signal,
      view: view as Window & typeof globalThis,
    };
    const target = resolveOwnerFetchTarget(this.host, src);
    if (!target) {
      this.options.onError(new ViewerSourceUrlNotAllowedError(), token);
      return;
    }
    let response: Response | undefined;
    try {
      response = await target.view.fetch(target.url, token.signal ? { signal: token.signal } : undefined);
      if (this.isStale({ ...token, view: target.view })) return;
      if (!response.ok) throw new ViewerSourceHttpError(response.status, response.statusText);
      await this.options.load(response, { ...token, view: target.view });
    } catch (error) {
      if (this.isStale(token) || isAbortError(error)) return;
      this.options.onError(error, token);
    } finally {
      discardBody(response);
    }
  }
}

/** Cancels an unread body so the connection is released; a consumed or absent body is a no-op. */
function discardBody(response: Response | undefined): void {
  if (!response?.body || response.bodyUsed) return;
  try {
    void response.body.cancel().catch(() => undefined);
  } catch {
    // A locked stream is already owned by a reader.
  }
}
