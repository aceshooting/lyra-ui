import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    max-inline-size: var(--lyra-size-28rem);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-l);
    box-sizing: border-box;
    padding: var(--lyra-space-l);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }

  [part='model-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    min-inline-size: 0;
  }
  /* The nested control's own max-inline-size (24rem, sized for a standalone
     dropdown) would otherwise clip a full-width row inside this card. */
  [part='model-row'] lyra-model-select {
    inline-size: 100%;
    max-inline-size: none;
  }

  [part='temperature-row'] {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--lyra-space-s);
    min-inline-size: 0;
  }
  [part='temperature-row'] lyra-slider {
    min-inline-size: 0;
  }
  [part='temperature-label'] {
    font-size: var(--lyra-font-size-sm);
    font-weight: var(--lyra-font-weight-semibold);
    color: var(--lyra-color-text);
    white-space: nowrap;
  }
  [part='temperature-value'] {
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
    font-variant-numeric: tabular-nums;
    min-inline-size: var(--lyra-size-2-5ch);
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
    gap: var(--lyra-space-m);
    padding: var(--lyra-space-m);
  }
  :host([layout='compact']) [part='model-row'],
  :host([layout='compact']) [part='temperature-row'] {
    flex: 1 1 var(--lyra-size-12rem);
    min-inline-size: var(--lyra-size-10rem);
  }
  :host([layout='compact']) [part='temperature-label'] {
    font-size: var(--lyra-size-0-6875rem);
    font-weight: var(--lyra-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lyra-size-0-04em);
    color: var(--lyra-color-text-quiet);
  }
`;
