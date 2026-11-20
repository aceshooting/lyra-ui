import { inheritedPreference, preferenceMediaMatches } from './preferences.js';

/** Whether motion should be reduced for an element's inherited preference and browsing context.
 * A local `system` scope resumes following the OS; it never overrides OS-level reduction.
 * Passing a Window retains the context-only query. Omitting the target is safe during SSR. */
export function prefersReducedMotion(target?: Element | Window | null): boolean {
  const element = target && typeof (target as Element).getAttribute === 'function' ? target as Element : undefined;
  const view = element ? element.ownerDocument?.defaultView : target as Window | null | undefined;
  return inheritedPreference(element, 'data-lr-motion', 'reduce') === 'reduce' ||
    preferenceMediaMatches(view ?? (element ? null : typeof window === 'undefined' ? null : window), '(prefers-reduced-motion: reduce)');
}

/** The scroll behavior for a programmatic scroll: `requested` normally, and `'instant'` when motion
 * is reduced. Never `'auto'` there, which defers to the scroller's computed `scroll-behavior` and so
 * still animates under a stylesheet that sets `scroll-behavior: smooth`. */
export function motionScrollBehavior(
  target: Element | Window | null | undefined,
  requested: ScrollBehavior = 'smooth',
): ScrollBehavior {
  return prefersReducedMotion(target) ? 'instant' : requested;
}
