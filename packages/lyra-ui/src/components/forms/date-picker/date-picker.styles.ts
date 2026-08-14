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
  [part~='base'] {
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
  [part~='date-picker'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='months'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-date-picker-month-gap);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-date-picker-header-gap);
    margin-block-end: var(--lr-space-xs);
  }
  [part='nav'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-date-picker-header-gap);
    inline-size: 100%;
  }
  [part='title'] {
    appearance: none;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-size-0-9375rem);
  }
  :where([part='title']):hover:not(:disabled) {
    color: var(--lr-date-picker-title-hover-color, var(--lr-color-brand));
  }
  :where([part='title']):active:not(:disabled) {
    color: var(--lr-date-picker-title-active-color, var(--lr-color-brand));
    background: var(--lr-date-picker-title-active-bg, var(--lr-color-brand-quiet));
    border-radius: var(--lr-date-picker-radius);
  }
  :where([part='title']):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
     mirroring lr-pagination's/lr-table's low-specificity rule for this exact selector shape --
     a consumer's own ::part(previous):hover/::part(next):hover can win without !important. The
     background routes through a scoped cssprop so a consumer can retint just this hover state
     without hijacking the shared --lr-color-brand-quiet token used everywhere else. */
  :where([part='previous']):hover:not(:disabled),
  :where([part='next']):hover:not(:disabled) {
    background: var(--lr-date-picker-nav-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed mixes the hover tint one shared step further toward the text colour -- month paging
     repeats, so "the click landed" has to be legible without waiting for the grid to redraw.
     Wrapped in :where() for the same specificity reason as the hover rule above. */
  :where([part='previous']):active:not(:disabled),
  :where([part='next']):active:not(:disabled) {
    background: var(
      --lr-date-picker-nav-active-bg,
      color-mix(
        in oklab,
        var(--lr-date-picker-nav-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
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
  :host([with-week-numbers]) [part='weekdays'] {
    margin-inline-start: calc(var(--lr-cell-size) + var(--lr-border-width-thin));
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
  .calendar-body {
    display: flex;
    align-items: stretch;
  }
  [part='weeknumbers'] {
    display: grid;
    grid-template-rows: repeat(6, var(--lr-cell-size));
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='weeknumber'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-cell-size);
    block-size: var(--lr-cell-size);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
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
  [part~='day']:hover:not(:disabled) {
    background: var(--lr-date-picker-day-hover-bg, var(--lr-color-brand-quiet));
  }
  [part~='day']:active:not(:disabled) {
    background: var(
      --lr-date-picker-day-active-bg,
      color-mix(
        in oklab,
        var(--lr-date-picker-day-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part~='day-outside'] {
    color: var(--lr-date-picker-day-outside-color, var(--lr-color-text-quiet));
  }
  /* no-pressed-state: this is not a hover treatment. The :hover half only restates the resting
     text colour so an adjacent-month day inside the selected range keeps full contrast once
     [part~='day']:hover repaints its background; the pressed feedback for these cells is that same
     [part~='day']:active rule above, which they match too. */
  [part~='day-outside'][part~='day-range-inner'],
  [part~='day-outside'][part~='day-range-inner']:hover:not(:disabled) {
    color: var(--lr-date-picker-range-color, var(--lr-color-text));
  }
  [part='day-placeholder'] {
    inline-size: var(--lr-cell-size);
    block-size: var(--lr-cell-size);
  }
  [part~='day-today'] {
    outline: var(--lr-border-width-thin) solid var(--lr-date-picker-today-outline, var(--lr-color-brand));
    outline-offset: var(--lr-size-neg-1px);
  }
  [part~='day-range-inner'] {
    background: var(--lr-date-picker-range-bg, var(--lr-color-brand-quiet));
    border-radius: 0;
  }
  [part~='day-range-preview'] {
    background: var(--lr-date-picker-range-preview-bg, var(--lr-date-picker-range-bg, var(--lr-color-brand-quiet)));
  }
  [part~='day-selected'],
  [part~='day-range-start'],
  [part~='day-range-end'] {
    background: var(--lr-date-picker-selected-bg, var(--lr-color-brand));
    color: var(--lr-date-picker-selected-color, var(--lr-color-on-brand));
  }
  [part~='day']:disabled {
    color: var(--lr-date-picker-disabled-color, var(--lr-color-text-quiet));
    opacity: var(--lr-date-picker-disabled-opacity, var(--lr-opacity-disabled));
    cursor: not-allowed;
  }
  [part~='day']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='view-grid'] {
    display: grid;
    gap: var(--lr-space-xs);
  }
  [part='view-row'] {
    display: grid;
    grid-template-columns: repeat(4, minmax(var(--lr-size-3rem), 1fr));
    gap: var(--lr-space-xs);
  }
  [part='view-item'] {
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-date-picker-radius);
    background: none;
    color: var(--lr-color-text);
    cursor: pointer;
    font: inherit;
    padding: var(--lr-space-s);
  }
  :where([part~='view-item']):hover:not(:disabled) {
    background: var(--lr-date-picker-view-hover-bg, var(--lr-color-brand-quiet));
  }
  :where([part~='view-item']):active:not(:disabled) {
    background: var(
      --lr-date-picker-view-active-bg,
      color-mix(
        in oklab,
        var(--lr-date-picker-view-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  :where([part~='view-item']):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='view-item-selected'] {
    background: var(--lr-date-picker-view-selected-bg, var(--lr-color-brand));
    color: var(--lr-date-picker-view-selected-color, var(--lr-color-on-brand));
  }
  [part~='view-item-today'] {
    outline: var(--lr-border-width-thin) solid var(--lr-date-picker-view-today-outline, var(--lr-color-brand));
    outline-offset: var(--lr-size-neg-1px);
  }
  [part~='view-item-disabled'] {
    cursor: not-allowed;
    opacity: var(--lr-date-picker-view-disabled-opacity, var(--lr-opacity-disabled));
  }
  @media (forced-colors: active) {
    :where([part='previous'], [part='next'], [part='title'], [part~='day'], [part~='view-item']):hover:not(:disabled) {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: var(--lr-size-neg-1px);
    }
    :where([part='previous'], [part='next'], [part='title'], [part~='day'], [part~='view-item']):active:not(:disabled) {
      outline: var(--lr-border-width-medium) double Highlight;
    }
    [part~='day-selected'],
    [part~='view-item-selected'] {
      color: HighlightText;
      background: Highlight;
      outline: var(--lr-border-width-medium) solid Highlight;
    }
    [part~='day-today'],
    [part~='view-item-today'] {
      outline-style: dotted;
    }
    [part~='day']:disabled,
    [part~='view-item-disabled'] {
      color: GrayText;
      forced-color-adjust: none;
    }
  }
`;
