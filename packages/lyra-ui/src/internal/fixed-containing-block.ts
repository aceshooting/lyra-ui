import { assignedSlotOf } from './composed-tree.js';
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
const FILTER_PROPERTIES = ['filter', 'backdrop-filter'];
const CONTAINING_BLOCK_PROPERTIES = ['transform', 'translate', 'scale', 'rotate', 'perspective', 'offset-path', ...FILTER_PROPERTIES];
const FIXED_CONTAINING_BLOCK_WILL_CHANGE = [...CONTAINING_BLOCK_PROPERTIES, 'contain', 'transform-style'];
const FIXED_CONTAINING_BLOCK_CONTAIN_RE = /paint|layout|strict|content/;
const INLINE_REPLACED_ELEMENTS = /^(audio|canvas|embed|iframe|img|input|object|video)$/;
const NON_ATOMIC_INLINE_DISPLAYS = /^(inline|inline list-item|ruby|inline ruby)$/;

function isNonNoneCssValue(value: string | undefined): boolean {
  return Boolean(value) && value !== 'none';
}

/** Engine discriminator for the separately verified inline-origin and will-change differences. */
export function usesWebKitContainingBlockRules(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports?.('-webkit-backdrop-filter', 'none') === true;
}

export function establishesFixedContainingBlock(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const css = view.getComputedStyle(element);
  if (css.display === 'contents' || css.display === 'none') return false;
  // Non-replaced inline boxes are not transformable and do not apply layout/paint containment.
  // Computed style retains those declarations, but they cannot establish a containing block.
  const nonAtomicInline =
    element instanceof HTMLElement && NON_ATOMIC_INLINE_DISPLAYS.test(css.display) &&
    !INLINE_REPLACED_ELEMENTS.test(element.localName);
  // Internal table boxes other than cells do not apply layout/paint containment. Their valid
  // transforms and filters still establish containing blocks independently of containment.
  const containmentApplies = !css.display.startsWith('table-') ||
    css.display === 'table-cell' || css.display === 'table-caption';
  return (
    (nonAtomicInline ? FILTER_PROPERTIES : CONTAINING_BLOCK_PROPERTIES)
      .some((property) => isNonNoneCssValue(css.getPropertyValue(property))) ||
    (!nonAtomicInline && (
      css.transformStyle === 'preserve-3d' ||
      (containmentApplies && (css.contentVisibility === 'auto' || css.contentVisibility === 'hidden' ||
        FIXED_CONTAINING_BLOCK_CONTAIN_RE.test(css.contain || '')))
    )) ||
    (css.willChange || '').split(',').some((token) => {
      const property = token.trim();
      // WebKit ignores inline filter hints, but honors containment hints on internal table boxes.
      if (nonAtomicInline) return FILTER_PROPERTIES.includes(property) && !usesWebKitContainingBlockRules();
      return FIXED_CONTAINING_BLOCK_WILL_CHANGE.includes(property) &&
        (property !== 'contain' || containmentApplies || usesWebKitContainingBlockRules());
    })
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
  const assignedSlot = node instanceof Element ? assignedSlotOf(node) : null;
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
export function findFixedContainingBlockAncestor(element: Element): HTMLElement | null;
export function findFixedContainingBlockAncestor(element: Element, absolute: true): Element | null;
/** Absolute positioning also accepts positioned ancestors and SVG boxes; fixed positioning
 *  preserves its HTMLElement-only traversal. */
export function findFixedContainingBlockAncestor(element: Element, absolute = false): Element | null {
  let node: Node = fixedContainingBlockParentNode(element);
  while (node instanceof Element && (absolute || node instanceof HTMLElement) &&
    !isLastTraversableFixedContainingBlockNode(node)) {
    const css = absolute ? node.ownerDocument.defaultView?.getComputedStyle(node) : undefined;
    if (css && css.display !== 'contents' && css.display !== 'none' && css.position !== 'static') return node;
    if (establishesFixedContainingBlock(node)) return node;
    if (isNativeTopLayerElement(node)) return null;
    const parent = fixedContainingBlockParentNode(node);
    if (parent === node) break;
    node = parent;
  }
  return null;
}
