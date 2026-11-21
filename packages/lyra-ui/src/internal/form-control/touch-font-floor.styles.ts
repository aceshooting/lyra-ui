import { css, type CSSResult } from 'lit';

/**
 * The coarse-pointer font floor for a native editable surface.
 *
 * Mobile Safari zooms the page when focus enters an editable element whose computed font size is
 * below 16px, and the shared form-control scale sits below that at every tier up to `m`. Under a
 * coarse or hover-less pointer this raises the surface's font size to at least
 * `--lr-form-control-touch-font-size-min` (default `var(--lr-size-16px)`, the platform's own
 * threshold in pixels rather than a rem); a larger authored size is kept, and setting the token to `0px`
 * restores the authored size. Fine pointers are untouched.
 *
 * Interpolate it after the surface's own `font-size` rule so it wins on source order.
 *
 * @param surface - Selector of the native `<input>`/`<textarea>` (or its font-owning wrapper).
 * @param size - The surface's resting `font-size` expression; `100%` for a surface that inherits.
 */
export function formControlTouchFontFloor(surface: CSSResult, size: CSSResult = css`100%`): CSSResult {
  return css`
    @media (hover: none), (pointer: coarse) {
      ${surface} {
        font-size: max(${size}, var(--lr-form-control-touch-font-size-min, var(--lr-size-16px)));
      }
    }
  `;
}
