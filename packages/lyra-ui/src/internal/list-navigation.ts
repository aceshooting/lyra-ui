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

/** Whether a keydown belongs to an input method composition (or carries the legacy 229 marker). */
function isComposingKey(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}

/** Whether a keydown was already claimed by an earlier listener or belongs to a composition. Text
 *  editing keys use this where Alt, Ctrl or Meta are part of the key's own meaning. */
export function isHandledOrComposingKey(event: KeyboardEvent): boolean {
  return event.defaultPrevented || isComposingKey(event);
}

/** Navigation yields to a key an earlier listener already claimed (`preventDefault()`), to
 *  composition, and to browser or system shortcuts. */
export function shouldIgnoreNavigationKey(event: KeyboardEvent): boolean {
  return event.defaultPrevented || isModifiedOrComposingKey(event);
}

/** Composition or an Alt/Ctrl/Meta chord, without the already-handled check: for key helpers a
 *  handler calls after it has claimed the key itself. */
export function isModifiedOrComposingKey(event: KeyboardEvent): boolean {
  return isComposingKey(event) || event.altKey || event.ctrlKey || event.metaKey;
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
  // The caller owns the already-handled check: many claim the key (`preventDefault()`) before
  // resolving where it moves.
  if (typeof event !== 'string' && isModifiedOrComposingKey(event)) return null;
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
 *  ancestors are checked across shadow boundaries. A widget that lives inside a container with
 *  its own transient hidden/inert phase (a popup still waiting to be positioned) passes itself as
 *  `boundary`: the walk stops after that element, so the widget can still settle its roving stop
 *  while the container is between states and the container focuses it once it is shown. */
export function isRovingTargetAvailable(element: HTMLElement | SVGElement, boundary?: Element): boolean {
  if ('disabled' in element && Boolean(element.disabled)) return false;
  if (element.getAttribute('aria-disabled') === 'true' || element.getAttribute('aria-hidden') === 'true') return false;
  for (let node: Element | null = element; node; node = composedParentElement(node)) {
    if (node.hasAttribute('hidden') || node.hasAttribute('inert')) return false;
    if (node === boundary) break;
  }
  return !('hidden' in element && element.hidden);
}

/**
 * Availability of a catalog option a picker projects from its light DOM into its own rendered
 * rows. Authored `hidden`/`inert` between the option and `owner` count; the owner's internal
 * hidden data slot does not (it hides every projected option). Inert on the owner or any composed
 * ancestor still excludes it.
 */
export function isCatalogOptionAvailable(option: HTMLElement, owner: Element): boolean {
  if ('disabled' in option && Boolean(option.disabled)) return false;
  if (option.getAttribute('aria-disabled') === 'true') return false;
  for (let node: Element | null = option; node && node !== owner; node = node.parentElement) {
    if (node.hasAttribute('hidden') || node.hasAttribute('inert')) return false;
  }
  for (let node: Element | null = owner; node; node = composedParentElement(node)) {
    if (node.hasAttribute('inert')) return false;
  }
  return true;
}
