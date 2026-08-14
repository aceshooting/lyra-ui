import {
  leaseInlineStyleProperty,
  type InlineStylePropertyLease,
} from './style-property-lease.js';

interface ScrollLockState {
  count: number;
  overflow: InlineStylePropertyLease;
  padding?: InlineStylePropertyLease;
}

const states = new WeakMap<Document, ScrollLockState>();

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
  let state = states.get(doc);
  if (!state) {
    const view = doc.defaultView;
    const scrollbarWidth = (view?.innerWidth ?? 0) - root.clientWidth;
    const overflow = leaseInlineStyleProperty(root, 'overflow', 'hidden');
    let padding: InlineStylePropertyLease | undefined;
    if (scrollbarWidth > 0 && view) {
      const currentPadding = parseFloat(view.getComputedStyle(root).paddingInlineEnd) || 0;
      padding = leaseInlineStyleProperty(
        root,
        'padding-inline-end',
        `${currentPadding + scrollbarWidth}px`,
        '',
        () => {
          const externalPadding = parseFloat(view.getComputedStyle(root).paddingInlineEnd) || 0;
          return { value: `${externalPadding + scrollbarWidth}px` };
        },
      );
    }
    state = { count: 0, overflow, padding };
    states.set(doc, state);
  }
  state.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = states.get(doc);
    if (!current) return;
    current.count -= 1;
    if (current.count > 0) return;
    states.delete(doc);
    current.padding?.release();
    current.overflow.release();
  };
}
