import type { place, trackRect } from './positioner.js';

/** The positioning capability loaded on the first anchored surface open. */
export interface AnchoredOverlayRuntime {
  place: typeof place;
  trackRect: typeof trackRect;
}

type AnchoredOverlayRuntimeLoader = () => Promise<AnchoredOverlayRuntime>;
export type DeferredOperationHandle = (() => void) & { ready: Promise<boolean> };

const defaultRuntimeLoader: AnchoredOverlayRuntimeLoader = () => import('./positioner.js');
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

function concealPendingPopup(popup: HTMLElement): PendingVisibility {
  activePlacementByPopup.get(popup)?.();
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
export function deferredPlace(...args: Parameters<typeof place>): () => void {
  const [anchor, popup, options = {}] = args;
  const pendingVisibility = concealPendingPopup(popup);
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
export function deferredPlaceReady(...args: Parameters<typeof place>): DeferredOperationHandle {
  const [anchor, popup, options = {}] = args;
  const pendingVisibility = concealPendingPopup(popup);
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

/** Waits for the current placement generation; a replacement supersedes a cancelled handle. */
export async function waitForDeferredPlacement(
  current: () => DeferredOperationHandle | undefined,
): Promise<boolean> {
  let operation: DeferredOperationHandle | undefined;
  while ((operation = current())) {
    if (await operation.ready) return true;
    if (operation === current()) return false;
  }
  return true;
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
