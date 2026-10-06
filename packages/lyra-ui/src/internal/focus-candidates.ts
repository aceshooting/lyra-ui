import { isAriaTrue } from './accessibility-visibility.js';
import { isSvgElement } from './dom-guards.js';

/** Ancestor steps searched for the `<map>` that makes an `<area href>` a navigation target. */
const MAX_MAP_ANCESTOR_DEPTH = 256;

/**
 * Whether `element` is a native action that joins sequential focus navigation without a
 * `tabindex`: a link (an SVG link too, and an image-map `<area>` only inside its `<map>`), media
 * with controls, form controls and embedded content, a details summary, or an element that
 * establishes an editing host. Classified by namespace and local name, so it is realm-neutral.
 * Shared by overlay focus traversal and external-label activation so both agree on the same set.
 */
export function isNativeAction(element: HTMLElement | SVGElement): boolean {
  if (isSvgElement(element)) {
    return element.localName === 'a' && (
      element.hasAttribute('href') ||
      element.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')
    );
  }
  switch (element.localName) {
    case 'a':
      return element.hasAttribute('href');
    case 'area': {
      if (!element.hasAttribute('href')) return false;
      let ancestor = element.parentElement;
      for (let depth = 0; ancestor && depth <= MAX_MAP_ANCESTOR_DEPTH; depth += 1) {
        if (ancestor.localName === 'map') return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    }
    case 'audio':
    case 'video':
      return element.hasAttribute('controls');
    case 'button':
    case 'embed':
    case 'iframe':
    case 'select':
    case 'textarea':
      return true;
    case 'object': {
      const data = element.getAttribute('data');
      return data !== null && data.trim() !== '';
    }
    case 'input':
      return (element as HTMLInputElement).type !== 'hidden';
    case 'summary':
      return element.matches('details > summary:first-of-type');
    default: {
      // `isContentEditable` is inherited. Only an element that explicitly establishes an editing
      // host is an independent semantic action; ordinary descendants belong to that same action.
      const editable = element as HTMLElement;
      return editable.hasAttribute('contenteditable') &&
        editable.isContentEditable &&
        !editable.parentElement?.isContentEditable;
    }
  }
}

/**
 * Whether authored state removes `element` and its whole subtree from focus candidates: `hidden`,
 * `inert`, and -- unless the browser's own Tab order is being modelled, which keeps them --
 * `aria-hidden` or `aria-disabled` (ASCII case-insensitive, surrounding whitespace ignored).
 */
export function hasFocusExcludingAttributes(element: Element, browserTabOrder = false): boolean {
  return element.hasAttribute('hidden') ||
    element.hasAttribute('inert') ||
    (!browserTabOrder && (
      isAriaTrue(element.getAttribute('aria-hidden')) ||
      isAriaTrue(element.getAttribute('aria-disabled'))
    ));
}

/** Whether computed style removes an element's whole subtree from rendering, hence from focus. */
export function styleExcludesFocusSubtree(style: CSSStyleDeclaration | undefined): boolean {
  return style?.display === 'none' || style?.contentVisibility === 'hidden';
}

/**
 * Whether `element` itself renders as a focus target: not `visibility: hidden|collapse`, and
 * visible to `checkVisibility()` (content skipped by `content-visibility: auto` counts as hidden
 * unless `contentVisibilityAuto` is false), falling back to client rects on older engines.
 */
export function rendersAsFocusTarget(
  element: Element,
  visibility: string | undefined,
  contentVisibilityAuto = true,
): boolean {
  if (visibility === 'hidden' || visibility === 'collapse') return false;
  const candidate = element as Element & {
    checkVisibility?: (options?: { contentVisibilityAuto?: boolean }) => boolean;
  };
  if (typeof candidate.checkVisibility === 'function') {
    try {
      return candidate.checkVisibility({ contentVisibilityAuto });
    } catch {
      return false;
    }
  }
  return element.getClientRects().length > 0;
}
