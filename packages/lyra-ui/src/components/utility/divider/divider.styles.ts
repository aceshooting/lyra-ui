import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { border: 0; border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); margin: 0; }
  :host([orientation='vertical']) { display: inline-block; block-size: 100%; }
  :host([orientation='vertical']) [part='base'] { block-size: 100%; border-block-start: 0; border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
`;
