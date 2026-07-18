import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: baseline;
    line-height: var(--lr-line-height-none);
    /* Per-status accent -- one pair of custom properties swapped by the
       :host([status]) rules below rather than repeating background/color
       per part per status. 'default' (and any unrecognized status) stays
       plain/neutral -- transparent background, quiet text -- rather than
       inventing a seventh visual tone for "no signal at all". */
    --lr-citation-badge-accent: var(--lr-color-text-quiet);
    --lr-citation-badge-bg: transparent;
    --lr-citation-badge-border: transparent;
  }

  :host([status='high']),
  :host([status='verified']) {
    --lr-citation-badge-accent: var(--lr-color-success);
    --lr-citation-badge-bg: var(--lr-color-success-quiet);
  }
  :host([status='medium']),
  :host([status='low']) {
    --lr-citation-badge-accent: var(--lr-color-warning);
    --lr-citation-badge-bg: var(--lr-color-warning-quiet);
  }
  /* Deliberately its own danger tone, not grouped with 'low' -- see the
     component doc's status-coloring note: "hasn't been checked" reads as a
     distinct (riskier) claim from "checked but uncertain". */
  :host([status='unverified']) {
    --lr-citation-badge-accent: var(--lr-color-danger);
    --lr-citation-badge-bg: var(--lr-color-danger-quiet);
  }

  .wrapper {
    display: inline-flex;
  }

  [part='base'] {
    display: inline-flex;
    align-items: baseline;
    box-sizing: border-box;
    padding: 0 var(--lr-size-0-3em);
    border: var(--lr-border-width-thin) solid var(--lr-citation-badge-border);
    border-radius: calc(var(--lr-radius) * 0.6);
    background: var(--lr-citation-badge-bg);
    color: var(--lr-citation-badge-accent);
    font: inherit;
    font-size: var(--lr-size-0-75em);
    font-weight: var(--lr-font-weight-semibold);
    font-variant-numeric: tabular-nums;
    line-height: var(--lr-line-height-normal);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part='base']:hover {
    border-color: var(--lr-citation-badge-accent);
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='bracket'] {
    opacity: 0.7;
  }

  /* Positioned by internal/positioner.js's place() -- same fixed/z-index/
     max-size shape as lr-tool-call-chip's own [part='tooltip']. No open/
     close transition, for the same reason that one has none: a preview
     that tracks the pointer/focus target should appear instantly, not
     chase a fade. */
  [part='popover'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-inline-size: min(90vw, var(--lr-size-22rem));
    padding: var(--lr-space-s) var(--lr-space-m);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
    color: var(--lr-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'] {
      transition: none !important;
    }
  }
`;
