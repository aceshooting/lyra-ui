import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    max-inline-size: var(--lr-size-28rem);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    box-sizing: border-box;
    padding: var(--lr-space-l);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='model-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  /* The nested control's own max-inline-size (24rem, sized for a standalone
     dropdown) would otherwise clip a full-width row inside this card. */
  [part='model-row'] lr-model-select {
    inline-size: 100%;
    max-inline-size: none;
  }

  [part='temperature-row'] {
    display: grid;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='temperature-row'] lr-slider {
    min-inline-size: 0;
  }
  [part='temperature-label'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
    overflow-wrap: anywhere;
  }
  [part='temperature-value'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
    min-inline-size: var(--lr-size-2-5ch);
    text-align: end;
  }

  /* Compact layout: the two rows sit side by side instead of stacked, and
     the temperature caption shrinks to an uppercase micro-label -- a denser
     treatment for toolbars/sidebars where the vertical layout's full-height
     rows don't fit. */
  :host([layout='compact']) {
    max-inline-size: none;
  }
  :host([layout='compact']) [part='base'] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--lr-space-m);
    padding: var(--lr-space-m);
  }
  :host([layout='compact']) [part='model-row'],
  :host([layout='compact']) [part='temperature-row'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: var(--lr-size-10rem);
  }
  :host([layout='compact']) [part='temperature-label'] {
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
`;
