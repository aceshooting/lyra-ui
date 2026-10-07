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

/** Resolves a list's next index without owning its focus, selection, or activation policy. */
export function resolveListMove(event: KeyboardEvent | string, options: ListMoveOptions): number | null {
  if (typeof event !== 'string' &&
      (event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey)) return null;
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

/** Common availability baseline; callers may add widget-specific guards. */
export function isRovingTargetAvailable(element: HTMLElement): boolean {
  return !('disabled' in element && Boolean(element.disabled)) &&
    element.getAttribute('aria-disabled') !== 'true' &&
    element.getAttribute('aria-hidden') !== 'true' &&
    !element.hidden &&
    !element.closest('[hidden], [inert]');
}
