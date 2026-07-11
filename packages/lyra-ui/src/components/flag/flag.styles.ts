import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    aspect-ratio: 4 / 3;
    block-size: 1em;
    line-height: 0;
    vertical-align: middle;
  }
  [part='image'] {
    display: block;
    block-size: 100%;
    inline-size: auto;
    border-radius: var(--lyra-flag-radius, 2px);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08) inset;
    object-fit: cover;
  }
  :host([round]) {
    block-size: 1em;
    inline-size: 1em;
  }
  :host([round]) [part='image'] {
    inline-size: 100%;
    block-size: 100%;
    border-radius: 50%;
  }
`;
