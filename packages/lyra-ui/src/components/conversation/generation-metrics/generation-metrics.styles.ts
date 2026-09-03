import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    min-inline-size: 0;
    vertical-align: middle;
    max-inline-size: 100%;
    font-size: var(--lr-font-size-sm);
  }

  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    max-inline-size: 100%;
    font: inherit;
    line-height: var(--lr-line-height-snug);
    color: var(--lr-color-text-quiet);
  }

  [part='elapsed'] {
    /* Full-strength text, not the --lr-color-text-quiet the rest of the readout uses: elapsed
       time is the one figure always shown (tokens and throughput are optional), so it reads as
       the primary value. */
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

  /* Segments are joined with a middot rather than a flex gap plus a separator element, so a
     segment that does not render (tokens and throughput are optional -- see the class doc) leaves
     no dangling double gap; the dot only ever precedes a segment that is present. */
  [part='tokens']::before,
  [part='throughput']::before {
    content: '·';
    margin-inline: var(--lr-size-0-4em);
    opacity: 0.6;
  }

  [part='stop-button'] {
    font: inherit;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Meets the shared minimum tappable size (--lr-icon-button-size). It was previously capped
       below the floor at 1.75rem/28px for a compact inline look, but nothing in the readout row
       requires that, so the full 40px floor applies directly rather than via invisible hit-slop.
       */
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
  /* Hover recolors the chrome only; the press also fills the disc, mixing its resting surface
     toward the text color, so pressed escalates hover instead of replacing it with an unrelated
     color. */
  [part='stop-button']:active {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
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
