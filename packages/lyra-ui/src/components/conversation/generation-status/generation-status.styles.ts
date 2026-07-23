import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    min-inline-size: 0;
    vertical-align: middle;
    max-inline-size: 100%;
  }

  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    max-inline-size: 100%;
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
    color: var(--lr-color-text-quiet);
  }

  [part='elapsed'] {
    /* Full-strength text, not the quieter --lr-color-text-quiet the rest
       of the readout uses -- elapsed time is the one figure this component
       always shows (tokens/throughput are optional), so it gets the higher-
       contrast treatment to read as the primary value at a glance. */
    color: var(--lr-color-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  [part='tokens'],
  [part='throughput'] {
    min-inline-size: 0;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  /* Segments are joined with a middot rather than a flex gap + separate
     separator element, so a segment that doesn't render (tokens/throughput
     are both optional, see the class doc) never leaves a dangling
     double-gap -- the dot only ever appears immediately before a segment
     that's actually present. */
  [part='tokens']::before,
  [part='throughput']::before {
    content: '·';
    margin-inline: var(--lr-size-0-4em);
    opacity: 0.6;
  }

  [part='stop-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Meets the shared minimum tappable size (--lr-icon-button-size) --
       previously shrunk below the floor (min(...) capped at 1.75rem/28px)
       for a compact inline look, but the readout row has no width
       constraint that requires it, so the full 40px floor applies
       directly instead of via invisible hit-slop. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin-inline-start: var(--lr-space-s);
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: 50%;
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast),
      color var(--lr-transition-fast);
  }
  [part='stop-button']:hover {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
  }
  [part='stop-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='stop-button'] svg {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='stop-button'] {
      transition: none !important;
    }
  }
`;
