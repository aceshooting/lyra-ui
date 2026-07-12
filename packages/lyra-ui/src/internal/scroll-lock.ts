const counts = new WeakMap<Document, number>();
const previousOverflow = new WeakMap<Document, string>();
const previousPadding = new WeakMap<Document, string>();

/**
 * Ref-counted scroll lock, scoped to a given `Document` (defaults to the
 * caller's own top-level `document`) so it also works for content rendered
 * inside an iframe or any other document the caller explicitly passes.
 * Compensates for the removed scrollbar's width with inline-end padding on
 * the root element, so locking scroll doesn't shift page content
 * horizontally the instant the scrollbar disappears — restored to its prior
 * value once the last outstanding lock releases. Safe when a lock is
 * acquired and released more than once concurrently (e.g. a fast
 * open/close/open sequence).
 */
export function lockScroll(doc: Document = document): () => void {
  const root = doc.documentElement;
  const count = counts.get(doc) ?? 0;
  if (count === 0) {
    previousOverflow.set(doc, root.style.overflow);
    previousPadding.set(doc, root.style.paddingInlineEnd);
    const scrollbarWidth = (doc.defaultView?.innerWidth ?? 0) - root.clientWidth;
    root.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const currentPadding = parseFloat(getComputedStyle(root).paddingInlineEnd) || 0;
      root.style.paddingInlineEnd = `${currentPadding + scrollbarWidth}px`;
    }
  }
  counts.set(doc, count + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (counts.get(doc) ?? 1) - 1;
    counts.set(doc, remaining);
    if (remaining === 0) {
      root.style.overflow = previousOverflow.get(doc) ?? '';
      root.style.paddingInlineEnd = previousPadding.get(doc) ?? '';
    }
  };
}
