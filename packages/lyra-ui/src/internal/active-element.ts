import { flattenedParentElement } from './composed-tree.js';

/**
 * Reads `activeElement` off a shadow root (or document) without letting a throwing getter escape.
 *
 * Why this exists: `ShadowRoot.activeElement` is not universally safe to read. Under happy-dom
 * 20.11.1 -- the DOM a large share of consumers get by default from Vitest -- that getter *itself*
 * throws `TypeError: Cannot read properties of undefined (reading 'getRootNode')` whenever the
 * document has no active element. Optional chaining is no defence: `root?.activeElement` only
 * guards `root` being nullish, and the throw happens *inside* the getter, after `?.` has already
 * decided to proceed.
 *
 * The consumer-visible symptom is not a failed assertion. The reads live in `willUpdate()` and in
 * keydown handlers, so the throw surfaces as an *unhandled rejection* on each affected re-render.
 * Assertions can still pass while the runner exits non-zero, and the failure points at library
 * internals rather than anything the consumer wrote.
 *
 * Returning `null` is the honest answer in every case this catches: a DOM that cannot say what is
 * focused is indistinguishable, for our purposes, from one where nothing is. Every call site
 * already handles "nothing is focused" -- that is the ordinary state -- so the guard degrades to
 * skipping focus restoration rather than changing behavior. In a real browser the getter does not
 * throw, so this is transparent there.
 *
 * @param root The shadow root or document to read. Nullish is tolerated (returns `null`), so this
 *   drops straight into the optional-chained `shadowRoot` positions it replaces.
 */
export function activeElementIn(root: DocumentOrShadowRoot | null | undefined): Element | null {
  if (!root) return null;
  try {
    return root.activeElement;
  } catch {
    return null;
  }
}

/**
 * Returns the element focused inside `host`'s own shadow root, or `null` when the host is
 * disconnected (a detached host cannot hold focus, and some DOMs throw on that read) or has no root.
 */
export function shadowFocusTarget(host: Element): Element | null {
  return host.isConnected ? activeElementIn(host.shadowRoot) : null;
}

/**
 * Walks the `activeElement` chain down through nested shadow roots to the innermost focused node.
 *
 * `document.activeElement` (and any given root's) reports only the outermost element in *its* tree
 * -- for a focused control inside a custom element's shadow root it collapses to the host tag,
 * answering "which of my children contains focus" rather than "what is focused". Descending until
 * a root reports no inner active element yields the real target.
 *
 * Every hop reads through {@link activeElementIn}, so a throwing getter anywhere along the chain
 * stops the walk at the last node that answered rather than propagating out.
 *
 * @param root Where to start. Defaults are the caller's business -- pass `document` for a global
 *   walk, or a specific shadow root to stay inside one component.
 */
export function deepActiveElementIn(
  root: DocumentOrShadowRoot | null | undefined,
): Element | null {
  let active = activeElementIn(root);
  while (active?.shadowRoot) {
    const inner = activeElementIn(active.shadowRoot);
    if (!inner) break;
    active = inner;
  }
  return active;
}

/** Browser active-element getters are typed as Element but partial DOMs can return structural
 * lookalikes. Brand-check before focus repair or composed containment traverses a candidate. */
export function isUsableActiveElement(value: unknown): value is Element {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null)
    return false;
  try {
    const candidate = value as Node;
    if (candidate.nodeType !== 1) return false;
    const NodeConstructor =
      candidate.ownerDocument?.defaultView?.Node ??
      (typeof Node === 'undefined' ? undefined : Node);
    if (!NodeConstructor) return false;
    NodeConstructor.prototype.getRootNode.call(candidate);
    return true;
  } catch {
    return false;
  }
}

/** Descends only across genuine active-element values; an invalid nested answer makes focus
 * ownership unknowable, so cluster repair fails closed instead of forwarding it to shared walks. */
export function safeDeepActiveElement(
  root: Document | ShadowRoot | null | undefined,
): Element | null {
  const initial: unknown = activeElementIn(root);
  if (!isUsableActiveElement(initial)) return null;
  let active: Element = initial;
  while (true) {
    let shadowRoot: ShadowRoot | null;
    try {
      shadowRoot = active.shadowRoot;
    } catch {
      return null;
    }
    if (!shadowRoot) return active;
    const nested: unknown = activeElementIn(shadowRoot);
    if (nested === null) return active;
    if (!isUsableActiveElement(nested)) return null;
    active = nested;
  }
}

/** Returns an element's composed parent, crossing assigned slots and shadow-root hosts. */
export function composedParentElement(element: Element): Element | null {
  return flattenedParentElement(element);
}
