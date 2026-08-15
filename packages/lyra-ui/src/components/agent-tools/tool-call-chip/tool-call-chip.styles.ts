import { css } from "lit";

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    /* Per-status accent -- one custom property swapped by the :host([status])
       rules below rather than repeating background/color per part per status.
       Defaults to the 'pending' tone so an unset/unknown status still reads
       as neutral instead of unstyled. */
    --_lr-tool-call-chip-accent: var(--lr-color-text-quiet);
    --_lr-tool-call-chip-bg: var(--lr-color-surface);
    --_lr-tool-call-chip-border: var(--lr-color-border);
    --_lr-tool-call-chip-spin: var(--lr-transition-ambient);
  }

  :host([status="running"]) {
    --_lr-tool-call-chip-accent: var(--lr-color-brand);
    --_lr-tool-call-chip-bg: var(--lr-color-brand-quiet);
    --_lr-tool-call-chip-border: transparent;
  }
  :host([status="success"]) {
    --_lr-tool-call-chip-accent: var(--lr-color-success);
    --_lr-tool-call-chip-bg: var(--lr-color-success-quiet);
    --_lr-tool-call-chip-border: transparent;
  }
  :host([status="error"]) {
    --_lr-tool-call-chip-accent: var(--lr-color-danger);
    --_lr-tool-call-chip-bg: var(--lr-color-danger-quiet);
    --_lr-tool-call-chip-border: transparent;
  }
  /* 'denied' reads as a policy rejection, not a runtime failure -- the
     warning (not danger) tint keeps it visually distinct from 'error',
     matching lr-tool-result-dialog's identical status vocabulary/tone so
     the two components agree on what "denied" looks like. */
  :host([status="denied"]) {
    --_lr-tool-call-chip-accent: var(--lr-color-warning);
    --_lr-tool-call-chip-bg: var(--lr-color-warning-quiet);
    --_lr-tool-call-chip-border: transparent;
  }

  [part="base"] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid
      var(--lr-tool-call-chip-border, var(--_lr-tool-call-chip-border));
    border-radius: var(--lr-radius-pill);
    background: var(--lr-tool-call-chip-bg, var(--_lr-tool-call-chip-bg));
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
    text-align: start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part="base"]:hover {
    border-color: var(--lr-color-brand);
  }
  /* The hover moves the border only, which leaves the pressed step nothing to deepen -- so pressed
     tints the chip's own fill toward --lr-color-mix-partner (which follows the text colour). The
     fill is already a custom property, so this one declaration covers all five status tints without
     restating any of them, and darkens in a light theme while lightening in a dark one. */
  [part="base"]:active {
    background: color-mix(
      in oklab,
      var(--lr-tool-call-chip-bg, var(--_lr-tool-call-chip-bg)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part="icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--lr-tool-call-chip-accent, var(--_lr-tool-call-chip-accent));
  }
  [part="icon"] svg {
    display: block;
  }
  /* A three-quarter arc (not a full ring) is what actually reads as
     spinning once rotated -- a full circle looks identical at every
     rotation frame. */
  :host([status="running"]) [part="icon"] svg {
    animation: lr-tool-call-chip-spin
      var(--lr-tool-call-chip-spin, var(--_lr-tool-call-chip-spin)) infinite;
  }
  /* Subtler than the spin -- a slow opacity breathe, so a list of several
     still-queued chips doesn't compete visually with any 'running' ones
     next to it. */
  :host([status="pending"]) [part="icon"] svg {
    animation: lr-tool-call-chip-pulse var(--lr-transition-ambient) infinite;
  }

  [part="label"] {
    display: inline-flex;
    align-items: baseline;
    gap: var(--lr-size-0-3em);
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-6ch);
    overflow: hidden;
  }
  [part="category"] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* Full-strength text, not --lr-color-text-quiet -- this sits on top of
       the per-status *-quiet tint backgrounds above (e.g. success-quiet),
       and text-quiet's gray fails WCAG AA contrast against several of those
       tints even though it comfortably passes against the plain surface
       background used by the resting/denied states. */
    color: var(--lr-color-text);
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
  }
  [part="category"]::after {
    content: "·";
    margin-inline-start: var(--lr-size-0-3em);
  }
  [part="name"] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part="summary"] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-3ch);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* See [part='category']'s comment above -- same contrast rationale. */
    color: var(--lr-color-text);
  }
  [part="summary"]::before {
    content: ": ";
  }

  [part="meta"] {
    display: inline-flex;
    flex: 0 1 auto;
    flex-wrap: wrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    align-items: baseline;
    gap: var(--lr-size-0-4em);
    margin-inline-start: auto;
    font-size: var(--lr-size-0-6875rem);
  }
  [part="status-text"] {
    color: var(--lr-tool-call-chip-accent, var(--_lr-tool-call-chip-accent));
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-03em);
    min-inline-size: 0;
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: end;
  }
  [part="duration"] {
    /* See [part='category']'s comment above -- same contrast rationale. */
    color: var(--lr-color-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Positioned by internal/positioner.js's place() -- see combobox's
     [part='listbox'] for the identical fixed/z-index/max-size shape. Unlike
     that popup this one has no open/close transition: a tooltip that
     tracks the pointer/focus target benefits from appearing instantly, not
     chasing a fade. */
  [part="tooltip"] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-24rem),
      var(
        --lr-positioner-available-inline-size,
        var(--lr-popover-viewport-clamp)
      )
    );
    max-block-size: min(
      var(--lr-size-20rem),
      var(--lr-positioner-available-block-size, var(--lr-size-20rem))
    );
    overflow: auto;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
    padding: var(--lr-space-s) var(--lr-space-m);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow-m);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
    color: var(--lr-color-text);
  }

  @keyframes lr-tool-call-chip-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes lr-tool-call-chip-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part="base"] {
      transition: none !important;
    }
    :host([status="running"]) [part="icon"] svg,
    :host([status="pending"]) [part="icon"] svg {
      animation: none !important;
    }
  }
`;
