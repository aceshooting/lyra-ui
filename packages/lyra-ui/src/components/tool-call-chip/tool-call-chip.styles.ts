import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    /* Per-status accent -- one custom property swapped by the :host([status])
       rules below rather than repeating background/color per part per status.
       Defaults to the 'pending' tone so an unset/unknown status still reads
       as neutral instead of unstyled. */
    --lyra-tool-call-chip-accent: var(--lyra-color-text-quiet);
    --lyra-tool-call-chip-bg: var(--lyra-color-surface);
    --lyra-tool-call-chip-border: var(--lyra-color-border);
  }

  :host([status='running']) {
    --lyra-tool-call-chip-accent: var(--lyra-color-brand);
    --lyra-tool-call-chip-bg: var(--lyra-color-brand-quiet);
    --lyra-tool-call-chip-border: transparent;
  }
  :host([status='success']) {
    --lyra-tool-call-chip-accent: var(--lyra-color-success);
    --lyra-tool-call-chip-bg: var(--lyra-color-success-quiet);
    --lyra-tool-call-chip-border: transparent;
  }
  :host([status='error']) {
    --lyra-tool-call-chip-accent: var(--lyra-color-danger);
    --lyra-tool-call-chip-bg: var(--lyra-color-danger-quiet);
    --lyra-tool-call-chip-border: transparent;
  }
  /* 'denied' reads as a policy rejection, not a runtime failure -- the
     warning (not danger) tint keeps it visually distinct from 'error',
     matching lyra-tool-result-dialog's identical status vocabulary/tone so
     the two components agree on what "denied" looks like. */
  :host([status='denied']) {
    --lyra-tool-call-chip-accent: var(--lyra-color-warning);
    --lyra-tool-call-chip-bg: var(--lyra-color-warning-quiet);
    --lyra-tool-call-chip-border: transparent;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: 0.25rem var(--lyra-space-s);
    border: 1px solid var(--lyra-tool-call-chip-border);
    border-radius: 999px;
    background: var(--lyra-tool-call-chip-bg);
    color: var(--lyra-color-text);
    font: inherit;
    font-size: 0.8125rem;
    line-height: 1.3;
    text-align: start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lyra-transition-fast),
      border-color var(--lyra-transition-fast);
  }
  [part='base']:hover {
    border-color: var(--lyra-color-brand);
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--lyra-tool-call-chip-accent);
  }
  [part='icon'] svg {
    display: block;
  }
  /* A three-quarter arc (not a full ring) is what actually reads as
     spinning once rotated -- a full circle looks identical at every
     rotation frame. */
  :host([status='running']) [part='icon'] svg {
    animation: lyra-tool-call-chip-spin 1s linear infinite;
  }
  /* Subtler than the spin -- a slow opacity breathe, so a list of several
     still-queued chips doesn't compete visually with any 'running' ones
     next to it. */
  :host([status='pending']) [part='icon'] svg {
    animation: lyra-tool-call-chip-pulse 1.5s ease-in-out infinite;
  }

  [part='label'] {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3em;
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
  }
  [part='category'] {
    flex: 0 0 auto;
    /* Full-strength text, not --lyra-color-text-quiet -- this sits on top of
       the per-status *-quiet tint backgrounds above (e.g. success-quiet),
       and text-quiet's gray fails WCAG AA contrast against several of those
       tints even though it comfortably passes against the plain surface
       background used by the resting/denied states. */
    color: var(--lyra-color-text);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  [part='category']::after {
    content: '·';
    margin-inline-start: 0.3em;
  }
  [part='name'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  [part='summary'] {
    flex: 1 1 auto;
    min-inline-size: 3ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* See [part='category']'s comment above -- same contrast rationale. */
    color: var(--lyra-color-text);
  }
  [part='summary']::before {
    content: ': ';
  }

  [part='meta'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: baseline;
    gap: 0.4em;
    margin-inline-start: auto;
    font-size: 0.6875rem;
  }
  [part='status-text'] {
    color: var(--lyra-tool-call-chip-accent);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  [part='duration'] {
    /* See [part='category']'s comment above -- same contrast rationale. */
    color: var(--lyra-color-text);
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
    z-index: 900;
    box-sizing: border-box;
    max-inline-size: min(90vw, 24rem);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--lyra-color-text);
  }

  @keyframes lyra-tool-call-chip-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes lyra-tool-call-chip-pulse {
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
