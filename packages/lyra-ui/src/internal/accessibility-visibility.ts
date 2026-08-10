import { composedParentElement } from './active-element.js';

export { composedParentElement } from './active-element.js';

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

function observeAccessibleTextNode(observer: MutationObserver, node: Node): void {
  if (node.nodeType === 3) {
    observer.observe(node, { characterData: true });
    return;
  }
  if (node.nodeType !== 1) return;
  observer.observe(node, {
    attributes: true,
    attributeFilter: ['aria-hidden', 'aria-label', 'class', 'hidden', 'inert', 'style'],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

/** Observes a host's label content, assigned nodes, and composed ancestors for accessible text. */
export function bindAccessibleTextObserver(observer: MutationObserver | undefined, host: Element): void {
  if (!observer) return;
  observer.disconnect();
  observeAccessibleTextNode(observer, host);
  let ancestor = composedParentElement(host);
  while (ancestor) {
    observer.observe(ancestor, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'class', 'hidden', 'inert', 'style'],
    });
    ancestor = composedParentElement(ancestor);
  }
  for (const slot of host.querySelectorAll<HTMLSlotElement>('slot')) {
    for (const assigned of slot.assignedNodes({ flatten: true })) observeAccessibleTextNode(observer, assigned);
  }
}

/** Extracts accessible, visible text through slots while respecting exclusion and visibility state. */
export function composedAccessibleVisibleText(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? '';
  if (node.nodeType !== 1) return '';
  const element = node as Element;
  if (isAccessibilitySubtreeExcluded(element)) return '';
  const visibilityHidden = isAccessibilityVisibilityHidden(element);
  const accessibleLabel = visibilityHidden ? null : element.getAttribute('aria-label');
  if (accessibleLabel?.trim()) return accessibleLabel;
  const childNodes =
    element.localName === 'slot' && (element as HTMLSlotElement).assignedNodes().length > 0
      ? (element as HTMLSlotElement).assignedNodes({ flatten: true })
      : element.childNodes;
  return Array.from(childNodes, (child) =>
    child.nodeType === 3 && visibilityHidden ? '' : composedAccessibleVisibleText(child),
  ).join(' ');
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
