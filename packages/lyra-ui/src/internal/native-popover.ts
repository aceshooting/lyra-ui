/**
 * Whether the engine implements the native Popover API, and so a real browser top layer.
 *
 * A polyfill (for example `@oddbird/popover-polyfill`) defines `showPopover()` and rewrites
 * `:popover-open` inside `Element.prototype.matches()`, but it emulates the top layer with a
 * z-index, so an element it "shows" never leaves its containing-block chain. The
 * `CSS.supports('selector(:popover-open)')` probe is what tells the two apart: a polyfill cannot
 * teach the style engine a new pseudo-class.
 *
 * Evaluated on every call and never cached, so a test can stub `CSS.supports`. Returns `true` when
 * there is no `CSS` or `HTMLElement` global (server rendering): there is no engine to judge there,
 * and server output must never carry a client-only fallback marker.
 * @internal
 */
export function nativePopoverSupported(): boolean {
  if (typeof CSS === 'undefined' || typeof HTMLElement === 'undefined') return true;
  if (typeof HTMLElement.prototype.showPopover !== 'function') return false;
  try {
    return typeof CSS.supports === 'function' && CSS.supports('selector(:popover-open)');
  } catch {
    return false;
  }
}
