import { css, unsafeCSS, type CSSResult } from 'lit';

/**
 * The anchored overlays whose open panel is positioned inside the element that hosts them. A panel
 * cannot paint above a sibling of an ancestor stacking context however high its own `z-index`, so
 * a host that makes each of its boxes a stacking context (a transformed row, a sticky cell) raises
 * the box holding an open overlay above its siblings instead.
 * @internal
 */
export const ANCHORED_OVERLAY_OPEN_SELECTOR =
  'lr-dropdown[open], lr-popover[open], lr-select[open], lr-combobox[open]';

/**
 * Raises `selector` while it holds focus and while it `:has()` an open anchored overlay. The state
 * qualifiers sit in `:where()` so the rule keeps the specificity of `selector` alone and source
 * order against the component's own `z-index` declaration decides: append this fragment AFTER it.
 * An open overlay can outrank a focused box (`openLayer`), because focus alone only has to lift an
 * outward focus ring above the next sibling.
 * @param selector - The box to raise, for example `[part='cell'][data-sticky]`.
 * @param openLayer - A CSS `z-index` value for a box holding an open overlay.
 * @param focusLayer - A CSS `z-index` value for a box with focus inside; defaults to `openLayer`.
 * @internal
 */
export function raiseWhileOverlayOpen(selector: string, openLayer: string, focusLayer: string = openLayer): CSSResult {
  const box = unsafeCSS(selector);
  const open = unsafeCSS(ANCHORED_OVERLAY_OPEN_SELECTOR);
  return css`
    ${box}:where(:focus-within) {
      z-index: ${unsafeCSS(focusLayer)};
    }
    ${box}:where(:has(${open})) {
      z-index: ${unsafeCSS(openLayer)};
    }
  `;
}
