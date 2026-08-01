import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    --lr-cell-size: var(--lr-size-2-25rem);
    --lr-date-picker-month-gap: var(--lr-space-l);
    --lr-date-picker-header-gap: var(--lr-space-s);
    --lr-date-picker-radius: var(--lr-radius);
  }
  /* A calendar day cell is a square in a 7-column grid, not a form-control row, so this is the
     component's own ladder rather than the shared --lr-form-control-height one (whose 2xs/xs steps
     would put a tappable cell under 24px). It still matches both spellings of every tier, the same
     way internal/sizes.styles.ts does, so size="small" is honoured here too. */
  :host([size='2xs']) {
    --lr-cell-size: var(--lr-size-1-5rem);
  }
  :host([size='xs']) {
    --lr-cell-size: var(--lr-size-1-75rem);
  }
  :host([size='s']),
  :host([size='small']) {
    --lr-cell-size: var(--lr-size-2rem);
  }
  :host([size='l']),
  :host([size='large']) {
    --lr-cell-size: var(--lr-size-2-5rem);
  }
  :host([size='xl']) {
    --lr-cell-size: var(--lr-size-3rem);
  }
  :host([disabled]) {
    opacity: var(--lr-opacity-disabled);
    pointer-events: none;
  }
  [part='base'] {
    display: flex;
    /* months="2" renders two fixed-width month grids side by side (~520px
       total) -- in a panel/dialog/viewport narrower than that, wrapping the
       second month onto its own line keeps every day cell reachable instead
       of the row overflowing its allocation. */
    flex-wrap: wrap;
    gap: var(--lr-date-picker-month-gap);
    padding: var(--lr-space-s);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-date-picker-radius);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-date-picker-header-gap);
    margin-block-end: var(--lr-space-xs);
  }
  [part='title'] {
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-size-0-9375rem);
  }
  [part='previous'],
  [part='next'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text);
    font-size: var(--lr-size-1-1rem);
    line-height: var(--lr-line-height-none);
    padding: var(--lr-space-xs);
    border-radius: var(--lr-date-picker-radius);
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself,
     mirroring lr-pagination's/lr-table's identical remediation for this exact selector shape --
     a consumer's own ::part(previous):hover/::part(next):hover can win without !important. The
     background routes through a scoped cssprop so a consumer can retint just this hover state
     without hijacking the shared --lr-color-brand-quiet token used everywhere else. */
  :where([part='previous']):hover,
  :where([part='next']):hover {
    background: var(--lr-date-picker-nav-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed mixes the hover tint one shared step further toward the text colour -- month paging
     repeats, so "the click landed" has to be legible without waiting for the grid to redraw.
     Wrapped in :where() for the same specificity reason as the hover rule above. */
  :where([part='previous']):active,
  :where([part='next']):active {
    background: color-mix(
      in oklab,
      var(--lr-date-picker-nav-hover-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='previous']:focus-visible, [part='next']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Rotate the wrapping part element, not the svg -- internal/icons.ts's
     documented contract ("callers ... rotate the wrapping part element via
     CSS transform: rotate(...), not the svg"). This previously rotated the
     inner <svg> directly. */
  [part='previous'] {
    transform: rotate(180deg);
  }
  /* Under RTL the header's flexbox auto-mirrors (see date-picker.class.ts's
     ArrowLeft/ArrowRight comment), moving 'previous' to the physical right
     side and 'next' to the physical left -- so the chevrons must swap
     rotation in lockstep to keep pointing outward from the month title,
     matching the unrotated 'next' chevron's LTR orientation. */
  :host(:dir(rtl)) [part='previous'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='next'] {
    transform: rotate(180deg);
  }
  [part='weekdays'] {
    display: grid;
    grid-template-columns: repeat(7, var(--lr-cell-size));
  }
  [part='weekday'] {
    text-align: center;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    padding-block: var(--lr-space-xs);
  }
  [part='grid'] {
    display: grid;
    grid-template-columns: repeat(7, var(--lr-cell-size));
  }
  [part='week'] {
    display: contents;
  }
  [part~='day'] {
    inline-size: var(--lr-cell-size);
    block-size: var(--lr-cell-size);
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text);
    font: inherit;
    border-radius: var(--lr-date-picker-radius);
  }
  [part~='day']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part~='day']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part~='day-outside'] {
    color: var(--lr-color-text-quiet);
  }
  /* no-pressed-state: this is not a hover treatment. The :hover half only restates the resting
     text colour so an adjacent-month day inside the selected range keeps full contrast once
     [part~='day']:hover repaints its background; the pressed feedback for these cells is that same
     [part~='day']:active rule above, which they match too. */
  [part~='day-outside'][part~='day-range-inner'],
  [part~='day-outside'][part~='day-range-inner']:hover {
    color: var(--lr-color-text);
  }
  [part='day-placeholder'] {
    inline-size: var(--lr-cell-size);
    block-size: var(--lr-cell-size);
  }
  [part~='day-today'] {
    outline: var(--lr-border-width-thin) solid var(--lr-color-brand);
    outline-offset: var(--lr-size-neg-1px);
  }
  [part~='day-range-inner'] {
    background: var(--lr-color-brand-quiet);
    border-radius: 0;
  }
  [part~='day-selected'],
  [part~='day-range-start'],
  [part~='day-range-end'] {
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
  }
  [part~='day']:disabled {
    color: var(--lr-color-text-quiet);
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part~='day']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
