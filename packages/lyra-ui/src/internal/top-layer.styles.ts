import { css } from 'lit';

/**
 * Neutralises the user-agent `[popover]` rules on a surface the anchored-overlay top-layer escape
 * (`top-layer-escape.ts`) promoted. Keyed on the library's own marker attribute, never on
 * `[popover]`, so a consumer's own native popover keeps its UA styling.
 *
 * Zero specificity: it only beats the UA rules, and every component rule and every outer
 * `::part()` rule still wins. `inset: auto` clears the UA `inset: 0`: under a right-to-left root
 * (the viewport is the top layer's containing block, and its direction is the root's) a leftover
 * `right: 0` would over-constrain the JS-written `left`, and CSS would discard `left`.
 * @internal
 */
export const topLayerReset = css`
  :where([data-lr-top-layer]) {
    inset: auto;
    margin: 0;
    inline-size: auto;
    block-size: auto;
    border: none;
    padding: 0;
    overflow: visible;
    color: inherit;
    background-color: transparent;
  }
`;
