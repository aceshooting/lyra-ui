/**
 * Suppresses the browser's uncaught "ResizeObserver loop completed with undelivered notifications"
 * `ErrorEvent`.
 *
 * That message is a documented, universally-benign browser notice: it reports that observations
 * were still pending when a frame ended, not that application code looped or leaked. The test
 * harness, however, treats *any* uncaught page error as failing whichever test happens to be
 * running when it lands, so an unfiltered occurrence shows up as flake attributed to an unrelated
 * assertion -- and, because one uncaught error aborts the session, it can cascade into every later
 * test in the same file.
 *
 * `preventDefault()` on a *capturing* `error` listener suppresses only the browser's "report this
 * as an unhandled exception" step, and only for this one message. Every other uncaught error is
 * untouched and still fails its test exactly as before.
 *
 * Call once at module scope, passing the reason this particular file provokes the message.
 *
 * `src/performance.test.ts`, `components/viewers/archive-viewer/archive-viewer.test.ts` and
 * `components/retrieval/ingestion-queue/ingestion-queue.test.ts` keep their own inline listeners
 * rather than calling this: each documents a specific measurement campaign whose findings are
 * worth more in place than the deduplication would be worth.
 */
export function ignoreResizeObserverLoopErrors(_reason: string): void {
  window.addEventListener(
    'error',
    (e) => {
      if (typeof e.message === 'string' && e.message.includes('ResizeObserver loop')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}
