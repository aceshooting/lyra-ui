import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-s);
  }
  [part~='item'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-size-2px) var(--lyra-space-xs);
    border: none;
    border-radius: var(--lyra-radius-xs);
    background: transparent;
    color: var(--lyra-color-text);
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-snug);
  }
  button[part~='item'] {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity var(--lyra-transition-fast);
  }
  button[part~='item']:hover {
    background: color-mix(in srgb, var(--lyra-color-text) 8%, transparent);
  }
  button[part~='item']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  /* Dim only the decorative (aria-hidden) swatch on opacity; re-color the text parts via the
     quiet-text token instead of opacity, so a hidden item's label keeps AA contrast rather than
     fading toward the background (opacity on the whole item drops label contrast below 4.5:1). */
  [part~='item'][data-hidden] [part='swatch'] {
    opacity: 0.5;
  }
  [part~='item'][data-hidden] [part='label'],
  [part~='item'][data-hidden] [part='count'] {
    color: var(--lyra-color-text-quiet);
  }
  [part='swatch'] {
    flex: 0 0 auto;
    display: block;
    color: var(--lyra-color-text);
  }
  [part='label'] {
    white-space: nowrap;
  }
  [part='count'] {
    color: var(--lyra-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }
`;
