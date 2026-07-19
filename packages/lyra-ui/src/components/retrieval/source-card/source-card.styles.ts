import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='title'] {
    align-self: flex-start;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: var(--lr-color-brand);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-md-sm);
    text-align: start;
    cursor: pointer;
  }
  [part='title']:hover {
    text-decoration: underline;
  }
  [part='title']:focus-visible,
  [part='toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='excerpt'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
  }
  [part='excerpt'][hidden] {
    display: none;
  }
  [part='toggle'] {
    align-self: flex-start;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    cursor: pointer;
  }
  [part='toggle']:hover {
    text-decoration: underline;
  }
  [part='full'] {
    padding-block-start: var(--lr-space-xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
  }
  [part='full'][hidden] {
    display: none;
  }
`;
