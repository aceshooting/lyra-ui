import { composedParentElement } from './active-element.js';

export interface ListMoveOptions {
  count: number;
  current: number;
  orientation: 'horizontal' | 'vertical' | 'both';
  direction?: 'ltr' | 'rtl';
  wrap?: boolean;
  /** Keep the nearest available edge selected when a nonwrapping arrow reaches it. */
  clamp?: boolean;
  isAvailable?: (index: number) => boolean;
  /** Some nonwrapping strips enter at the first item even on a backward arrow. */
  backwardFromMissing?: 'first' | 'last';
}

/** Navigation yields to composition and to browser or system shortcuts. */
export function shouldIgnoreNavigationKey(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey;
}

/** Whether a keydown is the browser's auto-repeat of a held key. */
export function isRepeatedActivationKey(event: KeyboardEvent): boolean {
  return event.repeat === true;
}

/** One guard for a one-shot Enter/Space/Arrow activation: composition and browser or system
 *  shortcuts (see `shouldIgnoreNavigationKey`) plus auto-repeat, so a held key activates once. */
export function shouldIgnoreActivationKey(event: KeyboardEvent): boolean {
  return shouldIgnoreNavigationKey(event) || isRepeatedActivationKey(event);
}

/** Resolves a list's next index without owning its focus, selection, or activation policy. */
export function resolveListMove(event: KeyboardEvent | string, options: ListMoveOptions): number | null {
  if (typeof event !== 'string' && shouldIgnoreNavigationKey(event)) return null;
  const key = typeof event === 'string' ? event : event.key;
  const { count, current, orientation, direction = 'ltr', wrap = true } = options;
  if (!Number.isSafeInteger(count) || count <= 0) return null;
  const available = options.isAvailable ?? (() => true);
  const horizontal = orientation !== 'vertical';
  const vertical = orientation !== 'horizontal';
  const forward = (horizontal && key === (direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight')) ||
    (vertical && key === 'ArrowDown');
  const backward = (horizontal && key === (direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft')) ||
    (vertical && key === 'ArrowUp');
  if (key === 'Home' || key === 'End') {
    const step = key === 'Home' ? 1 : -1;
    for (let index = key === 'Home' ? 0 : count - 1; index >= 0 && index < count; index += step) {
      if (available(index)) return index;
    }
    return null;
  }
  if (!forward && !backward) return null;
  const step = forward ? 1 : -1;
  const validCurrent = Number.isSafeInteger(current) && current >= 0 && current < count;
  const start = validCurrent ? current : forward ? -1 : options.backwardFromMissing === 'first' ? 1 : count;
  for (let offset = 1; offset <= count; offset++) {
    const raw = start + step * offset;
    if (!wrap && (raw < 0 || raw >= count)) {
      if (options.clamp) {
        if (validCurrent) return available(current) ? current : null;
        for (let edge = step > 0 ? count - 1 : 0; edge >= 0 && edge < count; edge -= step) {
          if (available(edge)) return edge;
        }
      }
      break;
    }
    const index = ((raw % count) + count) % count;
    if (available(index)) return index;
  }
  return null;
}

/** Common availability baseline; callers may add widget-specific guards. Hidden and inert
 *  ancestors are checked across shadow boundaries. */
export function isRovingTargetAvailable(element: HTMLElement): boolean {
  if ('disabled' in element && Boolean(element.disabled)) return false;
  if (element.getAttribute('aria-disabled') === 'true' || element.getAttribute('aria-hidden') === 'true') return false;
  for (let node: Element | null = element; node; node = composedParentElement(node)) {
    if (node.hasAttribute('hidden') || node.hasAttribute('inert')) return false;
  }
  return !element.hidden;
}
