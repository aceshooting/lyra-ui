import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    min-inline-size: 0;
  }
  [part='breadcrumb'] {
    min-inline-size: 0;
  }
  [part='breadcrumb-button'] {
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='breadcrumb-button']:hover {
    text-decoration: underline;
  }
  [part='breadcrumb-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='content'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part='tabs'] {
    min-inline-size: 0;
  }
  [part='category'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
`;
