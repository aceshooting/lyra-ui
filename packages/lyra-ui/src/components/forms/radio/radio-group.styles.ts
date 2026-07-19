import { css } from 'lit';

export const groupStyles = css`
  :host { display: block; }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lr-space-s); }
  [part='label'] { color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); }
  [part='label'][hidden], [part='hint'][hidden], [part='error'][hidden] { display: none; }
  :host([required]) [part='label']::after { content: ' *'; color: var(--lr-color-danger); }
  [part='hint'], [part='error'] { font-size: var(--lr-font-size-sm); }
  [part='hint'] { color: var(--lr-color-text-quiet); }
  [part='error'] { color: var(--lr-color-danger); }
`;
