import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    max-inline-size: 100%;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    max-inline-size: 100%;
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-snug);
    color: var(--lyra-color-text-quiet);
  }

  [part='elapsed'] {
    /* Full-strength text, not the quieter --lyra-color-text-quiet the rest
       of the readout uses -- elapsed time is the one figure this component
       always shows (tokens/throughput are optional), so it gets the higher-
       contrast treatment to read as the primary value at a glance. */
    color: var(--lyra-color-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  [part='tokens'],
  [part='throughput'] {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Segments are joined with a middot rather than a flex gap + separate
     separator element, so a segment that doesn't render (tokens/throughput
     are both optional, see the class doc) never leaves a dangling
     double-gap -- the dot only ever appears immediately before a segment
     that's actually present. */
  [part='tokens']::before,
  [part='throughput']::before {
    content: '·';
    margin-inline: var(--lyra-size-0-4em);
    opacity: 0.6;
  }

  [part='stop-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Meets the shared minimum tappable size (--lyra-icon-button-size) --
       previously shrunk below the floor (min(...) capped at 1.75rem/28px)
       for a compact inline look, but the readout row has no width
       constraint that requires it, so the full 40px floor applies
       directly instead of via invisible hit-slop. */
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    margin-inline-start: var(--lyra-space-s);
    padding: 0;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: 50%;
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lyra-transition-fast),
      border-color var(--lyra-transition-fast),
      color var(--lyra-transition-fast);
  }
  [part='stop-button']:hover {
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
  }
  [part='stop-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
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
