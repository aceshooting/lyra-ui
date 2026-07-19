import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: var(--lr-size-8em);
    block-size: var(--lr-size-8em);
  }
  :host([type='linear']) {
    inline-size: var(--lr-size-12em);
    block-size: var(--lr-size-1-5em);
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }
  [part='track'] {
    fill: none;
    stroke: var(--lr-color-border);
  }
  [part='fill'] {
    fill: none;
    stroke: var(--lr-gauge-fill, var(--lr-color-brand));
    stroke-linecap: round;
    transition: stroke-dashoffset var(--lr-transition-base);
  }
  [part='value'] {
    font-size: var(--lr-font-size-md);
    font-weight: var(--lr-font-weight-bold);
    text-anchor: middle;
    fill: var(--lr-color-text);
    font-family: var(--lr-font);
  }
  [part='label'] {
    font-size: var(--lr-font-size-2xs);
    text-anchor: middle;
    fill: var(--lr-color-text-quiet);
    font-family: var(--lr-font);
    text-transform: uppercase;
  }
  :host([type='linear']) [part='fill'] {
    stroke-linecap: butt;
  }
  :host([type='linear']) [part='value'],
  :host([type='linear']) [part='label'] {
    font-size: var(--lr-size-0-5rem);
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
