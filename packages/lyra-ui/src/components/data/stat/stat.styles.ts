import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    block-size: 100%;
    box-sizing: border-box;
    color: inherit;
    text-decoration: none;
  }
  [part='base'][href] {
    cursor: pointer;
    transition:
      border-color var(--lr-transition-fast),
      box-shadow var(--lr-transition-fast);
  }
  [part='base'][href]:hover {
    border-color: var(--lr-color-brand);
    box-shadow: var(--lr-shadow-sm);
  }
  [part='base'][href]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='icon'] {
    color: var(--lr-color-text-quiet);
  }
  [part='icon'][hidden] {
    display: none;
  }
  [part='label'] {
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
  /* An empty label part is still a flex item and still picks up [part='base']'s gap, leaving a
     stray blank line above the value — collapse it the same way icon/sub/spark/caption/rows do. */
  [part='label'][hidden] {
    display: none;
  }
  [part='value-row'] {
    display: flex;
    align-items: baseline;
    gap: var(--lr-space-xs);
  }
  [part='value'] {
    font-size: var(--lr-font-size-2xl);
    font-weight: var(--lr-font-weight-bold);
    font-family: var(--lr-font-mono);
  }
  /* [part='value']/[part='row-value'] become keyboard-focusable (tabindex="0")
     whenever exactValue/row.exactValue is set (see stat.class.ts), so they
     need their own visible focus ring like every other focusable part in the
     library. */
  [part='value']:focus-visible,
  [part='row-value']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='unit'] {
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='trend'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    border-radius: var(--lr-radius);
    /* 0.05rem/0.4rem don't cleanly map to any --lr-space-* step (the
       smallest, --lr-space-xs, is 0.25rem): rounding the vertical value
       up to xs would 5x this chip's padding and blow out the compact
       trend-chip look, so both stay literal here. */
    padding: var(--lr-size-0-05rem) var(--lr-size-0-4rem);
    align-self: flex-start;
  }
  [part='trend'][data-direction='up'] svg {
    transform: rotate(-90deg);
  }
  [part='trend'][data-direction='down'] svg {
    transform: rotate(90deg);
  }
  [part='trend'][data-polarity='good'] {
    color: var(--lr-color-success);
    background: color-mix(in srgb, var(--lr-color-success) 8%, transparent);
  }
  [part='trend'][data-polarity='bad'] {
    color: var(--lr-color-danger);
    background: color-mix(in srgb, var(--lr-color-danger) 8%, transparent);
  }
  :host([variant='success']) [part='value'] {
    color: var(--lr-color-success);
  }
  :host([variant='warning']) [part='value'] {
    color: var(--lr-color-warning);
  }
  :host([variant='danger']) [part='value'] {
    color: var(--lr-color-danger);
  }
  [part='spark'] {
    /* Consumers compose their own <lr-sparkline slot="spark">; this part
       only needs to reserve width for it. */
    display: block;
  }
  [part='spark'][hidden] {
    display: none;
  }
  [part='sub'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='sub'][hidden] {
    display: none;
  }
  [part='caption'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='caption'][hidden] {
    display: none;
  }
  [part='rows'] {
    display: flex;
    flex-direction: column;
    /* Slightly tighter than the card's own --lr-space-xs gap so the
       breakdown list reads as one nested group rather than siblings of
       equal weight with label/value/caption. */
    gap: var(--lr-size-0-125rem);
  }
  [part='rows'][hidden] {
    display: none;
  }
  [part='row'] {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }
  [part='row-label'] {
    color: var(--lr-color-text-quiet);
  }
  [part='row-value'] {
    font-family: var(--lr-font-mono);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* Orthogonal to the status variant: an accent edge that marks a stat as
     visually emphasized (e.g. the "headline" stat in a group) regardless of
     status color. */
  :host([emphasis]) [part='base'] {
    border-inline-start: var(--lr-border-width-thick) solid var(--lr-color-brand);
  }
  /* Status semantics win over visual emphasis: only tint the value with the
     brand color when there's no status variant already claiming it. */
  :host([emphasis][variant='neutral']) [part='value'] {
    color: var(--lr-color-brand);
  }
  :host([prose]) [part='value'] {
    font-size: var(--lr-size-0-9375rem);
    font-weight: var(--lr-font-weight-normal);
    font-family: inherit;
    color: var(--lr-color-text-quiet);
  }
  :host([prose]) [part='unit'] {
    display: none;
  }
  :host([compact]) [part='base'] {
    padding: var(--lr-space-s);
    gap: var(--lr-size-0-125rem);
  }
  /* MUST stay after :host([compact]): both selectors are :host([x]) [part='base'], i.e. equal
     specificity, so source order alone decides which padding wins when a stat is both compact and
     plain. plain is the stronger statement ("no chrome at all"), so it goes last.
     Also drops block-size: 100% — stretching to fill an arbitrarily tall parent is card behavior;
     a chrome-less stat sits at its content height so it can be dropped inline in prose or a
     toolbar. The emphasis accent edge is card chrome too and goes with the rest of the border;
     the emphasis brand value tint is unaffected and still applies. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    block-size: auto;
  }
  /* The card's interactive affordance is a border-color shift plus a lift shadow, and neither
     reads on a border-less, background-less box — a linked plain stat underlines its headline
     value instead. The :focus-visible outline above needs no border and still applies as-is. */
  :host([appearance='plain']) [part='base'][href]:hover {
    box-shadow: none;
  }
  :host([appearance='plain']) [part='base'][href]:hover [part='value'],
  :host([appearance='plain']) [part='base'][href]:focus-visible [part='value'] {
    text-decoration: underline;
  }
  :host([orientation='horizontal']) [part='base'] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--lr-space-s);
  }
  /* The trend pill opts out of baseline alignment in the stacked layout; on a single baseline row
     it has to sit on that baseline like everything else. */
  :host([orientation='horizontal']) [part='trend'] {
    align-self: baseline;
  }
  /* A breakdown list and a sparkline have no sensible place on a text baseline, so they claim a
     full line of their own and stay stacked beneath the horizontal row. */
  :host([orientation='horizontal']) [part='spark'],
  :host([orientation='horizontal']) [part='rows'] {
    flex-basis: 100%;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='base'][href] {
      transition: none;
    }
  }
`;
