import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    /* Per-status accent -- one custom property swapped by the :host([status])
       rules below rather than repeating background/color per part per status.
       Defaults to the 'pending' tone so an unset/unknown status still reads
       as neutral instead of unstyled. */
    --lr-tool-call-chip-accent: var(--lr-color-text-quiet);
    --lr-tool-call-chip-bg: var(--lr-color-surface);
    --lr-tool-call-chip-border: var(--lr-color-border);
    --lr-tool-call-chip-spin: 1s linear;
  }

  :host([status='running']) {
    --lr-tool-call-chip-accent: var(--lr-color-brand);
    --lr-tool-call-chip-bg: var(--lr-color-brand-quiet);
    --lr-tool-call-chip-border: transparent;
  }
  :host([status='success']) {
    --lr-tool-call-chip-accent: var(--lr-color-success);
    --lr-tool-call-chip-bg: var(--lr-color-success-quiet);
    --lr-tool-call-chip-border: transparent;
  }
  :host([status='error']) {
    --lr-tool-call-chip-accent: var(--lr-color-danger);
    --lr-tool-call-chip-bg: var(--lr-color-danger-quiet);
    --lr-tool-call-chip-border: transparent;
  }
  /* 'denied' reads as a policy rejection, not a runtime failure -- the
     warning (not danger) tint keeps it visually distinct from 'error',
     matching lr-tool-result-dialog's identical status vocabulary/tone so
     the two components agree on what "denied" looks like. */
  :host([status='denied']) {
    --lr-tool-call-chip-accent: var(--lr-color-warning);
    --lr-tool-call-chip-bg: var(--lr-color-warning-quiet);
    --lr-tool-call-chip-border: transparent;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-tool-call-chip-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-tool-call-chip-bg);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
    text-align: start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part='base']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--lr-tool-call-chip-accent);
  }
  [part='icon'] svg {
    display: block;
  }
  /* A three-quarter arc (not a full ring) is what actually reads as
     spinning once rotated -- a full circle looks identical at every
     rotation frame. */
  :host([status='running']) [part='icon'] svg {
    animation: lr-tool-call-chip-spin var(--lr-tool-call-chip-spin) infinite;
  }
  /* Subtler than the spin -- a slow opacity breathe, so a list of several
     still-queued chips doesn't compete visually with any 'running' ones
     next to it. */
  :host([status='pending']) [part='icon'] svg {
    animation: lr-tool-call-chip-pulse var(--lr-transition-ambient) infinite;
  }

  [part='label'] {
    display: inline-flex;
    align-items: baseline;
    gap: var(--lr-size-0-3em);
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
  }
  [part='category'] {
    flex: 0 0 auto;
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
  [part='category']::after {
    content: '·';
    margin-inline-start: var(--lr-size-0-3em);
  }
  [part='name'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='summary'] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-3ch);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* See [part='category']'s comment above -- same contrast rationale. */
    color: var(--lr-color-text);
  }
  [part='summary']::before {
    content: ': ';
  }

  [part='meta'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: baseline;
    gap: var(--lr-size-0-4em);
    margin-inline-start: auto;
    font-size: var(--lr-size-0-6875rem);
  }
  [part='status-text'] {
    color: var(--lr-tool-call-chip-accent);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-03em);
    white-space: nowrap;
  }
  [part='duration'] {
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
  [part='tooltip'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-24rem));
    padding: var(--lr-space-s) var(--lr-space-m);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
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
    [part='base'] {
      transition: none !important;
    }
    :host([status='running']) [part='icon'] svg,
    :host([status='pending']) [part='icon'] svg {
      animation: none !important;
    }
  }
`;
