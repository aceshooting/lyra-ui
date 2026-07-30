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
 * keydown handlers, so the throw surfaces as an *unhandled rejection* -- one downstream suite
 * reported 120 of them in a single run, all the same stack, from an `<lr-segmented>` re-rendering
 * after its items changed. The tests still pass; the runner just exits non-zero, and the failure
 * points at library internals rather than anything the consumer wrote.
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
