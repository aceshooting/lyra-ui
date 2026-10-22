import { MapStyleLifecycle, type MapStyleLifecycleOptions } from './map-style-lifecycle.js';

export interface MapReadinessOptions extends Omit<MapStyleLifecycleOptions, 'subscribe' | 'onIdle' | 'onStyleReady' | 'isIdle'> {
  readonly subscribe: (event: 'style-ready' | 'idle' | 'busy' | 'error', listener: () => void) => () => void;
  /** Undefined means that this peer requires a new idle event as evidence. */
  readonly isIdle?: () => boolean | undefined;
  readonly ownerPending: () => boolean;
  readonly onStyleReady: (generation: number) => void;
  readonly onIdle: (generation: number) => void;
  readonly onError?: (styleWasReady: boolean) => void;
}

interface Waiter {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

function waiter(): Waiter {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

function aborted(): DOMException {
  return new DOMException('Map readiness was cancelled.', 'AbortError');
}

function failed(): Error {
  const error = new Error('Map readiness failed.');
  error.name = 'MapReadinessError';
  return error;
}

interface Generation {
  readonly id: number;
  readonly ready: Waiter;
  readonly idle: Set<Waiter>;
  readonly disposers: Set<() => void>;
  options?: MapReadinessOptions;
  restorationComplete: boolean;
  restored: boolean;
  epoch: number;
  observedEpoch: number;
  publishedEpoch: number;
  queued: boolean;
  error?: Error;
}

/** A style barrier plus reusable idle waits for the owner's current work, not its first idle. */
export class MapReadiness {
  private readonly style = new MapStyleLifecycle();
  private generation?: Generation;
  private intent = 0;

  /** Start a pending connection/style before asynchronous construction or mutation. */
  reset(): void {
    const id = ++this.intent;
    this.close(aborted());
    if (this.intent !== id) return;
    this.generation = { id, ready: waiter(), idle: new Set(), disposers: new Set(),
      restorationComplete: false, restored: false, epoch: 0, observedEpoch: -1, publishedEpoch: -1, queued: false };
  }

  /** Attach the current style. Busy/error/idle listeners remain after its first idle. */
  bind(options: MapReadinessOptions): void {
    const generation = this.generation;
    if (!generation || generation.error || generation.options) return;
    generation.options = options;
    try {
      this.listen(generation, 'error', () => { this.fail(); });
      this.listen(generation, 'busy', () => { this.invalidate(); });
      this.listen(generation, 'idle', () => {
        if (generation.restorationComplete && !options.ownerPending()) generation.observedEpoch = generation.epoch;
        this.check();
      });
      if (!this.current(generation)) return;
      this.style.begin({
        ...options,
        subscribe: (event, listener) => options.subscribe(event, () => {
          if (this.current(generation)) listener();
        }),
        isIdle: () => options.isIdle?.() === true,
        onStyleReady: () => {
          if (!this.current(generation)) return;
          generation.restorationComplete = true;
          this.check();
        },
        // This first-idle barrier releases its own listeners. The owner observation above stays.
        onIdle: () => { this.check(); },
      });
      void this.style.whenStyleReady().catch(() => {
        if (this.current(generation)) this.fail();
      });
    } catch {
      if (this.current(generation)) this.fail();
    }
  }

  whenStyleReady(): Promise<void> {
    return this.generation?.ready.promise ?? Promise.reject(aborted());
  }

  whenIdle(): Promise<void> {
    const generation = this.generation;
    if (!generation) return Promise.reject(aborted());
    if (generation.error) return Promise.reject(generation.error);
    const next = waiter();
    generation.idle.add(next);
    this.check();
    return next.promise;
  }

  /** Invalidate even a previously resolved idle whenever camera, source or owner work starts. */
  invalidate(): void {
    const generation = this.generation;
    if (!generation || generation.error) return;
    generation.epoch += 1;
    generation.observedEpoch = -1;
  }

  /** Re-probe after owner work finishes; settlement rechecks its generation and work epoch. */
  check(): void {
    const generation = this.generation;
    if (!generation || !this.current(generation) || generation.queued || !generation.restorationComplete) return;
    const options = generation.options;
    if (!options) return;
    generation.queued = true;
    queueMicrotask(() => {
      generation.queued = false;
      if (!this.current(generation)) return;
      try {
        // Work can start in the microtask between restoration finishing and its continuation.
        // Defer publication until that newer owner work has also completed.
        if (options.ownerPending()) return;
        if (!generation.restored) {
          generation.restored = true;
          options.onStyleReady(generation.id);
          if (!this.current(generation)) return;
          generation.ready.resolve();
        }
        const epoch = generation.epoch;
        const idle = (): boolean => {
          if (options.ownerPending()) return false;
          const probe = options.isIdle?.();
          return probe === undefined ? generation.observedEpoch === epoch : probe;
        };
        if (!idle() || !this.current(generation) || generation.epoch !== epoch) return;
        if (generation.publishedEpoch !== epoch) {
          generation.publishedEpoch = epoch;
          options.onIdle(generation.id);
        }
        // Event listeners can remove the map, replace its style or start preparation/movement.
        if (!this.current(generation) || generation.epoch !== epoch || !idle()) return;
        for (const pending of generation.idle) pending.resolve();
        generation.idle.clear();
      } catch {
        if (this.current(generation)) this.fail();
      }
    });
  }

  /** Peer and owner failures never expose caught messages through readiness promises. */
  fail(): void {
    const generation = this.generation;
    if (!generation || generation.error) return;
    generation.error = failed();
    this.style.fail(generation.error);
    this.cleanup(generation);
    generation.ready.reject(generation.error);
    for (const pending of generation.idle) pending.reject(generation.error);
    generation.idle.clear();
    if (this.generation === generation) generation.options?.onError?.(generation.restored);
  }

  cancel(): void {
    this.intent += 1;
    this.close(aborted());
  }

  private current(generation: Generation): boolean {
    return generation === this.generation && !generation.error;
  }

  private listen(generation: Generation, event: 'idle' | 'busy' | 'error', callback: () => void): void {
    if (!this.current(generation)) return;
    const dispose = generation.options!.subscribe(event, () => {
      if (this.current(generation)) callback();
    });
    if (this.current(generation)) generation.disposers.add(dispose);
    else dispose();
  }

  private cleanup(generation: Generation): void {
    for (const dispose of generation.disposers) {
      try { dispose(); } catch { /* Other subscriptions must still be released. */ }
    }
    generation.disposers.clear();
  }

  private close(error: Error): void {
    const previous = this.generation;
    this.generation = undefined;
    this.style.cancel();
    if (!previous) return;
    this.cleanup(previous);
    previous.ready.reject(error);
    for (const pending of previous.idle) pending.reject(error);
    previous.idle.clear();
  }
}
