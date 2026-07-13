import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: baseline;
    line-height: var(--lyra-line-height-none);
    /* Per-status accent -- one pair of custom properties swapped by the
       :host([status]) rules below rather than repeating background/color
       per part per status. 'default' (and any unrecognized status) stays
       plain/neutral -- transparent background, quiet text -- rather than
       inventing a seventh visual tone for "no signal at all". */
    --lyra-citation-badge-accent: var(--lyra-color-text-quiet);
    --lyra-citation-badge-bg: transparent;
    --lyra-citation-badge-border: transparent;
  }

  :host([status='high']),
  :host([status='verified']) {
    --lyra-citation-badge-accent: var(--lyra-color-success);
    --lyra-citation-badge-bg: var(--lyra-color-success-quiet);
  }
  :host([status='medium']),
  :host([status='low']) {
    --lyra-citation-badge-accent: var(--lyra-color-warning);
    --lyra-citation-badge-bg: var(--lyra-color-warning-quiet);
  }
  /* Deliberately its own danger tone, not grouped with 'low' -- see the
     component doc's status-coloring note: "hasn't been checked" reads as a
     distinct (riskier) claim from "checked but uncertain". */
  :host([status='unverified']) {
    --lyra-citation-badge-accent: var(--lyra-color-danger);
    --lyra-citation-badge-bg: var(--lyra-color-danger-quiet);
  }

  .wrapper {
    display: inline-flex;
  }

  [part='base'] {
    display: inline-flex;
    align-items: baseline;
    box-sizing: border-box;
    padding: 0 var(--lyra-size-0-3em);
    border: var(--lyra-border-width-thin) solid var(--lyra-citation-badge-border);
    border-radius: calc(var(--lyra-radius) * 0.6);
    background: var(--lyra-citation-badge-bg);
    color: var(--lyra-citation-badge-accent);
    font: inherit;
    font-size: var(--lyra-size-0-75em);
    font-weight: var(--lyra-font-weight-semibold);
    font-variant-numeric: tabular-nums;
    line-height: var(--lyra-line-height-normal);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lyra-transition-fast),
      border-color var(--lyra-transition-fast);
  }
  [part='base']:hover {
    border-color: var(--lyra-citation-badge-accent);
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='bracket'] {
    opacity: 0.7;
  }

  /* Positioned by internal/positioner.js's place() -- same fixed/z-index/
     max-size shape as lyra-tool-call-chip's own [part='tooltip']. No open/
     close transition, for the same reason that one has none: a preview
     that tracks the pointer/focus target should appear instantly, not
     chase a fade. */
  [part='popover'] {
    position: fixed;
    z-index: var(--lyra-layer-dropdown);
    box-sizing: border-box;
    max-inline-size: min(90vw, var(--lyra-size-22rem));
    padding: var(--lyra-space-s) var(--lyra-space-m);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-1-4);
    color: var(--lyra-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'] {
      transition: none !important;
    }
  }
`;
