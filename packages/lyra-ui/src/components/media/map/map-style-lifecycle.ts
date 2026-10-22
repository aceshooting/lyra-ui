/** Peer events admitted by the owner for one connection and style generation. */
export type MapStyleLifecycleEvent = 'style-ready' | 'idle' | 'error';

/** Adapter between a peer's style events and restoration of component-owned overlays. */
export interface MapStyleLifecycleOptions {
  /** Register before mutation, returning an idempotent listener remover. */
  readonly subscribe: (event: MapStyleLifecycleEvent, listener: (error?: unknown) => void) => () => void;
  /** Optional style mutation; synchronous peer events are supported. */
  readonly mutate?: () => void;
  /** Probe after mutation for peers whose ready event has already fired. */
  readonly isStyleReady?: () => boolean;
  /** Probe only after owned restoration; absence requires a subsequent idle event. */
  readonly isIdle?: () => boolean;
  /** Restore overlays, rejecting on failure and observing cancellation after every await. */
  readonly restore: (signal: AbortSignal) => void | Promise<void>;
  /** Publish the current generation's restored style once. */
  readonly onStyleReady?: () => void;
  /** Publish the current generation's first idle after restoration once. */
  readonly onIdle?: () => void;
}

interface Readiness {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

function readiness(): Readiness {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  // Readiness is optional to consumers. A failure before anyone waits must not become an
  // unhandled rejection; callers still receive the original rejecting promise.
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

function cancelled(): DOMException {
  return new DOMException('Map style readiness was cancelled.', 'AbortError');
}

interface Generation {
  readonly options: MapStyleLifecycleOptions;
  readonly abort: AbortController;
  readonly ready: Readiness;
  readonly idle: Readiness;
  readonly listeners: Set<() => void>;
  started: boolean;
  restored: boolean;
  publishingReady: boolean;
  publishingIdle: boolean;
  idleObserved: boolean;
  finished: boolean;
}

/**
 * Readiness for the current owned style, including asynchronous overlay restoration.
 * The owner filters peer events to its connection/style and cancels before disposing the peer.
 * Idle means the first idle of that style, rather than a subscription to future gestures.
 */
export class MapStyleLifecycle {
  private generation?: Generation;
  private intent = 0;

  /** Supersede pending work, listen before mutating, and recognize already-ready peers. */
  begin(options: MapStyleLifecycleOptions): void {
    const intent = ++this.intent;
    this.cancelCurrent();
    // Aborting restoration can synchronously start a newer style. That newer request owns the
    // controller; the interrupted begin must not overwrite it or strand its listeners.
    if (intent !== this.intent) return;
    const generation: Generation = {
      options, abort: new AbortController(), ready: readiness(), idle: readiness(),
      listeners: new Set(), started: false, restored: false, publishingReady: false,
      publishingIdle: false, idleObserved: false, finished: false,
    };
    this.generation = generation;
    try {
      this.listen(generation, 'error', (error) => {
        this.reject(generation, error ?? new Error('Map style failed.'));
      });
      this.listen(generation, 'idle', () => {
        if (generation.restored) this.finishIdle(generation);
      });
      this.listen(generation, 'style-ready', () => { this.restore(generation); });
      if (!this.current(generation)) return;
      options.mutate?.();
      if (this.current(generation) && options.isStyleReady?.()) this.restore(generation);
    } catch (error) {
      this.reject(generation, error);
    }
  }

  /** Resolves after the current style's owned overlays have been restored. */
  whenStyleReady(): Promise<void> {
    return this.generation?.ready.promise ?? Promise.reject(cancelled());
  }

  /** Resolves at the current style's first idle following owned restoration. */
  whenIdle(): Promise<void> {
    return this.generation?.idle.promise ?? Promise.reject(cancelled());
  }

  /** Report an owner-side failure for the current generation. */
  fail(error: unknown): void {
    if (this.generation) this.reject(this.generation, error);
  }

  /** Abort pending restoration and release listeners on disconnect or supersession. */
  cancel(): void {
    this.intent += 1;
    this.cancelCurrent();
  }

  private cancelCurrent(): void {
    const generation = this.generation;
    this.generation = undefined;
    if (!generation) return;
    generation.abort.abort();
    this.reject(generation, cancelled());
  }

  private current(generation: Generation): boolean {
    return this.generation === generation && !generation.finished && !generation.abort.signal.aborted;
  }

  private listen(generation: Generation, event: MapStyleLifecycleEvent, listener: (error?: unknown) => void): void {
    if (!this.current(generation)) return;
    const dispose = generation.options.subscribe(event, (error) => {
      if (this.current(generation)) listener(error);
    });
    if (this.current(generation)) generation.listeners.add(dispose);
    else dispose();
  }

  private cleanup(generation: Generation): void {
    for (const dispose of generation.listeners) {
      try { dispose(); } catch { /* Listener cleanup must not prevent other subscriptions closing. */ }
    }
    generation.listeners.clear();
  }

  private reject(generation: Generation, error: unknown): void {
    if (generation.finished) return;
    generation.finished = true;
    generation.abort.abort();
    this.cleanup(generation);
    generation.ready.reject(error);
    generation.idle.reject(error);
  }

  private restore(generation: Generation): void {
    if (!this.current(generation) || generation.started) return;
    generation.started = true;
    // A microtask also lets begin() finish installing subscriptions before a synchronous restore
    // can publish callbacks that re-enter begin() or cancel().
    void Promise.resolve().then(async () => {
      if (!this.current(generation)) return;
      await generation.options.restore(generation.abort.signal);
      if (!this.current(generation)) return;
      generation.restored = true;
      generation.publishingReady = true;
      generation.options.onStyleReady?.();
      generation.publishingReady = false;
      if (!this.current(generation)) return;
      generation.ready.resolve();
      if (generation.idleObserved || generation.options.isIdle?.()) this.finishIdle(generation);
    }).catch((error: unknown) => {
      if (this.current(generation)) this.reject(generation, error);
    });
  }

  private finishIdle(generation: Generation): void {
    if (!this.current(generation) || !generation.restored || generation.publishingIdle) return;
    if (generation.publishingReady) {
      generation.idleObserved = true;
      return;
    }
    generation.publishingIdle = true;
    try {
      generation.options.onIdle?.();
      if (!this.current(generation)) return;
      generation.finished = true;
      this.cleanup(generation);
      generation.idle.resolve();
    } catch (error) {
      this.reject(generation, error);
    }
  }
}
