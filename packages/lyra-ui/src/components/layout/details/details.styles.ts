import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='summary'] { display: flex; align-items: center; justify-content: space-between; gap: var(--lr-space-s); padding-block: var(--lr-space-m); color: var(--lr-color-text); cursor: pointer; font-weight: var(--lr-font-weight-semibold); list-style: none; }
  [part='summary']::-webkit-details-marker { display: none; }
  [part='summary']:hover { background: var(--lr-color-brand-quiet); }
  [part='summary']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: calc(-1 * var(--lr-focus-ring-width)); }
  [part='summary']::after { content: ''; inline-size: var(--lr-size-0-5rem); block-size: var(--lr-size-0-5rem); border-inline-end: var(--lr-border-width-thin) solid currentColor; border-block-end: var(--lr-border-width-thin) solid currentColor; transform: rotate(45deg); transition: transform var(--lr-transition-fast); }
  :host([open]) [part='summary']::after { transform: rotate(225deg); }
  /* border-inline-end mirrors to the opposite physical side under RTL (border-left instead of
     border-right), which flips the corner the chevron is built from -- without a matching flip of
     the rotation angle, the marker would point sideways instead of down/up in both states. */
  :host(:dir(rtl)) [part='summary']::after { transform: rotate(-45deg); }
  :host([open]:dir(rtl)) [part='summary']::after { transform: rotate(-225deg); }
  :host([disabled]) [part='summary'] { cursor: not-allowed; opacity: var(--lr-opacity-disabled); }
  [part='content'] { padding-block-end: var(--lr-space-m); }
  @media (prefers-reduced-motion: reduce) { [part='summary']::after { transition: none; } }
`;
