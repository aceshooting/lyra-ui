import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: 8em;
    block-size: 8em;
  }
  :host([type='linear']) {
    inline-size: 12em;
    block-size: 1.5em;
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }
  [part='track'] {
    fill: none;
    stroke: var(--lyra-color-border);
  }
  [part='fill'] {
    fill: none;
    stroke: var(--lyra-color-brand);
    stroke-linecap: round;
    transition: stroke-dashoffset 0.2s ease;
  }
  [part='value'] {
    font-size: 1rem;
    font-weight: 700;
    text-anchor: middle;
    fill: var(--lyra-color-text);
    font-family: var(--lyra-font);
  }
  [part='label'] {
    font-size: 0.625rem;
    text-anchor: middle;
    fill: var(--lyra-color-text-quiet);
    font-family: var(--lyra-font);
    text-transform: uppercase;
  }
  :host([type='linear']) [part='fill'] {
    stroke-linecap: butt;
  }
`;
