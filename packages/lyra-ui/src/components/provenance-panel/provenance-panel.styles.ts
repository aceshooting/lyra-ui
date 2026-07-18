import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-xs) 0;
    border: none;
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: transparent;
    color: var(--lyra-color-text);
    font: inherit;
    font-weight: var(--lyra-font-weight-semibold);
    text-align: start;
    cursor: pointer;
  }
  [part='count'] {
    color: var(--lyra-color-text-quiet);
    font-weight: var(--lyra-font-weight-medium);
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    padding-block-start: var(--lyra-space-xs);
  }
  [part='body'][hidden] {
    display: none;
  }
  .entity-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-xs);
  }
`;
