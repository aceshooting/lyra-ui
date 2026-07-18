import { css } from 'lit';

export const styles = css`
  :host {
    display: inline;
    line-height: var(--lr-line-height-normal);
  }
  .wrapper {
    display: inline;
  }
  [part='base'] {
    display: inline;
    box-sizing: border-box;
    padding: 0 var(--lr-size-6px);
    border: var(--lr-border-width-thin) solid var(--lr-entity-chip-border, transparent);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-entity-chip-bg, var(--lr-color-brand-quiet));
    color: var(--lr-entity-chip-color, var(--lr-color-brand));
    font: inherit;
    font-size: var(--lr-size-0-875em);
    font-weight: var(--lr-font-weight-medium);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:hover {
    background: color-mix(in srgb, var(--lr-entity-chip-color, var(--lr-color-brand)) 16%, var(--lr-entity-chip-bg, var(--lr-color-brand-quiet)));
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
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
`;
