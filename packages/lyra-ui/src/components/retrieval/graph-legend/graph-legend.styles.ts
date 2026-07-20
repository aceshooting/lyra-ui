import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
  }
  [part~='item'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-size-2px) var(--lr-space-xs);
    border: none;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
  }
  button[part~='item'] {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity var(--lr-transition-fast);
  }
  button[part~='item']:hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
  }
  button[part~='item']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Dim only the decorative (aria-hidden) swatch on opacity; re-color the text parts via the
     quiet-text token instead of opacity, so a hidden item's label keeps AA contrast rather than
     fading toward the background (opacity on the whole item drops label contrast below 4.5:1). */
  [part~='item'][data-hidden] [part='swatch'] {
    opacity: 0.5;
  }
  [part~='item'][data-hidden] [part='label'],
  [part~='item'][data-hidden] [part='count'] {
    color: var(--lr-graph-legend-hidden-color, var(--lr-color-text-quiet));
  }
  [part='swatch'] {
    flex: 0 0 auto;
    display: block;
    color: var(--lr-color-text);
  }
  [part='label'] {
    white-space: nowrap;
  }
  [part='count'] {
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }
`;
