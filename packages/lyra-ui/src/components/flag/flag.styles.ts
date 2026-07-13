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
    inline-size: 100%;
    border-radius: var(--lyra-flag-radius, calc(var(--lyra-radius) * 0.33));
    box-shadow: 0 0 0 1px var(--lyra-color-border) inset;
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
