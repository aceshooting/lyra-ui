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
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteRange } from '../../../internal/numbers.js';

/** Fallback `max` for both progress components, and the value a non-positive `max` falls back to. */
const PROGRESS_DEFAULT_MAX = 100;

/** `max`, normalized to a finite number and guarded against `<= 0` -- which would otherwise
 *  divide-by-zero in `progressPercent()` -- falling back to `PROGRESS_DEFAULT_MAX`. */
export function progressSafeMax(max: number): number {
  const normalized = finiteRange(max, PROGRESS_DEFAULT_MAX, 0);
  return normalized > 0 ? normalized : PROGRESS_DEFAULT_MAX;
}

/** `value`, normalized to a finite number clamped to `[0, safeMax]`. Takes an already-normalized
 *  `safeMax` so a caller that needs both does not run the guard above twice. */
export function progressSafeValue(value: number, safeMax: number): number {
  return finiteRange(value, 0, 0, safeMax);
}

/** Completion as a percentage in `[0, 100]`, from already-normalized inputs. */
export function progressPercent(safeValue: number, safeMax: number): number {
  return (safeValue / safeMax) * 100;
}

/** The percentage rendered as text, in the element's own effective locale (never `'en'`, never a
 *  bare `undefined`). */
export function formatProgressPercent(locale: string, percent: number): string {
  return getNumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(percent / 100);
}

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
 * than reviving a fallback. Otherwise: the mapped `label` property, then `accessibleLabel`, then the
 * visible slotted label text, then the localized default the caller passes in (never a literal
 * string here -- the caller resolves it through `localize()` so `registerLyraLocale()` keeps
 * working).
 */
export function resolveProgressLabel(
  host: Element,
  parts: {
    label: string;
    accessibleLabel: string;
    visibleText: string;
    localizedFallback: string;
  },
): string {
  if (host.hasAttribute('aria-label')) return host.getAttribute('aria-label') ?? '';
  return parts.label || parts.accessibleLabel || parts.visibleText || parts.localizedFallback;
}
