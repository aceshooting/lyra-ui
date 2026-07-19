import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    --lr-cell-size: var(--lr-size-2-25rem);
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
    gap: var(--lr-space-l);
    padding: var(--lr-space-s);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
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
    border-radius: var(--lr-radius);
  }
  [part='previous']:hover,
  [part='next']:hover {
    background: var(--lr-color-brand-quiet);
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
    border-radius: var(--lr-radius);
  }
  [part~='day']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part~='day-outside'] {
    color: var(--lr-color-text-quiet);
  }
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
