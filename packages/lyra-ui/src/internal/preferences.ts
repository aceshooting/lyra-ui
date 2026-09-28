import { flattenedThemeParent } from './theme-observation.js';

/** Reads the nearest valid preference along the same inheritance path as CSS custom properties. */
export function inheritedPreference(element: Element | undefined, attribute: string, enhanced: string): string {
  for (let current = element; current;) {
    const value = current.getAttribute(attribute);
    if (value === enhanced || value === 'system') return value;
    // Lit's server element shim has attributes without a browser-owned tree.
    current = (typeof current.getRootNode === 'function' ? flattenedThemeParent(current) : current.parentElement) ?? undefined;
  }
  return 'system';
}

/** A missing browsing context has no known operating-system preference. */
export function preferenceMediaMatches(view: Window | null | undefined, query: string): boolean {
  return !!view?.matchMedia?.(query).matches;
}
