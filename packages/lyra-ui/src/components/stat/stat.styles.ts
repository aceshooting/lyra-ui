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
    border: 1px solid var(--lyra-color-border);
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
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--lyra-color-text-quiet);
  }
  [part='value-row'] {
    display: flex;
    align-items: baseline;
    gap: var(--lyra-space-xs);
  }
  [part='value'] {
    font-size: 1.75rem;
    font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, monospace;
  }
  [part='unit'] {
    font-size: 0.875rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='trend'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: var(--lyra-radius);
    /* 0.05rem/0.4rem don't cleanly map to any --lyra-space-* step (the
       smallest, --lyra-space-xs, is 0.25rem): rounding the vertical value
       up to xs would 5x this chip's padding and blow out the compact
       trend-chip look, so both stay literal here. */
    padding: 0.05rem 0.4rem;
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
  [part='caption'] {
    font-size: 0.8125rem;
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
    gap: 0.125rem;
  }
  [part='rows'][hidden] {
    display: none;
  }
  [part='row'] {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--lyra-space-xs);
    font-size: 0.8125rem;
  }
  [part='row-label'] {
    color: var(--lyra-color-text-quiet);
  }
  [part='row-value'] {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-weight: 600;
  }
  /* Orthogonal to the status variant: an accent edge that marks a stat as
     visually emphasized (e.g. the "headline" stat in a group) regardless of
     status color. */
  :host([emphasis]) [part='base'] {
    border-inline-start: 3px solid var(--lyra-color-brand);
  }
  /* Status semantics win over visual emphasis: only tint the value with the
     brand color when there's no status variant already claiming it. */
  :host([emphasis][variant='neutral']) [part='value'] {
    color: var(--lyra-color-brand);
  }
`;
