import { css } from 'lit';
import { tag } from './prefix.js';
import { collectFocusableElements } from './overlay-manager.js';

export {
  composedParentElement,
  isAccessibilityExcluded,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisible,
  isAccessibilityVisibilityHidden,
} from './accessibility-visibility.js';

let counter = 0;

/** Monotonic unique id, scoped by a short label (e.g. `nextId('listbox')`). */
export const nextId = (scope: string): string => `${tag(scope)}-${++counter}`;

/** Returns the host's authored `aria-label` by attribute presence, including the empty string.
 * `null` means the attribute is absent and the caller may use its computed fallback. */
export function hostAriaLabel(host: Element): string | null {
  return host.hasAttribute('aria-label') ? (host.getAttribute('aria-label') ?? '') : null;
}

// The one "is there real content" predicate for a set of light-DOM/assigned
// nodes -- reused by the initial synchronous seed (reading light-DOM
// childNodes) and the runtime slotchange handler (reading assignedNodes()) of
// any component that swaps its rendering based on whether a default slot
// carries meaningful content. Using two different predicates for the same
// question can let them disagree: a text-only check would seed correctly for
// whitespace-only text but (wrongly) treat a content-less icon element as
// empty, and a node-count-only check would treat *any* assigned node --
// including a whitespace-only text node -- as real content. Counting every
// element node as real content (regardless of its own text) while requiring
// non-whitespace text from text nodes gets both cases right in one place.
/** Whether `nodes` contains an element node, or a text node with non-
 *  whitespace content -- i.e. whether a default slot should be treated as
 *  carrying "real" content rather than being effectively empty. */
export function hasRealContent(nodes: Iterable<Node>): boolean {
  return Array.from(nodes).some((n) => n.nodeType === Node.ELEMENT_NODE || (n.textContent ?? '').trim().length > 0);
}

/**
 * Resolves the node that actually receives focus when a consumer-supplied trigger is activated.
 *
 * A name/description relationship is only surfaced to assistive technology on the element the user
 * is focused on. A custom-element host is almost never that element: `<lr-select>`, `<lr-switch>`,
 * `<lr-chip>` and any consumer-authored wrapper all move focus to a native control inside their
 * shadow root, so a description parked on the host is silently dropped. Walk to the first focusable
 * descendant instead -- `collectFocusableElements()` already crosses slots and nested open shadow
 * roots in browser tab order, so the first entry is exactly the node a Tab press would land on.
 *
 * Returns `trigger` itself when the trigger is its own focus target (any native control), when it
 * carries its own `tabindex`, and when nothing focusable is reachable yet (a custom element that
 * has not upgraded, or a disabled control) -- callers then behave exactly as they did before.
 */
export function resolveAccessibleTrigger(trigger: HTMLElement): HTMLElement {
  const [focusable] = collectFocusableElements(trigger);
  return focusable ?? trigger;
}

/** Visually-hidden-but-screen-reader-available helper class. */
export const srOnly = css`
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
`;
