import {
  collectComposedFocusTargets,
  focusFirstAvailable,
  isComposedFocusAvailable,
} from './focus-navigation.js';
import { deepActiveElementIn } from './active-element.js';
import { composedContains } from './composed-tree.js';

function holdsFocus(host: HTMLElement): boolean {
  const active = deepActiveElementIn(host.ownerDocument);
  return active !== null && composedContains(host, active);
}

/**
 * Finishes a focus repair after something that may have removed, hid or disabled the focused
 * control. `hadFocus` is whether focus was inside `host` beforehand (see `preserveFocusAcross`).
 * A no-op when it was not, when the focused control survives, or when focus has since moved to an
 * unrelated element on purpose. Otherwise focus moves to `fallback`, then the first available
 * focus target inside `host`, then `host` itself when it can take focus.
 */
export function restoreComposedFocus(
  host: HTMLElement,
  hadFocus: boolean,
  fallback?: HTMLElement | null,
): void {
  if (!hadFocus) return;
  const doc = host.ownerDocument;
  const active = deepActiveElementIn(doc);
  const lost = active === null || active === doc.body || active === doc.documentElement;
  if (!lost) {
    if (!composedContains(host, active)) return;
    if (isComposedFocusAvailable(active)) return;
  }
  const inside = collectComposedFocusTargets(host, { includeRoot: false, mode: 'programmatic' }).elements;
  focusFirstAvailable([fallback, ...inside, host]);
}

/** Runs `mutate` (disable, hide or remove a control) and, when focus was inside `host` beforehand
 *  and the mutation stranded it, moves focus to `fallback()` or a surviving target. Focus
 *  elsewhere is untouched. For a render that commits later, capture with the same check and call
 *  `restoreComposedFocus` after `updateComplete`. */
export function preserveFocusAcross(
  host: HTMLElement,
  mutate: () => void,
  fallback?: () => HTMLElement | null,
): void {
  const hadFocus = holdsFocus(host);
  mutate();
  restoreComposedFocus(host, hadFocus, hadFocus ? fallback?.() : null);
}
