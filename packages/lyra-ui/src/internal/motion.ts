/** Whether the user has requested reduced motion at the OS/browser level
 * (`prefers-reduced-motion: reduce`). Guards `typeof window`/`matchMedia`
 * so it's safe to call during SSR or in environments without a `window`.
 *
 * `view` scopes the query to one browsing context — pass an element's own
 * `ownerDocument.defaultView` when the element may live in another document,
 * whose media state can differ from the top-level window's. A `null`/omitted
 * `view` falls back to the global `window`. */
export function prefersReducedMotion(view?: Window | null): boolean {
  const target = view ?? (typeof window !== 'undefined' ? window : null);
  return !!target?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
