import { css } from 'lit';

export const styles = css`
  [part='base'] {
    color: var(--lyra-color-text);
    text-decoration: none;
    border-radius: var(--lyra-radius);
  }
  a[part='base']:hover {
    text-decoration: underline;
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='base'][aria-current='page'] {
    color: var(--lyra-color-text-quiet);
    font-weight: var(--lyra-font-weight-semibold);
  }
`;
