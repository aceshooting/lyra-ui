import { css } from 'lit';

let counter = 0;

/** Monotonic unique id, scoped by a short label (e.g. `nextId('listbox')`). */
export const nextId = (scope: string): string => `lyra-${scope}-${++counter}`;

/** Visually-hidden-but-screen-reader-available helper class. */
export const srOnly = css`
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
`;
