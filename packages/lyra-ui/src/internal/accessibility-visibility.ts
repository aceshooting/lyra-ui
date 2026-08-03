/**
 * Whether an element's authored or rendered state prunes it and all descendants from accessibility.
 * `aria-hidden` is an ASCII case-insensitive token, and rendered styles always come from the
 * element's owner realm.
 */
export function isAccessibilitySubtreeExcluded(element: Element): boolean {
  if (
    element.hasAttribute('hidden') ||
    element.hasAttribute('inert') ||
    element.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true'
  ) {
    return true;
  }

  const rendered = element.ownerDocument.defaultView?.getComputedStyle(element);
  return (
    rendered?.display === 'none' ||
    rendered?.contentVisibility === 'hidden'
  );
}

/** Whether an element's own text is visibility-hidden; descendants may override this in CSS. */
export function isAccessibilityVisibilityHidden(element: Element): boolean {
  const visibility = element.ownerDocument.defaultView?.getComputedStyle(element).visibility;
  return visibility === 'hidden' || visibility === 'collapse';
}

/** Whether an element itself is excluded; use the subtree predicate when recursively extracting. */
export function isAccessibilityExcluded(element: Element): boolean {
  return isAccessibilitySubtreeExcluded(element) || isAccessibilityVisibilityHidden(element);
}

/** Returns the next ancestor in the composed tree, crossing slots and open shadow roots. */
export function composedParentElement(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode() as Document | ShadowRoot;
  const host = 'host' in root ? root.host : null;
  return host?.nodeType === 1 ? host : null;
}

/** Whether `branch` is pruned as non-summary content of a closed native details element. */
function isClosedDetailsContentBranch(details: Element, branch: Element | null): boolean {
  if (details.localName !== 'details' || details.hasAttribute('open') || branch === null) return false;

  let summary: Element | null = null;
  for (const child of details.children) {
    if (child.localName === 'summary') {
      summary = child;
      break;
    }
  }
  return branch !== summary;
}

/**
 * Whether an element is connected and exposed by its own state and every composed ancestor.
 *
 * Document-level live regions do not inherit visibility from the component that publishes into
 * them. Announcement producers use this before writing to a shared sink.
 */
export function isAccessibilityVisible(element: Element): boolean {
  if (!element.isConnected) return false;

  let current: Element | null = element;
  let composedChild: Element | null = null;
  while (current) {
    if (isAccessibilitySubtreeExcluded(current)) return false;
    if (isClosedDetailsContentBranch(current, composedChild)) return false;
    if (current === element && isAccessibilityVisibilityHidden(current)) return false;
    composedChild = current;
    current = composedParentElement(current);
  }

  const targetDisplay = element.ownerDocument.defaultView?.getComputedStyle(element).display;
  // Browsers report every `display: contents` element as false from `checkVisibility()` because it
  // owns no CSS box, even when its semantic role is present in the accessibility tree. The
  // authored/CSS ancestor walk above (including closed-details branches) is the strongest
  // portable distinction available for that case. In particular, a skipped
  // `content-visibility:auto` subtree is only observable through `checkVisibility()` when the
  // queried source generates a box.
  if (targetDisplay === 'contents') return true;

  const visibilityTarget = element as Element & {
    checkVisibility?: (options?: { contentVisibilityAuto?: boolean }) => boolean;
  };
  return typeof visibilityTarget.checkVisibility === 'function'
    ? visibilityTarget.checkVisibility({ contentVisibilityAuto: true })
    : true;
}
