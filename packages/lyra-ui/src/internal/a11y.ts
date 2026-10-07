import { css } from 'lit';
import { tag } from './prefix.js';
import { collectComposedFocusTargets } from './focus-navigation.js';

export {
  composedParentElement,
  isAccessibilityExcluded,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisible,
  isAccessibilityVisibilityHidden,
} from './accessibility-visibility.js';

const NEXT_ID_STATE = Symbol.for('@aceshooting/lyra-ui.next-id-state.v1');

interface NextIdState {
  counter: number;
}

const fallbackNextIdState: NextIdState = { counter: 0 };

/** Finds the highest same-origin window without discarding a parent reached before a boundary. */
export function highestReachableWindow(start: Window): Window {
  let candidate = start;
  while (candidate.parent !== candidate) {
    const parent = candidate.parent;
    try {
      // Reading `document` is the capability check; reading only `parent` succeeds cross-origin.
      void parent.document;
    } catch {
      break;
    }
    candidate = parent;
  }
  return candidate;
}

/**
 * The registry stored under `key` on the highest reachable same-origin window (`globalThis` without
 * a window), created on first use. Same-origin frame realms can exchange and adopt nodes, so every
 * package copy loaded into them must share one registry; a cross-origin boundary is intentionally
 * the stopping point, since script on either side cannot adopt the other's nodes without first
 * crossing that same boundary. An existing value `isValid` rejects is never trusted, and a frozen
 * host (unusual, but it must not make construction throw) falls back to this copy's `fallback`.
 */
export function sharedRealmRegistry<T>(
  key: symbol,
  create: () => T,
  fallback: T,
  isValid: (value: unknown) => boolean = (value) => value !== undefined && value !== null,
): T {
  const host = (typeof window === 'undefined'
    ? globalThis
    : highestReachableWindow(window)) as typeof globalThis & Record<symbol, unknown>;
  const existing = host[key];
  if (isValid(existing)) return existing as T;
  const created = create();
  try {
    Object.defineProperty(host, key, {
      configurable: false,
      enumerable: false,
      value: created,
      writable: false,
    });
    return (host[key] as T | undefined) ?? created;
  } catch {
    return fallback;
  }
}

const isNextIdState = (value: unknown): boolean =>
  typeof value === 'object' && value !== null &&
  Number.isSafeInteger((value as NextIdState).counter) && (value as NextIdState).counter >= 0;

function sharedNextIdState(): NextIdState {
  return sharedRealmRegistry(NEXT_ID_STATE, () => ({ counter: 0 }), fallbackNextIdState, isNextIdState);
}

/** Monotonic unique id, scoped by a short label (e.g. `nextId('listbox')`). */
export const nextId = (scope: string): string => {
  const state = sharedNextIdState();
  if (state.counter >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('The Lyra generated-id sequence is exhausted.');
  }
  state.counter += 1;
  return `${tag(scope)}-${state.counter}`;
};

/** Returns the host's authored `aria-label`, including a public programmatic `accessibleLabel`
 * binding. Attribute presence wins and preserves the empty string. A non-empty own or Lit-reactive
 * compatibility property is the fallback; private computed getters are deliberately not invoked.
 * `null` means neither path supplies a name and the caller may compute one. */
export function hostAriaLabel(host: Element): string | null {
  if (host.hasAttribute('aria-label')) return host.getAttribute('aria-label') ?? '';
  const hasOwnProperty = Object.prototype.hasOwnProperty.call(host, 'accessibleLabel');
  const reactiveProperties = (host.constructor as typeof Element & {
    elementProperties?: ReadonlyMap<PropertyKey, unknown>;
  }).elementProperties;
  if (!hasOwnProperty && !reactiveProperties?.has('accessibleLabel')) return null;
  const propertyValue = (host as Element & { accessibleLabel?: unknown }).accessibleLabel;
  return typeof propertyValue === 'string' && propertyValue.length > 0 ? propertyValue : null;
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
 * shadow root, so a description parked on the host is silently dropped. Walk to the first
 * programmatically focusable descendant instead, including a managed native stop after a roving
 * owner assigns `tabindex=-1`.
 *
 * Returns `trigger` itself when the trigger is its own focus target (any native control), when it
 * carries its own `tabindex`, and when nothing focusable is reachable yet (a custom element that
 * has not upgraded, or a disabled control) -- callers then behave exactly as they did before.
 */
export function resolveAccessibleTrigger(trigger: HTMLElement): HTMLElement {
  if (trigger.hasAttribute('tabindex') || trigger.tabIndex >= 0) return trigger;
  const [focusable] = collectComposedFocusTargets(trigger, {
    includeRoot: false,
    mode: 'programmatic',
  }).elements;
  return focusable ?? trigger;
}

/** Visually-hidden-but-screen-reader-available helper class.
 *
 * The hairline box is sized from the shared --lr-size-1px token and the logical
 * inline-size/block-size/margin-inline/margin-block properties rather than raw 1px literals and
 * physical width/height/margin, matching every component stylesheet in the library -- this module
 * is shared by dozens of components, so an untokenized copy here would exempt all of them at once
 * from the token scale -- and no automated gate would notice, since check-style-policy.mjs only
 * walks component-level `.styles.ts` files and never this directory.
 *
 * Clipping uses `clip-path: inset(50%)`, not the deprecated `clip: rect(0 0 0 0)` shorthand --
 * matching `styles/utilities.css`'s `.lr-visually-hidden` and every component stylesheet that
 * ships its own copy. Two consequences worth knowing: a consumer that reveals a `.sr-only`
 * element on focus resets `clip-path: none` rather than `clip: auto`, and `clip-path` (unlike
 * `clip`) establishes a containing block for absolutely-positioned descendants. */
export const visuallyHidden = css`
  position: absolute;
  inline-size: var(--lr-size-1px);
  block-size: var(--lr-size-1px);
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

export const srOnly = css`
  .sr-only {
    ${visuallyHidden}
    margin-inline: calc(-1 * var(--lr-size-1px));
    margin-block: calc(-1 * var(--lr-size-1px));
  }
`;
