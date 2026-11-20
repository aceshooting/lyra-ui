import { css, unsafeCSS, type CSSResult } from 'lit';

/**
 * Forced-colors fallbacks for state and data paint. Under `(forced-colors: active)` the browser
 * replaces author fills with the system palette, so a selected, current or active state that is
 * told apart from its siblings only by a tinted fill, and a data fill that is the only carrier of
 * a value, collapse into the page background. These fragments give each such state a system-colour
 * fill, border or outline. System colour keywords survive forced-colors adjustment, so they need
 * no opt-out; the data fill is the one case that keeps its authored colour and therefore opts out
 * of adjustment, adding a border so its extent still reads.
 *
 * Interpolate at the top level of a component's stylesheet, AFTER the rules that paint the state:
 * the selectors carry ordinary specificity, so a later declaration wins over the tinted fill a
 * component's own rule sets for the same element. Not inside another rule.
 */

/** Selected, current, pressed and checked states, matched by their standard attributes. */
export const forcedColorsSelected = css`
  @media (forced-colors: active) {
    [aria-selected='true'],
    [aria-current]:not([aria-current='false']),
    [aria-pressed='true'],
    [aria-checked='true'],
    [data-selected],
    [data-current],
    [data-active] {
      background-color: Highlight;
      color: HighlightText;
      outline: var(--lr-border-width-thin) solid CanvasText;
      outline-offset: calc(-1 * var(--lr-border-width-thin));
    }
  }
`;

/**
 * Data-bearing fills (a bar, meter or progress fill): keeps the authored fill when a component
 * passes it as `--_lr-forced-data-fill`, else paints Highlight, and always draws a CanvasText edge.
 */
export const forcedColorsDataFill = css`
  @media (forced-colors: active) {
    [data-fill],
    [part~='fill'] {
      forced-color-adjust: none;
      background-color: var(--_lr-forced-data-fill, Highlight);
      border: var(--lr-border-width-thin) solid CanvasText;
    }
  }
`;

/** The same state treatment as `forcedColorsSelected` for one component-specific selector. */
export function forcedColorsPart(selector: string): CSSResult {
  return css`
    @media (forced-colors: active) {
      ${unsafeCSS(selector)} {
        background-color: Highlight;
        color: HighlightText;
        outline: var(--lr-border-width-thin) solid CanvasText;
        outline-offset: calc(-1 * var(--lr-border-width-thin));
      }
    }
  `;
}

/**
 * Hairlines, splitters and resize handles painted only by `background`, which forced colors
 * replace with the page background. `rest` names the element that draws the line at rest (empty
 * for a handle that is transparent until engaged); `engaged` names its hover, drag and focus
 * states. Both get a system colour, so no `forced-color-adjust` opt-out is needed.
 */
export function forcedColorsDivider(rest: string, engaged = ''): CSSResult {
  const restRule = rest === '' ? '' : `${rest} { background-color: CanvasText; }`;
  const engagedRule = engaged === '' ? '' : `${engaged} { background-color: Highlight; }`;
  return css`
    @media (forced-colors: active) {
      ${unsafeCSS(restRule)}
      ${unsafeCSS(engagedRule)}
    }
  `;
}
