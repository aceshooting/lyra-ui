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
  .entity-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }
`;
