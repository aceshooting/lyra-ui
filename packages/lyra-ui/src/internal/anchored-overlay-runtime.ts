import type {
  AnchoredSurfaceSession,
  PlaceStrategy,
  placeAnchoredSurface,
  placeAnchoredSurfaceSession,
  releaseTopLayer,
  trackRect,
} from './positioner.js';

/** The positioning capability loaded on the first anchored surface open. */
export interface AnchoredOverlayRuntime {
  /** `placeAnchoredSurface()` in the default runtime: `place()` plus the top-layer escape. */
  place: typeof placeAnchoredSurface;
  /** Retained geometry updates; optional for injected runtimes implementing only `place()`. */
  placeSession?: typeof placeAnchoredSurfaceSession;
  trackRect: typeof trackRect;
  /** Releases a top-layer promotion explicitly, for a surface that stops being an overlay without
   *  settling through `[hidden]`. Optional so injected test runtimes stay valid. */
  releaseTopLayer?: typeof releaseTopLayer;
}

type AnchoredOverlayRuntimeLoader = () => Promise<AnchoredOverlayRuntime>;
export type DeferredOperationHandle = (() => void) & { ready: Promise<boolean> };
export type DeferredPlacementSession = DeferredOperationHandle & Pick<AnchoredSurfaceSession, 'invalidate' | 'update' | 'isActive'>;

const defaultRuntimeLoader: AnchoredOverlayRuntimeLoader = () =>
  import('./positioner.js').then((runtime) => ({
    place: runtime.placeAnchoredSurface,
    placeSession: runtime.placeAnchoredSurfaceSession,
    trackRect: runtime.trackRect,
    releaseTopLayer: runtime.releaseTopLayer,
  }));
let runtimeLoader = defaultRuntimeLoader;
let runtimePromise: Promise<AnchoredOverlayRuntime> | undefined;

/** Loads and caches the positioning runtime shared by every deferred anchored surface. */
export function loadAnchoredOverlayRuntime(): Promise<AnchoredOverlayRuntime> {
  if (runtimePromise) return runtimePromise;
  const pending: Promise<AnchoredOverlayRuntime> = runtimeLoader().catch((error: unknown) => {
    if (runtimePromise === pending) runtimePromise = undefined;
    throw error;
  });
  return (runtimePromise = pending);
}

type PendingVisibility = readonly [value: string, priority: string];

const activePlacementByPopup = new WeakMap<HTMLElement, () => void>();

function concealPendingPopup(popup: HTMLElement, strategy: PlaceStrategy | undefined): PendingVisibility {
  activePlacementByPopup.get(popup)?.();
  // The runtime chunk loads asynchronously, so until the first placement pass writes it the popup
  // would sit at its stylesheet `position: absolute` baseline, laid out at an unresolved origin
  // inside whichever ancestor scroller it lives in -- widening that scroller for the frames before
  // placement, or for the whole fade when the surface closes before placement ran. Claim the
  // resolved strategy now, exactly as place() will, and never revert it on dispose.
  popup.style.position = strategy ?? 'fixed';
  const pending: PendingVisibility = [
    popup.style.visibility,
    popup.style.getPropertyPriority('visibility'),
  ];
  popup.style.setProperty('visibility', 'hidden', 'important');
  return pending;
}

function releasePendingPopup(popup: HTMLElement, pending: PendingVisibility): void {
  const [value, priority] = pending;
  if (
    popup.style.visibility !== 'hidden' ||
    popup.style.getPropertyPriority('visibility') !== 'important'
  ) {
    return;
  }
  popup.style.setProperty('visibility', value, priority);
}

/** Starts positioning after the shared runtime chunk resolves and remains synchronously disposable. */
export function deferredPlace(...args: Parameters<typeof placeAnchoredSurface>): () => void {
  const [anchor, popup, options = {}] = args;
  const pendingVisibility = concealPendingPopup(popup, options.strategy);
  let active = true;
  let cleanup: (() => void) | undefined;
  let positioned = false;

  const dispose = (): void => {
    if (!active) return;
    active = false;
    activePlacementByPopup.delete(popup);
    cleanup?.();
    releasePendingPopup(popup, pendingVisibility);
  };
  activePlacementByPopup.set(popup, dispose);

  void loadAnchoredOverlayRuntime().then((runtime) => {
    if (!active) return;
    try {
      cleanup = runtime.place(anchor, popup, {
        ...options,
        onPlaced: (result) => {
          if (!active) return;
          if (!positioned) {
            positioned = true;
            releasePendingPopup(popup, pendingVisibility);
          }
          options.onPlaced?.(result);
        },
      });
    } catch {
      // A deferred caller has no failure channel. Keep the surface concealed and let a later
      // generation retry, just as when the runtime chunk itself cannot load.
    }
  }, () => undefined);

  return dispose;
}

/** Adds first-placement readiness for callers whose open lifecycle must wait for real geometry. */
export function deferredPlaceReady(
  ...args: Parameters<typeof placeAnchoredSurface>
): DeferredOperationHandle {
  const [anchor, popup, options = {}] = args;
  const pendingVisibility = concealPendingPopup(popup, options.strategy);
  let active = true;
  let cleanup: (() => void) | undefined;
  let settle: ((value: boolean) => void) | undefined;
  const ready = new Promise<boolean>((resolve) => {
    settle = resolve;
  });

  const dispose = (() => {
    if (!active) return;
    active = false;
    activePlacementByPopup.delete(popup);
    cleanup?.();
    releasePendingPopup(popup, pendingVisibility);
    settle?.(false);
  }) as DeferredOperationHandle;
  activePlacementByPopup.set(popup, dispose);

  void loadAnchoredOverlayRuntime()
    .then((runtime) => {
      if (!active) return;
      try {
        cleanup = runtime.place(anchor, popup, {
          ...options,
          onPlaced: (result) => {
            if (!active) return;
            if (settle) {
              releasePendingPopup(popup, pendingVisibility);
              settle(true);
              settle = undefined;
            }
            options.onPlaced?.(result);
          },
        });
      } catch {
        settle?.(false);
      }
    }, () => settle?.(false));

  dispose.ready = ready;
  return dispose;
}

/** Defers one retained placement session, including invalidation while its runtime is loading. */
export function deferredPlaceSession(
  ...args: Parameters<typeof placeAnchoredSurface>
): DeferredPlacementSession {
  const [anchor, popup, options = {}] = args;
  const pendingVisibility = concealPendingPopup(popup, options.strategy);
  let active = true, suspended = false, starting = false, failed = false;
  let generation = 0;
  let runtime: AnchoredOverlayRuntime | undefined;
  let cleanup: (() => void) | undefined;
  let retained: AnchoredSurfaceSession | undefined;
  let settle: ((value: boolean) => void) | undefined;
  const ready = new Promise<boolean>(resolve => { settle = resolve; });
  const finish = (value: boolean): void => { settle?.(value); settle = undefined; };

  const dispose = (): void => {
    if (!active) return;
    active = false;
    if (activePlacementByPopup.get(popup) === dispose) activePlacementByPopup.delete(popup);
    const stop = cleanup; cleanup = undefined; retained = undefined;
    stop?.();
    releasePendingPopup(popup, pendingVisibility);
    finish(false);
  };
  activePlacementByPopup.set(popup, dispose);

  const start = (propagateFailure = false): void => {
    if (!active || suspended || starting || failed || cleanup || !runtime) return;
    const installed = generation, capability = runtime.placeSession;
    starting = true;
    try {
      const placementOptions: Parameters<typeof placeAnchoredSurface>[2] = {
        ...options,
        onPlaced: result => {
          if (!active || suspended || !capability && installed !== generation) return;
          if (settle) { releasePendingPopup(popup, pendingVisibility); finish(true); }
          options.onPlaced?.(result);
        },
      };
      const next = capability ? capability.call(runtime, anchor, popup, placementOptions) : runtime.place(anchor, popup, placementOptions);
      if (!active) { next(); return; }
      cleanup = next;
      retained = capability ? next as AnchoredSurfaceSession : undefined;
      // An injected runtime may publish synchronously and let that callback replace the request.
      if (suspended || installed !== generation) {
        if (retained) retained.invalidate();
        else { cleanup = undefined; next(); }
      }
    } catch (error) {
      failed = true; finish(false);
      if (propagateFailure) throw error;
    } finally { starting = false; }
    if (active && !suspended && installed !== generation) {
      if (retained) retained.update();
      else start(propagateFailure);
    }
  };

  const operation: DeferredPlacementSession = Object.assign(dispose, {
    ready,
    // A retained runtime may fail closed after its first successful publication. Read its live
    // lifetime rather than treating first-placement readiness as a permanent health signal.
    isActive(): boolean { return active && !failed && (retained?.isActive() ?? true); },
    invalidate(): void {
      if (!active) return;
      suspended = true; generation++;
      if (retained) retained.invalidate();
      else { const stop = cleanup; cleanup = undefined; stop?.(); }
    },
    update(): void {
      if (!active) return;
      suspended = false;
      if (retained) retained.update();
      else start(true);
    },
  });
  void loadAnchoredOverlayRuntime().then(value => { runtime = value; start(); }, () => { failed = true; finish(false); });
  return operation;
}

/** Waits for the current placement generation; a replacement supersedes a cancelled handle. */
export async function waitForDeferredPlacement(
  current: () => DeferredOperationHandle | undefined,
): Promise<boolean> {
  let operation: DeferredOperationHandle | undefined;
  while ((operation = current())) {
    const positioned = await operation.ready;
    // A superseded placement cannot satisfy a newer open, even when its first onPlaced callback
    // settled successfully before the waiting transition resumed.
    if (operation !== current()) continue;
    if (positioned) return true;
    return false;
  }
  return true;
}

/** Waits for the next paint and the popup's current animations without settling a superseded open. */
export async function awaitPopupAnimations(
  host: HTMLElement,
  popup: () => Element | null,
  isCurrent: () => boolean,
): Promise<boolean> {
  const ownerDocument = host.ownerDocument;
  if (!isCurrent()) return false;
  if (!host.isConnected) return true;
  const view = ownerDocument.defaultView;
  if (view) await new Promise<void>(resolve => view.requestAnimationFrame(() => resolve()));
  if (host.ownerDocument !== ownerDocument || !isCurrent()) return false;
  const animations = popup()?.getAnimations({ subtree: true }) ?? [];
  await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
  return host.ownerDocument === ownerDocument && isCurrent();
}

/** Shared show/hide ordering; hosts keep their own veto, placement-failure and event policies. */
export async function settlePopupTransition(options: {
  host: HTMLElement & { readonly updateComplete: Promise<unknown> };
  popup: () => Element | null;
  isCurrent: () => boolean;
  waitForPosition?: () => Promise<boolean>;
  conceal?: () => void;
  onSettled: () => void;
}): Promise<void> {
  const { host, isCurrent } = options;
  const ownerDocument = host.ownerDocument;
  const current = (): boolean => host.ownerDocument === ownerDocument && isCurrent();
  await host.updateComplete;
  if (!current()) return;
  if (options.waitForPosition) {
    if (!await options.waitForPosition() || !current()) return;
    await host.updateComplete;
    if (!current()) return;
  }
  if (!await awaitPopupAnimations(host, options.popup, current)) return;
  if (options.conceal) {
    options.conceal();
    await host.updateComplete;
    if (!current()) return;
  }
  options.onSettled();
}

/** Resolves superseded show/hide callers without emitting a stale lifecycle event. */
export class PopupTransitionWaiters<EventName extends string> {
  readonly #waiters = new Map<EventName, Set<() => void>>();

  wait(event: EventName): Promise<void> {
    return new Promise<void>(resolve => {
      const waiters = this.#waiters.get(event) ?? new Set<() => void>();
      waiters.add(resolve);
      this.#waiters.set(event, waiters);
    });
  }

  resolve(event: EventName): void {
    const waiters = this.#waiters.get(event);
    if (!waiters) return;
    this.#waiters.delete(event);
    for (const resolve of waiters) resolve();
  }
}

/** Starts raw-rect tracking after the shared runtime chunk resolves and remains disposable. */
export function deferredTrackRect(...args: Parameters<typeof trackRect>): () => void {
  let active = true;
  let cleanup: (() => void) | undefined;
  void loadAnchoredOverlayRuntime()
    .then((runtime) => {
      if (active) cleanup = runtime.trackRect(...args);
    })
    .catch(() => undefined);
  return () => {
    active = false;
    cleanup?.();
    cleanup = undefined;
  };
}

/** @internal Replaces and clears the cached loader for deterministic deferred-runtime tests. */
export function __setAnchoredOverlayRuntimeLoaderForTesting(
  loader: AnchoredOverlayRuntimeLoader | undefined,
): void {
  runtimeLoader = loader ?? defaultRuntimeLoader;
  runtimePromise = undefined;
}

/**
 * The placement options of an opt-in `top-layer` surface: a top-layer popup lays out against the
 * viewport, so it is always placed `fixed`, whatever strategy the surface otherwise resolves to.
 */
export function topLayerPlacement(
  topLayer: boolean,
  strategy: PlaceStrategy,
): { strategy: PlaceStrategy; topLayer: boolean } {
  return { strategy: topLayer ? 'fixed' : strategy, topLayer };
}

/**
 * Placement never demotes on its own, so a surface whose `topLayer` was just switched off calls
 * this before re-placing to release the forced promotion; the next run promotes again only if an
 * ancestor traps the popup. A caller placing synchronously with an already loaded runtime must
 * pass it here, so the release precedes that placement. Returns the flag for the next call.
 */
export function syncTopLayerRelease(
  popup: HTMLElement,
  wasPromoted: boolean | undefined,
  topLayer: boolean,
  runtime?: AnchoredOverlayRuntime,
): boolean {
  if (wasPromoted && !topLayer) {
    if (runtime) {
      runtime.releaseTopLayer?.(popup);
      return topLayer;
    }
    void loadAnchoredOverlayRuntime().then(
      (runtime) => runtime.releaseTopLayer?.(popup),
      () => undefined,
    );
  }
  return topLayer;
}
