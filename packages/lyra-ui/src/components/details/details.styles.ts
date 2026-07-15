import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); }
  [part='summary'] { display: flex; align-items: center; justify-content: space-between; gap: var(--lyra-space-s); padding-block: var(--lyra-space-m); color: var(--lyra-color-text); cursor: pointer; font-weight: var(--lyra-font-weight-semibold); list-style: none; }
  [part='summary']::-webkit-details-marker { display: none; }
  [part='summary']::after { content: ''; inline-size: var(--lyra-size-0-5rem); block-size: var(--lyra-size-0-5rem); border-inline-end: var(--lyra-border-width-thin) solid currentColor; border-block-end: var(--lyra-border-width-thin) solid currentColor; transform: rotate(45deg); transition: transform var(--lyra-transition-fast); }
  :host([open]) [part='summary']::after { transform: rotate(225deg); }
  :host([disabled]) [part='summary'] { cursor: not-allowed; opacity: var(--lyra-opacity-disabled); }
  [part='content'] { padding-block-end: var(--lyra-space-m); }
  @media (prefers-reduced-motion: reduce) { [part='summary']::after { transition: none; } }
`;
