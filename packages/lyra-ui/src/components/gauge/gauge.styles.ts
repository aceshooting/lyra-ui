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
    transition: stroke-dashoffset var(--lyra-transition-base);
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
  :host([type='linear']) [part='value'],
  :host([type='linear']) [part='label'] {
    font-size: 0.5rem;
  }
  :host([type='linear']) [part='value'] {
    text-anchor: end;
  }
  :host([type='linear']) [part='label'] {
    text-anchor: start;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='fill'] {
      transition: none !important;
    }
  }
`;
