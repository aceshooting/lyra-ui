/**
 * Leaf module shared by `<lr-progress-bar>` and `<lr-progress-ring>`.
 *
 * The two components render completely different geometry (a track/indicator pair versus two SVG
 * circles) and neither inherits from the other, but they publish the *same* `value`/`max`/`label`
 * contract: identical normalization, identical percent formatting, and identical accessible-name
 * precedence. Those three had been maintained as byte-identical copies in both class files, which
 * is exactly the shape this library's `x-shared.ts` convention exists for -- a divergence between
 * the two copies would be invisible until a consumer noticed the ring and the bar disagreeing about
 * the same numbers.
 *
 * Pure functions rather than a mixin: everything here is a projection of already-public property
 * values onto a string or number, so nothing needs the element's lifecycle.
 */

import {
  composedAccessibilityText,
  composedAccessibleVisibleText,
  type ComposedAccessibilityTextOptions,
} from '../../../internal/accessibility-visibility.js';

const PROGRESS_VARIANTS = ['neutral', 'brand', 'primary', 'success', 'warning', 'danger'];

/** An unsupported `variant` falls back to the documented `brand` default; `primary` stays an alias. */
export function normalizeProgressVariant<T extends string>(variant: T): T | 'brand' {
  return PROGRESS_VARIANTS.includes(variant) ? variant : 'brand';
}

export { progressSafeMax, progressSafeValue, progressPercent, formatProgressPercent } from '../../../internal/progress-value.js';

/**
 * Resolve inherited visibility parent-first before the bounded accessibility walk samples a
 * descendant override. WebKit can otherwise return the previous inherited value for a freshly
 * revealed `visibility: visible` child of a `visibility: hidden` label root. Keep this probe under
 * the same fixed-depth envelope as the accessible-text traversal so adversarial labels cannot
 * turn one update into an unbounded style walk.
 */
function primeVisibilityCascade(nodes: readonly Node[]): void {
  const stack = [...nodes].reverse();
  let remaining = 256;
  while (stack.length > 0 && remaining > 0) {
    const node = stack.pop();
    if (!node || node.nodeType !== 1) continue;
    const element = node as Element;
    remaining--;
    try {
      void element.ownerDocument.defaultView?.getComputedStyle(element).visibility;
    } catch {
      // Detached/server realms can lack a style engine; authored state remains authoritative.
    }
    const assigned = element.localName === 'slot'
      ? (element as HTMLSlotElement).assignedNodes({ flatten: true })
      : [];
    const children = assigned.length > 0 ? assigned : Array.from(element.childNodes);
    for (let index = children.length - 1; index >= 0; index--) {
      const child = children[index];
      if (child) stack.push(child);
    }
  }
}

/** Collapses the accessible, visible text of `nodes` into one whitespace-normalized string. */
export function joinAccessibleVisibleText(
  nodes: Iterable<Node>,
  options?: ComposedAccessibilityTextOptions,
): string {
  const boundedRoots = Array.from(nodes).slice(0, 256);
  primeVisibilityCascade(boundedRoots);
  const text = options
    ? composedAccessibilityText(boundedRoots, options)
    : boundedRoots.map(composedAccessibleVisibleText).join(' ');
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Accessible name for the `role="progressbar"` node, in the precedence both components document.
 *
 * A host `aria-label` wins by attribute *presence*, so an explicitly empty value stays empty rather
 * than reviving a fallback. Otherwise: the mapped `label` property, then the visible slotted label
 * text, then the localized default the caller passes in (never a literal
 * string here -- the caller resolves it through `localize()` so `registerLyraLocale()` keeps
 * working).
 */
export function resolveProgressLabel(parts: {
  /** The host `aria-label` attribute's value, `null` while it is absent. */
  hostAriaLabel: string | null;
  label: string;
  visibleText: string;
  localizedFallback: string;
}): string {
  if (parts.hostAriaLabel !== null) return parts.hostAriaLabel;
  return parts.label || parts.visibleText || parts.localizedFallback;
}
