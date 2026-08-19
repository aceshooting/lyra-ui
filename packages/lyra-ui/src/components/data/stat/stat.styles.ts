import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
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
  .linked-shell {
    position: relative;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: 100%;
  }
  .linked-shell > [part='base'] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-base);
  }
  /* Content is a sibling of the stretched native link: built-in regions pass pointer input through
     to it, public slots re-enable hit testing so their own controls stay operable, and the class
     delegates plain slotted content's click to the link so it is no dead patch. */
  .linked-content {
    position: relative;
    z-index: var(--lr-layer-content);
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-m);
    block-size: 100%;
    box-sizing: border-box;
    pointer-events: none;
  }
  .linked-content slot,
  .linked-content [title] {
    pointer-events: auto;
  }
  [part='base'][href] {
    cursor: pointer;
    transition: border-color var(--lr-transition-fast), box-shadow var(--lr-transition-fast);
  }
  /* :where() zeroes the [href] contribution, leaving :hover at (0,1,0) -- tied with the pressed
     rule below, which therefore takes the tile on source order while the pointer is down. */
  :where([part='base'][href]):hover,
  :where(.linked-shell:hover > [part='base']) {
    border-color: var(--lr-stat-link-hover-border-color, var(--lr-color-brand));
    /* A hovered tile is resting chrome, not an overlay, so the lift stops at the card step. */
    box-shadow: var(--lr-stat-link-hover-shadow, var(--lr-shadow-s));
  }
  /* Pressed keeps the hovered border and lift and adds a fill: a shadow change alone is nearly
     invisible on a card this large. Mixing toward --lr-color-mix-partner (the text colour) darkens
     a light theme and lightens a dark one. */
  :where([part='base'][href]):active {
    border-color: var(
      --lr-stat-link-active-border-color,
      var(--lr-stat-link-hover-border-color, var(--lr-color-brand))
    );
    box-shadow: var(--lr-stat-link-active-shadow, var(--lr-stat-link-hover-shadow, var(--lr-shadow-s)));
    background: var(
      --lr-stat-link-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-surface),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
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
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
  /* An empty label part still takes [part='base']'s gap, leaving a blank line above the value --
     collapse it the way icon/sub/spark/caption/rows do. */
  [part='label'][hidden] {
    display: none;
  }
  [part='value-row'] {
    display: flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    align-items: baseline;
    gap: var(--lr-space-xs);
  }
  [part='value'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-2xl);
    font-weight: var(--lr-font-weight-bold);
    font-family: var(--lr-font-mono);
  }
  /* [part='value']/[part='row-value'] take tabindex="0" whenever exactValue/row.exactValue is set
     (stat.class.ts), so they need their own visible focus ring. */
  [part='value']:focus-visible,
  [part='row-value']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Mouse twin of the :focus-visible rule above: only the [tabindex] state (exactValue/
     row.exactValue set, so there is a tooltip to reveal) gets a hover affordance; a value with
     nothing to reveal stays inert, like its lack of a focus ring. :where() zeroes the [tabindex]
     contribution, leaving :hover at (0,1,0) -- below the :host([variant='...']) [part='value']
     colour rules at (0,2,0), so a coloured stat keeps its variant colour hovered. */
  /* no-pressed-state: the [tabindex] only lets a keyboard user reach the native title tooltip a
     mouse user hovers for -- no click handler, nothing to activate, which is what cursor: help
     says. A value part inside a linked stat never takes the tabindex; the anchor owns the
     interaction and its pressed state above covers it. */
  :where([part='value'][tabindex]):hover,
  :where([part='row-value'][tabindex]):hover {
    color: var(--lr-color-brand);
    cursor: help;
  }
  [part='unit'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
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
    /* 0.05rem/0.4rem map to no --lr-space-* step (--lr-space-xs, the smallest, is 0.25rem):
       rounding the vertical value up to xs would 5x the padding and blow out the compact chip,
       so both stay literal. */
    padding: var(--lr-size-0-05rem) var(--lr-size-0-4rem);
    align-self: flex-start;
  }
  [part='trend'][data-direction='up'] svg {
    transform: rotate(-90deg);
  }
  [part='trend'][data-direction='down'] svg {
    transform: rotate(90deg);
  }
  /* Scoped cssprops falling back to today's exact shared-token values, so retinting the trend pill
     leaves the headline value's variant="success"/"danger" tint below -- which deliberately reads
     --lr-color-success/-danger directly -- alone, and vice versa. */
  [part='trend'][data-polarity='good'] {
    color: var(--lr-stat-trend-good-color, var(--lr-color-success));
    background: var(--lr-stat-trend-good-bg, color-mix(in srgb, var(--lr-color-success) 8%, transparent));
  }
  [part='trend'][data-polarity='bad'] {
    color: var(--lr-stat-trend-bad-color, var(--lr-color-danger));
    background: var(--lr-stat-trend-bad-bg, color-mix(in srgb, var(--lr-color-danger) 8%, transparent));
  }
  :host([variant='brand']) [part='value'] {
    color: var(--lr-stat-value-brand-color, var(--lr-color-brand));
  }
  :host([variant='success']) [part='value'] {
    color: var(--lr-stat-value-success-color, var(--lr-color-success));
  }
  :host([variant='warning']) [part='value'] {
    color: var(--lr-stat-value-warning-color, var(--lr-color-warning));
  }
  :host([variant='danger']) [part='value'] {
    color: var(--lr-stat-value-danger-color, var(--lr-color-danger));
  }
  [part='spark'] {
    /* Consumers compose their own <lr-sparkline slot="spark">; this part only reserves width. */
    display: block;
  }
  [part='spark'][hidden] {
    display: none;
  }
  [part='sub'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='sub'][hidden] {
    display: none;
  }
  [part='caption'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='caption'][hidden] {
    display: none;
  }
  [part='rows'] {
    display: flex;
    min-inline-size: 0;
    flex-direction: column;
    /* Tighter than the card's own --lr-space-xs gap so the breakdown list reads as one nested
       group, not siblings of equal weight with label/value/caption. */
    gap: var(--lr-size-0-125rem);
  }
  [part='rows'][hidden] {
    display: none;
  }
  [part='row'] {
    display: flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }
  [part='row-label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
  }
  [part='row-value'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-family: var(--lr-font-mono);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* Orthogonal to the status variant: an accent edge marking a stat emphasized (e.g. the
     "headline" of a group) regardless of status color. */
  :host([emphasis]) [part='base'] {
    border-inline-start: var(--lr-border-width-thick) solid var(--lr-stat-emphasis-border-color, var(--lr-color-brand));
  }
  /* Status semantics win over emphasis: tint the value brand only when no variant claims it. */
  :host([emphasis][variant='neutral']) [part='value'] {
    color: var(--lr-stat-emphasis-value-color, var(--lr-color-brand));
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
  :host([compact]) .linked-content {
    padding: var(--lr-space-s);
    gap: var(--lr-size-0-125rem);
  }
  /* MUST stay after :host([compact]): both are :host([x]) [part='base'], equal specificity, so
     source order alone decides the padding when a stat is both, and plain ("no chrome at all")
     wins. block-size: 100% is dropped deliberately -- filling an arbitrarily tall parent is card
     behavior; a chrome-less stat sits at content height so it drops inline in prose or a toolbar.
     The emphasis accent edge is card chrome and goes with the border; the emphasis brand value
     tint still applies. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    block-size: auto;
  }
  :host([frame='plain']) .linked-shell,
  :host([frame='plain']) .linked-content {
    block-size: auto;
  }
  :host([frame='plain']) .linked-content {
    padding: 0;
  }
  /* The card's border-shift-plus-lift affordance does not read on a border-less, background-less
     box, so a linked plain stat underlines its headline value instead. The :focus-visible outline
     above needs no border and still applies. */
  :host([frame='plain']) [part='base'][href]:hover {
    box-shadow: none;
  }
  /* Stripped for the hover treatment's reason: a lift shadow with no surface under it reads as a
     smudge, and a fill puts back the box frame="plain" exists to remove. The thicker underline
     below carries the press. */
  :host([frame='plain']) [part='base'][href]:active {
    box-shadow: none;
    background: transparent;
  }
  :host([frame='plain']) .linked-shell:hover .linked-content [part='value'],
  :host([frame='plain']) [part='base'][href]:focus-visible + .linked-content [part='value'] {
    text-decoration: underline;
  }
  /* Pressed thickens the underline rather than recolouring the value: the value already carries
     the status variant's colour, and overriding it for a click would read as a state change. */
  :host([frame='plain']) [part='base'][href]:active + .linked-content [part='value'] {
    text-decoration: underline;
    text-decoration-thickness: var(--lr-border-width-medium);
  }
  :host([orientation='horizontal']) [part='base'] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--lr-space-s);
  }
  :host([orientation='horizontal']) .linked-content {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--lr-space-s);
  }
  /* The trend pill opts out of baseline alignment when stacked; on a single baseline row it has to
     sit on that baseline like everything else. */
  :host([orientation='horizontal']) [part='trend'] {
    align-self: baseline;
  }
  /* A breakdown list and a sparkline have no place on a text baseline, so they claim a full line
     and stay stacked beneath the horizontal row. */
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
