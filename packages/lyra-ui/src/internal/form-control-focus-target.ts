const MAX_FOCUS_NODES = 10_000;

function composedChildren(element: Element): HTMLElement[] {
  if (element.localName === 'slot' && 'assignedElements' in element) {
    const assigned = (element as HTMLSlotElement).assignedElements({ flatten: true });
    if (assigned.length > 0) return assigned as HTMLElement[];
  }
  const shadow = element.shadowRoot;
  return [...(shadow?.children ?? element.children)] as HTMLElement[];
}

function isNativeTabTarget(element: HTMLElement): boolean {
  switch (element.localName) {
    case 'a':
    case 'area':
      return element.hasAttribute('href');
    case 'audio':
    case 'video':
      return element.hasAttribute('controls');
    case 'button':
    case 'embed':
    case 'iframe':
    case 'select':
    case 'textarea':
      return true;
    case 'object':
      return (element.getAttribute('data') ?? '').trim() !== '';
    case 'input':
      return (element as HTMLInputElement).type !== 'hidden';
    case 'summary':
      return element.matches('details > summary:first-of-type');
    default:
      return (
        element.hasAttribute('contenteditable') &&
        element.isContentEditable &&
        !element.parentElement?.isContentEditable
      );
  }
}

function unavailableSubtree(element: HTMLElement): boolean {
  if (
    !element.isConnected ||
    element.hidden ||
    element.hasAttribute('inert') ||
    element.getAttribute('aria-hidden')?.toLowerCase() === 'true' ||
    element.getAttribute('aria-disabled')?.toLowerCase() === 'true'
  ) {
    return true;
  }
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (
    style?.display === 'none' ||
    style?.contentVisibility === 'hidden'
  ) {
    return true;
  }
  return false;
}

function unavailableTarget(element: HTMLElement): boolean {
  if (element.matches(':disabled')) return true;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style?.visibility === 'hidden' || style?.visibility === 'collapse') return true;
  const visibilityCandidate = element as HTMLElement & {
    checkVisibility?: (options?: { contentVisibilityAuto?: boolean }) => boolean;
  };
  if (typeof visibilityCandidate.checkVisibility === 'function') {
    try {
      return !visibilityCandidate.checkVisibility({ contentVisibilityAuto: true });
    } catch {
      return true;
    }
  }
  return element.getClientRects().length === 0;
}

function isTabTarget(element: HTMLElement): boolean {
  if (element.hasAttribute('tabindex')) return element.tabIndex >= 0;
  return isNativeTabTarget(element);
}

/** Finds the first live sequential focus target in one form control's composed subtree. */
export function firstFormControlFocusTarget(host: HTMLElement): HTMLElement | null {
  const root = host.shadowRoot ?? host;
  const pending = ([...root.children] as HTMLElement[]).reverse();
  const visited = new Set<Element>();
  let candidate: HTMLElement | null = null;

  while (pending.length > 0 && visited.size < MAX_FOCUS_NODES) {
    const element = pending.pop();
    if (!element || visited.has(element)) continue;
    visited.add(element);
    if (unavailableSubtree(element)) continue;
    if ('focus' in element && isTabTarget(element) && !unavailableTarget(element)) {
      const tabIndex = element.tabIndex;
      if (tabIndex === 1) return element;
      if (
        !candidate ||
        (tabIndex > 0 && (candidate.tabIndex <= 0 || tabIndex < candidate.tabIndex))
      ) {
        candidate = element;
      }
    }
    const children = composedChildren(element);
    for (let index = children.length - 1; index >= 0; index--) pending.push(children[index]!);
  }

  return candidate;
}
