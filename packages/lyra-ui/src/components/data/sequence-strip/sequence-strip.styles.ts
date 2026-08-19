import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: var(--lr-size-1px);
    block-size: var(--lr-sequence-strip-height, var(--lr-size-1-5rem));
  }
  /* Above the documented 320-item dense threshold, a 1px gap per item would make the gaps alone
     wider than the 320px responsive baseline. Only that decorative spacing collapses; every
     semantic cell stays rendered, colored, named, and keyboard reachable. */
  [part='base'][data-dense] {
    gap: 0;
  }
  [part='cell'] {
    position: relative;
    flex: 1 1 0;
    min-inline-size: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  /* A cell emits lr-item-activate on click and on Enter/Space, so it carries a pointer cursor and
     a real pressed treatment, hover paired with focus-visible per the library's
     every-:focus-visible-part-needs-:hover rule. */
  [part='cell'] {
    cursor: pointer;
  }
  [part='cell']:hover,
  [part='cell']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  /* Pressed reads as a heavier ring, not a tint: a cell's background IS data (its category
     colour), so darkening it misreports the category, and a filter would multiply every channel
     across the whole subtree -- the mistake the switch's own styles record from before 8.0.0. */
  [part='cell']:active {
    outline: var(--lr-focus-ring-width) solid var(--lr-color-text);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  /* The controlled selection reads as a persistent ring, not a colour change: a cell's background
     is data (its category colour), so tinting it would misreport the category. */
  [part='cell'][data-selected] {
    outline: var(--lr-focus-ring-width) solid var(--lr-color-text);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  /* The selection ring above and the :hover/:focus-visible ring further up are both (0,2,0) with
     the same outline, so selection wins on source order -- correctly dropping hover, but it also
     dropped FOCUS, since those two differ only in colour. This (0,3,0) rule restates the colour
     channel alone. :active needs no companion: its declaration is byte-identical to the selection
     ring's. */
  [part='cell'][data-selected]:focus-visible {
    outline-color: var(--lr-focus-ring-color);
  }
  /* Round the strip's outer ends via the first/last cell, not overflow:hidden on [part='base'] --
     that would clip [part='tooltip'], deliberately positioned outside the base's own box. */
  [part='cell']:first-child {
    border-start-start-radius: var(--lr-radius-xs);
    border-end-start-radius: var(--lr-radius-xs);
  }
  [part='cell']:last-child {
    border-start-end-radius: var(--lr-radius-xs);
    border-end-end-radius: var(--lr-radius-xs);
  }
  [part='marker'] {
    display: block;
    inline-size: 100%;
    block-size: var(--lr-size-2px);
    background: var(--lr-sequence-strip-marker-color, var(--lr-color-text));
  }
  [part='tooltip'] {
    position: absolute;
    inset-block-end: 100%;
    inset-inline-start: 50%;
    transform: translate(-50%, calc(-1 * var(--lr-size-6px)));
    padding: var(--lr-size-2px) var(--lr-size-6px);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    white-space: nowrap;
    box-shadow: var(--lr-shadow-m);
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  /* The tooltip is a child of the active cell, so this 50% inset tracks that cell, not the strip.
     Under RTL the inset anchors to the physical right edge, so the fixed -50% translate must flip
     sign -- translateX is physical, not logical. */
  :host(:dir(rtl)) [part='tooltip'] {
    transform: translate(50%, calc(-1 * var(--lr-size-6px)));
  }
  [part='tooltip'][hidden] {
    display: none;
  }
  /* Legend rows grow with the consumer's categories and labels grow with translation, so it wraps
     rather than overflowing, and each item keeps min-inline-size: 0 so a long label shrinks inside
     its own row instead of forcing the strip's allocation wider. */
  [part='legend'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-2xs) var(--lr-space-s);
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='window-range'],
  [part='legend-limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-variant-numeric: tabular-nums;
  }
  [part='window-range'] {
    margin-block-start: var(--lr-space-2xs);
    text-align: end;
  }
  [part='legend-item'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }
  [part='legend-swatch'],
  [part='legend-marker-swatch'] {
    flex: none;
    inline-size: var(--lr-sequence-strip-legend-swatch-size, var(--lr-size-0-625rem));
    block-size: var(--lr-sequence-strip-legend-swatch-size, var(--lr-size-0-625rem));
    border-radius: var(--lr-radius-xs);
  }
  /* The marker legend row stands for the marker on any cell, so its chip takes a neutral
     background rather than a category color and reproduces the cell's bottom bar as an inset
     shadow (same thickness, same --lr-sequence-strip-marker-color) -- the chip has no child to
     give the bar its own box. */
  [part='legend-marker-swatch'] {
    background: var(--lr-sequence-strip-legend-marker-bg, var(--lr-color-surface-raised));
    box-shadow: inset 0 calc(-1 * var(--lr-size-2px)) 0 0
      var(--lr-sequence-strip-marker-color, var(--lr-color-text));
  }
  [part='legend-label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
`;
