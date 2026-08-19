import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: baseline;
    line-height: var(--lr-line-height-none);
    /* Per-status private defaults -- the :host([status]) rules below change one pair instead of
       repeating background/color; a public hook, inherited or direct, stays authoritative per part
       per status. 'default' and any unrecognized status stay plain/neutral -- transparent
       background, quiet text -- not a seventh visual tone for "no signal at all". */
    --_lr-citation-badge-accent: var(--lr-color-text-quiet);
    --_lr-citation-badge-bg: transparent;
    --_lr-citation-badge-border: transparent;
  }

  :host([status="high"]),
  :host([status="verified"]) {
    --_lr-citation-badge-accent: var(--lr-color-success);
    --_lr-citation-badge-bg: var(--lr-color-success-quiet);
  }
  :host([status="medium"]),
  :host([status="low"]) {
    --_lr-citation-badge-accent: var(--lr-color-warning);
    --_lr-citation-badge-bg: var(--lr-color-warning-quiet);
  }
  /* Deliberately its own danger tone, not grouped with 'low' -- "hasn't been checked" reads as a
     distinct, riskier claim than "checked but uncertain" (see the component doc). */
  :host([status="unverified"]) {
    --_lr-citation-badge-accent: var(--lr-color-danger);
    --_lr-citation-badge-bg: var(--lr-color-danger-quiet);
  }

  .wrapper {
    display: inline-flex;
  }

  [part="base"] {
    display: inline-flex;
    align-items: baseline;
    /* Cross-axis stays baseline (the number sits on the surrounding text's baseline); the main axis
       must centre, since the min-inline-size hit-area floor below is far wider than a one- or
       two-digit label and the default justify-content (normal => flex-start) left that number
       hugging the leading edge. */
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0 var(--lr-size-0-3em);
    border: var(--lr-border-width-thin) solid
      var(--lr-citation-badge-border, var(--_lr-citation-badge-border));
    border-radius: calc(var(--lr-radius) * 0.6);
    background: var(--lr-citation-badge-bg, var(--_lr-citation-badge-bg));
    color: var(--lr-citation-badge-accent, var(--_lr-citation-badge-accent));
    font: inherit;
    font-size: var(--lr-size-0-75em);
    font-weight: var(--lr-font-weight-semibold);
    font-variant-numeric: tabular-nums;
    line-height: var(--lr-line-height-normal);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part="base"]:hover {
    border-color: var(
      --lr-citation-badge-accent,
      var(--_lr-citation-badge-accent)
    );
  }
  /* Pressed goes past the hover border alone: the badge's own per-status fill mixed toward
     --lr-color-mix-partner. Works for 'default' too, whose fill is transparent -- the mix resolves
     to the partner at --lr-color-mix-active alpha. */
  [part="base"]:active {
    border-color: var(
      --lr-citation-badge-accent,
      var(--_lr-citation-badge-accent)
    );
    background: color-mix(
      in oklab,
      var(--lr-citation-badge-bg, var(--_lr-citation-badge-bg)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part="bracket"] {
    opacity: 0.7;
  }

  /* Positioned by internal/positioner.js's place() -- same fixed/z-index/max-size shape as
     lr-tool-call-chip's own [part='tooltip'], and no open/close transition for the same reason: a
     preview tracking the pointer/focus target should appear instantly, not chase a fade. */
  [part="popover"] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-22rem)
    );
    padding: var(--lr-space-s) var(--lr-space-m);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow-m);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
    color: var(--lr-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    [part="base"] {
      transition: none !important;
    }
  }
`;
