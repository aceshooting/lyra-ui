/** Whether the user has requested reduced motion at the OS/browser level
 * (`prefers-reduced-motion: reduce`). Guards `typeof window`/`matchMedia`
 * so it's safe to call during SSR or in environments without a `window`. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
