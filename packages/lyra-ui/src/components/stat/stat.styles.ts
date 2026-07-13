import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='icon'] {
    color: var(--lyra-color-text-quiet);
  }
  [part='icon'][hidden] {
    display: none;
  }
  [part='label'] {
    font-size: var(--lyra-font-size-xs);
    font-weight: var(--lyra-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--lyra-size-0-04em);
    color: var(--lyra-color-text-quiet);
  }
  [part='value-row'] {
    display: flex;
    align-items: baseline;
    gap: var(--lyra-space-xs);
  }
  [part='value'] {
    font-size: var(--lyra-font-size-2xl);
    font-weight: var(--lyra-font-weight-bold);
    font-family: var(--lyra-font-mono);
  }
  [part='unit'] {
    font-size: var(--lyra-font-size-md-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='trend'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    font-weight: var(--lyra-font-weight-semibold);
    border-radius: var(--lyra-radius);
    /* 0.05rem/0.4rem don't cleanly map to any --lyra-space-* step (the
       smallest, --lyra-space-xs, is 0.25rem): rounding the vertical value
       up to xs would 5x this chip's padding and blow out the compact
       trend-chip look, so both stay literal here. */
    padding: var(--lyra-size-0-05rem) var(--lyra-size-0-4rem);
    align-self: flex-start;
  }
  [part='trend'][data-direction='up'] svg {
    transform: rotate(-90deg);
  }
  [part='trend'][data-direction='down'] svg {
    transform: rotate(90deg);
  }
  [part='trend'][data-polarity='good'] {
    color: var(--lyra-color-success);
    background: color-mix(in srgb, var(--lyra-color-success) 8%, transparent);
  }
  [part='trend'][data-polarity='bad'] {
    color: var(--lyra-color-danger);
    background: color-mix(in srgb, var(--lyra-color-danger) 8%, transparent);
  }
  :host([variant='success']) [part='value'] {
    color: var(--lyra-color-success);
  }
  :host([variant='warning']) [part='value'] {
    color: var(--lyra-color-warning);
  }
  :host([variant='danger']) [part='value'] {
    color: var(--lyra-color-danger);
  }
  [part='spark'] {
    /* Consumers compose their own <lyra-sparkline slot="spark">; this part
       only needs to reserve width for it. */
    display: block;
  }
  [part='spark'][hidden] {
    display: none;
  }
  [part='sub'] {
    font-size: var(--lyra-font-size-sm);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='sub'][hidden] {
    display: none;
  }
  [part='caption'] {
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='caption'][hidden] {
    display: none;
  }
  [part='rows'] {
    display: flex;
    flex-direction: column;
    /* Slightly tighter than the card's own --lyra-space-xs gap so the
       breakdown list reads as one nested group rather than siblings of
       equal weight with label/value/caption. */
    gap: var(--lyra-size-0-125rem);
  }
  [part='rows'][hidden] {
    display: none;
  }
  [part='row'] {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
  }
  [part='row-label'] {
    color: var(--lyra-color-text-quiet);
  }
  [part='row-value'] {
    font-family: var(--lyra-font-mono);
    font-weight: var(--lyra-font-weight-semibold);
  }
  /* Orthogonal to the status variant: an accent edge that marks a stat as
     visually emphasized (e.g. the "headline" stat in a group) regardless of
     status color. */
  :host([emphasis]) [part='base'] {
    border-inline-start: var(--lyra-border-width-thick) solid var(--lyra-color-brand);
  }
  /* Status semantics win over visual emphasis: only tint the value with the
     brand color when there's no status variant already claiming it. */
  :host([emphasis][variant='neutral']) [part='value'] {
    color: var(--lyra-color-brand);
  }
  :host([prose]) [part='value'] {
    font-size: var(--lyra-size-0-9375rem);
    font-weight: var(--lyra-font-weight-normal);
    font-family: inherit;
    color: var(--lyra-color-text-quiet);
  }
  :host([prose]) [part='unit'] {
    display: none;
  }
  :host([compact]) [part='base'] {
    padding: var(--lyra-space-s);
    gap: var(--lyra-size-0-125rem);
  }
`;
