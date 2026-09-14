import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: var(--lr-size-8em);
    block-size: var(--lr-size-8em);
  }
  :host([shape='linear']) {
    inline-size: var(--lr-size-12em);
    block-size: var(--lr-size-1-5em);
  }
  /* Palette slot for the effective variant -- variant itself, or the matching thresholds entry.
     A separate custom property from --lr-gauge-fill, which stays the highest-priority public
     override and is left completely alone by these rules. */
  :host([data-effective-variant='neutral']) {
    --lr-gauge-variant-fill: var(--lr-color-neutral);
  }
  :host([data-effective-variant='brand']) {
    --lr-gauge-variant-fill: var(--lr-color-brand);
  }
  :host([data-effective-variant='success']) {
    --lr-gauge-variant-fill: var(--lr-color-success);
  }
  :host([data-effective-variant='warning']) {
    --lr-gauge-variant-fill: var(--lr-color-warning);
  }
  :host([data-effective-variant='danger']) {
    --lr-gauge-variant-fill: var(--lr-color-danger);
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
    stroke: var(--lr-gauge-fill, var(--lr-gauge-variant-fill, var(--lr-color-brand)));
    stroke-linecap: round;
    transition: stroke-dashoffset var(--lr-transition-base);
  }
  [part='value'] {
    font-size: var(--lr-font-size-m);
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
  :host([shape='linear']) [part='fill'] {
    stroke-linecap: butt;
  }
  :host([shape='linear']) [part='value'],
  :host([shape='linear']) [part='label'] {
    font-size: var(--lr-size-0-5rem);
  }
  :host([shape='linear']) [part='value'] {
    text-anchor: end;
  }
  :host([shape='linear']) [part='label'] {
    text-anchor: start;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='fill'] {
      transition: none !important;
    }
  }
`;
