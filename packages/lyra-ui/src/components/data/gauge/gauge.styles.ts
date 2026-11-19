import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: var(--lr-size-8em);
    aspect-ratio: 1;
    max-inline-size: 100%;
  }
  :host([shape='linear']) {
    inline-size: var(--lr-size-12em);
    block-size: var(--lr-size-1-5em);
    aspect-ratio: auto;
  }
  /* An explicit size tier sets the host font size for the em-based frame and captions. */
  :host(:where([size])) {
    font-size: var(--lr-form-control-font-size);
  }
  :host([data-effective-variant='neutral']) {
    --_lr-gauge-variant-fill: var(--lr-gauge-neutral-fill, var(--lr-color-neutral));
  }
  :host([data-effective-variant='brand']) {
    --_lr-gauge-variant-fill: var(--lr-gauge-brand-fill, var(--lr-color-brand));
  }
  :host([data-effective-variant='success']) {
    --_lr-gauge-variant-fill: var(--lr-gauge-success-fill, var(--lr-color-success));
  }
  :host([data-effective-variant='warning']) {
    --_lr-gauge-variant-fill: var(--lr-gauge-warning-fill, var(--lr-color-warning));
  }
  :host([data-effective-variant='danger']) {
    --_lr-gauge-variant-fill: var(--lr-gauge-danger-fill, var(--lr-color-danger));
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }
  [part='track'] {
    fill: none;
    stroke: var(--lr-gauge-track-color, var(--lr-color-border));
  }
  [part='fill'] {
    fill: none;
    stroke: var(--lr-gauge-fill, var(--_lr-gauge-variant-fill, var(--lr-color-brand)));
    stroke-linecap: round;
    transition: stroke-dashoffset var(--lr-transition-base);
  }
  [part='value'] {
    font-size: var(--lr-size-1em);
    font-weight: var(--lr-font-weight-bold);
    text-anchor: middle;
    fill: var(--lr-color-text);
    font-family: var(--lr-font);
  }
  [part='label'] {
    font-size: calc(var(--lr-size-1em) * 0.625);
    text-anchor: middle;
    fill: var(--lr-color-text-quiet);
    font-family: var(--lr-font);
    text-transform: uppercase;
  }
  /* Use first-strong direction within captions so units stay in order under RTL. */
  [part='value'],
  [part='label'] {
    unicode-bidi: plaintext;
  }
  :host([shape='linear']) [part='fill'] {
    stroke-linecap: butt;
  }
  :host([shape='linear']) [part='value'],
  :host([shape='linear']) [part='label'] {
    font-size: var(--lr-size-0-5em);
  }
  :host([shape='linear']) [part='value'] {
    text-anchor: end;
  }
  :host([shape='linear']) [part='label'] {
    text-anchor: start;
  }
  @media (forced-colors: active) {
    [part='track'] {
      stroke: GrayText;
    }
    [part='fill'] {
      forced-color-adjust: none;
      stroke: Highlight;
    }
    [part='value'],
    [part='label'] {
      fill: CanvasText;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='fill'] {
      transition: none !important;
    }
  }
`;
