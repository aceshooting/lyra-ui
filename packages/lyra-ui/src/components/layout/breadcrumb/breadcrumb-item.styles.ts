import { css } from 'lit';

export const styles = css`
  [part='base'] {
    color: var(--lr-color-text);
    text-decoration: none;
    border-radius: var(--lr-radius);
  }
  a[part='base']:hover {
    text-decoration: underline;
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='base'][aria-current='page'] {
    color: var(--lr-color-text-quiet);
    font-weight: var(--lr-font-weight-semibold);
  }
`;
