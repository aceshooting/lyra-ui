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
  /* The visible content is a sibling of the stretched native link. Built-in, non-interactive
     regions let pointer input pass through to that link; public slots opt back into hit testing so
     their own controls remain independently operable. Plain slotted content delegates its click
     to the link in the class rather than becoming a dead patch in the card. */
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
  /* :where() zeroes the extra [href] attribute selector's specificity contribution, leaving only
     :hover itself so a consumer's ::part(base):hover override ((0,1,1)) wins without needing
     !important. */
  :where([part='base'][href]):hover,
  :where(.linked-shell:hover > [part='base']) {
    border-color: var(--lr-stat-link-hover-border-color, var(--lr-color-brand));
    /* One step of lift on an otherwise flat resting card -- a hovered tile is still resting chrome,
       not an overlay, so it stops at the card step. */
    box-shadow: var(--lr-stat-link-hover-shadow, var(--lr-shadow-s));
  }
  /* The pressed tile keeps the hovered border and lift and adds a fill: a shadow change alone is
     nearly invisible on a card this large, and the tint mixes toward --lr-color-mix-partner (the
     text colour) so it darkens a light theme and lightens a dark one rather than always doing one. */
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
  /* An empty label part is still a flex item and still picks up [part='base']'s gap, leaving a
     stray blank line above the value — collapse it the same way icon/sub/spark/caption/rows do. */
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
  /* [part='value']/[part='row-value'] become keyboard-focusable (tabindex="0")
     whenever exactValue/row.exactValue is set (see stat.class.ts), so they
     need their own visible focus ring like every other focusable part in the
     library. */
  [part='value']:focus-visible,
  [part='row-value']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Mouse-user counterpart to the :focus-visible rule above: only the [tabindex] state (i.e.
     exactValue/row.exactValue is actually set, so there's a tooltip to reveal) gets a hover
     affordance -- a value with nothing to reveal stays inert on hover, matching its own lack of a
     focus ring. :where() zeroes the extra [tabindex] attribute selector's specificity
     contribution, leaving only :hover itself so a consumer's ::part(value):hover /
     ::part(row-value):hover override wins without needing !important. */
  /* no-pressed-state: the [tabindex] on these parts exists only so a keyboard user can reach the
     same native title tooltip a mouse user gets by hovering -- there is no click handler and
     nothing to activate, which is exactly what cursor: help says. A value part inside a linked
     stat never takes the tabindex at all (the anchor owns the interaction, and its own pressed
     state above covers it). */
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
  /* Scoped cssprops (falling back to today's exact shared-token values) so a consumer can retint
     just the trend pill without also recoloring the headline value's variant="success"/"danger"
     tint below, which deliberately keeps reading the shared --lr-color-success/-danger tokens
     directly -- and vice versa. */
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
    /* Consumers compose their own <lr-sparkline slot="spark">; this part
       only needs to reserve width for it. */
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
  /* Orthogonal to the status variant: an accent edge that marks a stat as
     visually emphasized (e.g. the "headline" stat in a group) regardless of
     status color. */
  :host([emphasis]) [part='base'] {
    border-inline-start: var(--lr-border-width-thick) solid var(--lr-stat-emphasis-border-color, var(--lr-color-brand));
  }
  /* Status semantics win over visual emphasis: only tint the value with the
     brand color when there's no status variant already claiming it. */
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
  /* MUST stay after :host([compact]): both selectors are :host([x]) [part='base'], i.e. equal
     specificity, so source order alone decides which padding wins when a stat is both compact and
     plain. plain is the stronger statement ("no chrome at all"), so it goes last.
     Also drops block-size: 100% — stretching to fill an arbitrarily tall parent is card behavior;
     a chrome-less stat sits at its content height so it can be dropped inline in prose or a
     toolbar. The emphasis accent edge is card chrome too and goes with the rest of the border;
     the emphasis brand value tint is unaffected and still applies. */
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
  /* The card's interactive affordance is a border-color shift plus a lift shadow, and neither
     reads on a border-less, background-less box — a linked plain stat underlines its headline
     value instead. The :focus-visible outline above needs no border and still applies as-is. */
  :host([frame='plain']) [part='base'][href]:hover {
    box-shadow: none;
  }
  /* The pressed card treatment has to be stripped for the same reason the hovered one is: a lift
     shadow with no surface under it reads as a smudge, and a fill would put back exactly the box
     frame="plain" exists to remove. The thicker underline below carries the press instead. */
  :host([frame='plain']) [part='base'][href]:active {
    box-shadow: none;
    background: transparent;
  }
  :host([frame='plain']) .linked-shell:hover .linked-content [part='value'],
  :host([frame='plain']) [part='base'][href]:focus-visible + .linked-content [part='value'] {
    text-decoration: underline;
  }
  /* Pressed thickens the same underline rather than recolouring the value -- the value already
     carries the status variant's colour, and overriding it for the length of a click would read as
     the stat changing state. */
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
