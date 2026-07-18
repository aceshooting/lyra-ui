import { css } from 'lit';

export const styles = css`
  :host {
    display: inline;
    line-height: var(--lyra-line-height-normal);
  }
  .wrapper {
    display: inline;
  }
  [part='base'] {
    display: inline;
    box-sizing: border-box;
    padding: 0 var(--lyra-size-6px);
    border: var(--lyra-border-width-thin) solid var(--lyra-entity-chip-border, transparent);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-entity-chip-bg, var(--lyra-color-brand-quiet));
    color: var(--lyra-entity-chip-color, var(--lyra-color-brand));
    font: inherit;
    font-size: var(--lyra-size-0-875em);
    font-weight: var(--lyra-font-weight-medium);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:hover {
    background: color-mix(in srgb, var(--lyra-entity-chip-color, var(--lyra-color-brand)) 16%, var(--lyra-entity-chip-bg, var(--lyra-color-brand-quiet)));
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
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
`;
