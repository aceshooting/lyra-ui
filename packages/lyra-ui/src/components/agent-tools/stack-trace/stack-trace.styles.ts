import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-size: var(--lr-font-size-sm);
    /* Consumer-tunable scroll cap -- 'none' means the component grows with its content until a
       caller opts into an internal scrollbar via the max-height attribute. */
    --lr-stack-trace-max-height: none;
    --lr-stack-trace-font: var(--lr-font-mono);
  }
  [part='base'] {
    display: block;
    max-block-size: var(--lr-stack-trace-max-height);
    overflow: auto;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    padding: var(--lr-space-s);
  }
  /* Density escape -- same convention as lr-agent-run's/lr-thinking-panel's compact. The tuned
     values sit behind inline var() fallbacks (rather than a :host declaration, which every instance
     would re-declare and so shadow any ancestor value) so a consumer can retune them from outside
     without restating the whole rule. Purely density: the border, radius and background stay, and
     frame="plain" below is what drops them. */
  :host([compact]) [part='base'] {
    padding: var(--lr-stack-trace-compact-padding, var(--lr-space-2xs));
  }
  :host([compact]) [part='message'],
  :host([compact]) [part='group'] {
    margin-block-end: var(--lr-stack-trace-compact-gap, var(--lr-space-2xs));
  }
  :host([compact]) [part='group']:last-child {
    margin-block-end: 0;
  }
  /* MUST stay after :host([compact]) [part='base']: both are equal-specificity, so source order
     alone decides which padding wins when a trace is both compact and frame="plain". plain is the
     stronger statement ("no chrome at all"), so it goes last.
     Chrome-less escape, the shared frame="plain" treatment (and lr-callout's [inline]): a stack
     trace is routinely nested inside an lr-result-card or lr-agent-run that already draws a border,
     which would otherwise double the box. Only the box decoration goes -- the max-block-size scroll
     cap and overflow stay, as do the copy button's and stack frames' own hover/focus affordances,
     which never depended on this border. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='message'] {
    font-weight: var(--lr-font-weight-bold);
    margin-block-end: var(--lr-space-s);
    overflow-wrap: anywhere;
  }
  [part='group'] {
    margin-block-end: var(--lr-space-s);
    font-family: var(--lr-stack-trace-font);
  }
  [part='group']:last-child {
    margin-block-end: 0;
  }
  [part='frame'] {
    display: block;
    inline-size: 100%;
    text-align: start;
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: var(--lr-space-2xs) 0;
  }
  button[part='frame'] {
    cursor: pointer;
  }
  [part='frame'][data-internal] {
    color: var(--lr-stack-trace-internal-frame-color, var(--lr-color-text-quiet));
  }
  button[part='frame']:hover,
  button[part='frame']:focus-visible {
    color: var(--lr-stack-trace-interactive-color, var(--lr-color-brand));
  }
  /* The hover recolours the label only, which leaves the pressed step nothing to deepen -- so
     pressed tints the frame's own (transparent) surface toward --lr-color-mix-partner, which
     follows the text colour and therefore darkens in a light theme and lightens in a dark one. */
  button[part='frame']:active {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  button[part='frame']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='frame-function'] {
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='frame-location'] {
    color: var(--lr-color-text-quiet);
    margin-inline-start: var(--lr-space-xs);
    overflow-wrap: anywhere;
  }
  [part='frame'][data-raw] {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  [part='internal-toggle'] {
    display: block;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-stack-trace-interactive-color, var(--lr-color-brand));
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--lr-space-2xs) 0;
  }
  [part='internal-toggle']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='internal-toggle']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='internal-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='raw'] {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: var(--lr-stack-trace-font);
  }

  [part='limit'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    cursor: pointer;
    margin-block-end: var(--lr-space-s);
  }
  [part='copy-button']:hover {
    border-color: var(--lr-stack-trace-interactive-color, var(--lr-color-brand));
  }
  /* As with [part='frame'] above: the hover moves the border only, so pressed tints the button's
     own surface fill toward --lr-color-mix-partner instead of restating the border colour. */
  [part='copy-button']:active {
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
