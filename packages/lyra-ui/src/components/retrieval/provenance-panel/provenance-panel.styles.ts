import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    inline-size: 100%;
    padding: var(--lr-space-xs) 0;
    border: none;
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
    cursor: pointer;
  }
  [part='header']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='header']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='header']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='count'] {
    color: var(--lr-color-text-quiet);
    font-weight: var(--lr-font-weight-medium);
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding-block-start: var(--lr-space-xs);
  }
  [part='body'][hidden] {
    display: none;
  }
  /* Line packing is consumer-tunable because it is unreachable otherwise: the row fills [part='body']'s
     inline size, so justifying the body cannot move the wrapped chip lines. */
  .entity-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: var(--lr-provenance-panel-entity-justify, flex-start);
    gap: var(--lr-space-xs);
  }
`;
