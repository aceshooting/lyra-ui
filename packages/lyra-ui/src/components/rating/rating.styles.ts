import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; color: var(--lyra-color-warning); }
  [part='base'] { display: inline-flex; align-items: center; gap: var(--lyra-space-xs); min-block-size: var(--lyra-icon-button-size); cursor: pointer; }
  [part='base']:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: var(--lyra-focus-ring-offset); }
  [part='star'] { display: inline-block; color: var(--lyra-rating-empty-color, var(--lyra-color-border)); font-size: var(--lyra-rating-size, var(--lyra-font-size-xl)); line-height: var(--lyra-line-height-none); }
  [part='star'][data-filled] { color: var(--lyra-rating-fill, var(--lyra-color-warning)); }
  :host([disabled]) [part='base'] { cursor: not-allowed; opacity: var(--lyra-opacity-disabled); }
`;
