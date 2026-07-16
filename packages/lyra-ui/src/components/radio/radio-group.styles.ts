import { css } from 'lit';

export const groupStyles = css`
  :host { display: block; }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lyra-space-s); }
  [part='label'] { color: var(--lyra-color-text); font-weight: var(--lyra-font-weight-semibold); }
  [part='label'][hidden], [part='hint'][hidden], [part='error'][hidden] { display: none; }
  :host([required]) [part='label']::after { content: ' *'; color: var(--lyra-color-danger); }
  [part='hint'], [part='error'] { font-size: var(--lyra-font-size-sm); }
  [part='hint'] { color: var(--lyra-color-text-quiet); }
  [part='error'] { color: var(--lyra-color-danger); }
`;
