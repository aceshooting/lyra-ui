import { prefersReducedMotion } from './motion.js';
import { TEXT_QUOTE_LIMITS } from './text-quote.js';

const XHTML = 'http://www.w3.org/1999/xhtml';
const HEADING = /^h[1-6]$/u;

/** `smooth` only when motion is allowed and the content's document has a window. */
export function anchorScrollBehavior(root: Element): ScrollBehavior {
  return !root.ownerDocument.defaultView || prefersReducedMotion(root) ? 'auto' : 'smooth';
}

/**
 * Scrolls the heading a fragment `id` names to the start of the view. The id must be in the
 * rendered heading outline; its heading is the rendered `h1`-`h6` carrying that id, else the one
 * at the same outline position (a sanitizer strips an id that would clobber a document
 * property). Both scans stop at the text-quote traversal ceiling. Returns whether it scrolled.
 */
export function scrollToHeadingAnchor(root: Element, headings: readonly { readonly id: string }[], id: string): boolean {
  if (!id) return false;
  const limit = TEXT_QUOTE_LIMITS.maxTraversalNodes;
  let position = -1;
  for (let index = 0; index < Math.min(headings.length, limit); index++) {
    if (headings[index]?.id === id) {
      position = index;
      break;
    }
  }
  if (position < 0) return false;
  const walker = root.ownerDocument.createTreeWalker(root, 0x1 /* NodeFilter.SHOW_ELEMENT */);
  let byId: Element | null = null;
  let byPosition: Element | null = null;
  let seen = 0;
  for (let inspected = 0; inspected < limit && !byId; inspected++) {
    const element = walker.nextNode() as Element | null;
    if (!element) break;
    if (element.namespaceURI !== XHTML || !HEADING.test(element.localName)) continue;
    if (element.getAttribute('id') === id) byId = element;
    if (seen++ === position) byPosition = element;
  }
  const target = byId ?? byPosition;
  target?.scrollIntoView({ behavior: anchorScrollBehavior(root), block: 'start' });
  return target !== null;
}

/** Centres the element holding the start of a resolved range, or `root` when it has none. */
export function scrollToResolvedRange(root: Element, range: Range): void {
  const start = range.startContainer;
  const target = start.nodeType === 1 ? (start as Element) : start.parentElement;
  (target ?? root).scrollIntoView({ behavior: anchorScrollBehavior(root), block: 'center' });
}
