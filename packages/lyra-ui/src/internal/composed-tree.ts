/**
 * The two parent walks of the composed tree, shared by locale, direction and theme observation.
 * Shapes are checked structurally rather than with `instanceof`, because a host adopted into an
 * iframe keeps nodes whose constructors belong to another realm.
 */

function isElementLike(candidate: unknown): candidate is Element {
  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    typeof (candidate as Element).getAttribute === 'function'
  );
}

/** The host of a shadow root (a host-bearing document fragment), or null for any other root. */
function shadowRootHost(root: Node): Element | null {
  const candidate = (root as { host?: unknown }).host;
  return root.nodeType === 11 && isElementLike(candidate) ? candidate : null;
}

/** The slot an element or text node is assigned to, when its shadow root exposes one. Closed roots
 * hide it. */
export function assignedSlotOf(element: Node): Element | null {
  const candidate = (element as { assignedSlot?: unknown }).assignedSlot;
  return isElementLike(candidate) ? candidate : null;
}

/** The DOM-tree parent, continuing at the host of a shadow root. `lang`/`locale` inherit this way. */
export function domParentElement(element: Element): Element | null {
  return element.parentElement ?? shadowRootHost(element.getRootNode());
}

/** The flattened-tree parent: an assigned slot first. CSS properties (direction, theme tokens)
 * inherit this way. */
export function flattenedParentElement(element: Element): Element | null {
  return assignedSlotOf(element) ?? domParentElement(element);
}

/** Whether `candidate` is `container` or inside it along the flattened tree. */
export function composedContains(container: Element, candidate: Element | null): boolean {
  let current = candidate;
  while (current) {
    if (current === container) return true;
    current = flattenedParentElement(current);
  }
  return false;
}

/** The element's owner window: `null` for a document without a browsing context, `undefined` when
 * reading it throws (a discarded or hostile owner document). */
export function ownerView(host: Element): (Window & typeof globalThis) | null | undefined {
  try {
    return host.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  } catch {
    return undefined;
  }
}
