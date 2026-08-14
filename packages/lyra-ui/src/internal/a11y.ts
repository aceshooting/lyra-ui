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

type NextIdStateHost = typeof globalThis & {
  [NEXT_ID_STATE]?: NextIdState;
};

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

function nextIdStateHost(): NextIdStateHost {
  let host = globalThis as NextIdStateHost;
  if (typeof window === 'undefined') return host;

  // Same-origin frame realms can exchange/adopt nodes. Coordinate them through the highest
  // reachable window so an iframe-loaded package copy cannot restart the parent's id sequence.
  // A cross-origin boundary is intentionally the stopping point: script on either side cannot
  // adopt the other's nodes without first crossing that same security boundary.
  host = highestReachableWindow(window) as unknown as NextIdStateHost;
  return host;
}

function sharedNextIdState(): NextIdState {
  const host = nextIdStateHost();
  const existing = host[NEXT_ID_STATE];
  if (existing && Number.isSafeInteger(existing.counter) && existing.counter >= 0) return existing;

  const state: NextIdState = { counter: 0 };
  try {
    Object.defineProperty(host, NEXT_ID_STATE, {
      configurable: false,
      enumerable: false,
      value: state,
      writable: false,
    });
    return host[NEXT_ID_STATE] ?? state;
  } catch {
    // A frozen host is unusual but must not make component construction throw. Duplicate package
    // copies in a normal mutable realm still take the coordinated path above.
    return fallbackNextIdState;
  }
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
export const srOnly = css`
  .sr-only {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin-inline: calc(-1 * var(--lr-size-1px));
    margin-block: calc(-1 * var(--lr-size-1px));
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
`;
