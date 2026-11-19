/**
 * Guarded pointer capture and the single post-drag click suppressor.
 *
 * A synthetic pointer id, a pointer that ended during dispatch, or an element that left the
 * document makes `setPointerCapture()` throw `NotFoundError`; the gesture must carry on without
 * capture rather than abort half-initialised.
 */

/** Captures `id` on `el`; returns whether capture is held. Never throws. */
export function capturePointer(el: Element, id: number): boolean {
  try {
    el.setPointerCapture?.(id);
    return el.hasPointerCapture?.(id) ?? false;
  } catch {
    return false;
  }
}

/** Releases capture of `id` on `el` when held. Never throws. */
export function releasePointer(el: Element, id: number): void {
  try {
    if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
  } catch {
    // Capture can disappear between the check and the release.
  }
}

/** Calls `setPointerCapture(id)` and reports whether the native call returned without throwing,
 *  without probing `hasPointerCapture` (a gesture that admits on the call itself). Never throws. */
export function trySetPointerCapture(el: Element, id: number): boolean {
  try {
    if (typeof el.setPointerCapture !== 'function') return false;
    el.setPointerCapture(id);
    return true;
  } catch {
    return false;
  }
}

/** Always attempts `releasePointerCapture(id)`, with no `hasPointerCapture` probe. Never throws. */
export function tryReleasePointerCapture(el: Element, id: number): void {
  try {
    el.releasePointerCapture?.(id);
  } catch {
    // Releasing a pointer that is not captured (or already gone) throws NotFoundError.
  }
}

interface Suppression {
  keys: Set<string>;
  timer: number;
}

const DEFAULT_KEY = '';
const suppressions = new WeakMap<Window, Suppression>();

function clear(win: Window, key: string, state: Suppression): void {
  state.keys.delete(key);
  if (state.keys.size > 0) return;
  win.clearTimeout(state.timer);
  if (suppressions.get(win) === state) suppressions.delete(win);
}

/**
 * Arms suppression of the click a finished drag synthesises. It clears itself after one task
 * (`setTimeout(0)`), so a drag released where no click follows cannot swallow a later genuine
 * click. Returns a disposer, safe to call repeatedly, for `disconnectedCallback`.
 */
export function armClickSuppression(win: Window, key: string = DEFAULT_KEY): () => void {
  let state = suppressions.get(win);
  if (state) win.clearTimeout(state.timer);
  else {
    state = { keys: new Set(), timer: 0 };
    suppressions.set(win, state);
  }
  const armed = state;
  armed.keys.add(key);
  armed.timer = win.setTimeout(() => {
    armed.keys.clear();
    if (suppressions.get(win) === armed) suppressions.delete(win);
  }, 0);
  return () => {
    if (suppressions.get(win) === armed) clear(win, key, armed);
  };
}

/**
 * Consumes one armed suppression for the event's window (limited to `key` when given). Returns
 * true, after stopping the event, exactly once per arming.
 */
export function consumeSuppressedClick(event: Event, key?: string): boolean {
  const target = event.target as { ownerDocument?: Document | null } | null;
  const win = target?.ownerDocument?.defaultView ?? (event as UIEvent).view ?? null;
  const state = win ? suppressions.get(win) : undefined;
  if (!win || !state) return false;
  const hit = key === undefined ? state.keys.values().next().value : state.keys.has(key) ? key : undefined;
  if (hit === undefined) return false;
  clear(win, hit, state);
  event.stopImmediatePropagation();
  event.preventDefault();
  return true;
}
