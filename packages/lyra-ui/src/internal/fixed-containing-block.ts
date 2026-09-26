import { nativePopoverSupported } from './native-popover.js';

/**
 * Containing-block detection for `position: fixed` surfaces, shared by the positioner's WebKit
 * correction and the anchored-overlay top-layer escape. Side-effect free.
 * @internal
 */

/**
 * `place()`'s popup defaults to `position: fixed`, so Floating UI must resolve the same
 * containing block the browser itself will use for `left`/`top`. `@floating-ui/utils/dom`'s own
 * (unexported -- reimplemented below rather than imported, since this package declares only
 * `@floating-ui/dom` and pnpm's strict `node_modules` layout does not resolve
 * `@floating-ui/utils` as a phantom transitive import) `isContainingBlock()` treats
 * `backdrop-filter`/`filter` as containing-block triggers only under `!isWebKit()` -- a carve-out
 * for older Safari/WebKitGTK builds that did not establish a containing block for either
 * property. Current WebKit (verified against this repo's own Playwright WebKit build) now
 * implements the CSS Filter Effects / Compositing spec the same way Chromium and Firefox already
 * do: an ancestor with `backdrop-filter` or `filter` *does* become the containing block for a
 * `position: fixed` descendant there too. Because Floating UI's own detection still skips both
 * properties on WebKit, `getOffsetParent()` walks straight past that ancestor and falls back to
 * the window, so `computePosition()` hands back coordinates meant to be resolved against the
 * viewport -- while the browser actually resolves the popup's `left`/`top` against the filtered
 * ancestor's box. The ancestor's own offset from the viewport origin then effectively gets added
 * a second time, landing the popup far outside the viewport (reported: an `lr-select hoist`
 * listbox roughly 1,000px past the right edge under a `backdrop-filter` ancestor, WebKit only --
 * Chromium and Firefox already detect the same ancestor correctly).
 *
 * Every other trigger `isContainingBlock()` checks (`transform`, `translate`, `scale`, `rotate`,
 * `perspective`, `will-change`, `contain`) already applies on every engine unconditionally --
 * only `backdrop-filter`/`filter` carry the stale WebKit exclusion. This replica also recognises
 * the triggers upstream misses on every engine -- `content-visibility: auto|hidden`,
 * `transform-style: preserve-3d`, a non-`none` `offset-path`, and `will-change: contain` or
 * `offset-path` -- and matches `will-change` by token, so `transform-origin` and
 * `perspective-origin` (which establish nothing) are not mistaken for containing blocks.
 */
const FIXED_CONTAINING_BLOCK_WILL_CHANGE = new Set([
  'transform', 'translate', 'scale', 'rotate', 'perspective', 'filter', 'backdrop-filter',
  'contain', 'offset-path', 'transform-style',
]);
const FIXED_CONTAINING_BLOCK_CONTAIN_RE = /paint|layout|strict|content/;

/** Token membership, not a substring test: `transform-origin`, `perspective-origin` and
 *  `contain-intrinsic-size` are not containing-block triggers in any engine. */
function willChangeEstablishesContainingBlock(value: string): boolean {
  return (value || '').split(',').some((token) => FIXED_CONTAINING_BLOCK_WILL_CHANGE.has(token.trim()));
}

function isNonNoneCssValue(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== 'none';
}

export function establishesFixedContainingBlock(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const css = view.getComputedStyle(element);
  return (
    isNonNoneCssValue(css.transform) ||
    isNonNoneCssValue(css.translate) ||
    isNonNoneCssValue(css.scale) ||
    isNonNoneCssValue(css.rotate) ||
    isNonNoneCssValue(css.perspective) ||
    isNonNoneCssValue(css.backdropFilter) ||
    isNonNoneCssValue(css.filter) ||
    isNonNoneCssValue(css.offsetPath) ||
    css.contentVisibility === 'auto' || css.contentVisibility === 'hidden' ||
    css.transformStyle === 'preserve-3d' ||
    willChangeEstablishesContainingBlock(css.willChange) ||
    FIXED_CONTAINING_BLOCK_CONTAIN_RE.test(css.contain || '')
  );
}

/** Mirrors `@floating-ui/utils/dom`'s own unexported `isTopLayer()`: a native top-layer element
 *  (an open popover, or a `<dialog>` shown modally) has no containing-block ancestor of its own.
 *  `:popover-open` is trusted only where the native Popover API exists: a selector-patching
 *  polyfill answers it for a z-index emulation that still resolves against its containing block. */
export function isNativeTopLayerElement(element: Element): boolean {
  if (nativePopoverSupported()) {
    try {
      if (element.matches(':popover-open')) return true;
    } catch {
      // Older engines may not support the :popover-open pseudo-class; fall through to :modal.
    }
  }
  try {
    return element.matches(':modal');
  } catch {
    return false;
  }
}

function fixedContainingBlockNodeName(node: Node): string {
  return node.nodeType === Node.DOCUMENT_NODE ? '#document' : ((node as Element).localName ?? '');
}

/** Replicates `@floating-ui/utils/dom`'s own unexported `getParentNode()`, including its
 *  shadow-boundary crossing: a hoisted popup's real ancestor chain runs from the component's
 *  shadow root out to its host element and beyond, into the light-DOM ancestors (like a
 *  `backdrop-filter` panel) that establish the containing block this module cares about. */
export function fixedContainingBlockParentNode(node: Node): Node {
  if (fixedContainingBlockNodeName(node) === 'html') return node;
  const assignedSlot = node instanceof Element ? node.assignedSlot : null;
  const result: Node =
    assignedSlot ??
    node.parentNode ??
    (node instanceof ShadowRoot ? node.host : null) ??
    node.ownerDocument?.documentElement ??
    node;
  return result instanceof ShadowRoot ? result.host : result;
}

export function isLastTraversableFixedContainingBlockNode(node: Node): boolean {
  const name = fixedContainingBlockNodeName(node);
  return name === 'html' || name === 'body' || name === '#document';
}

/**
 * Finds the nearest ancestor establishing a containing block for a `position: fixed` popup,
 * including the `backdrop-filter`/`filter` triggers WebKit's engine now honors but Floating UI's
 * own detection still misses there (see the block comment above). Returns `null` when none
 * exists -- the real containing block is the viewport, the common case every engine agrees on.
 */
export function findFixedContainingBlockAncestor(element: Element): HTMLElement | null {
  let node: Node = fixedContainingBlockParentNode(element);
  while (node instanceof HTMLElement && !isLastTraversableFixedContainingBlockNode(node)) {
    if (establishesFixedContainingBlock(node)) return node;
    if (isNativeTopLayerElement(node)) return null;
    node = fixedContainingBlockParentNode(node);
  }
  return null;
}
