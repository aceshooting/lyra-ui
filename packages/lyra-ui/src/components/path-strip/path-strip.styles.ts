import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: block;
  }
  [part='node'],
  [part='relation'] {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    padding: var(--lyra-size-2px) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    white-space: nowrap;
    cursor: pointer;
  }
  [part='relation'] {
    color: var(--lyra-color-text-quiet);
    background: transparent;
    border-color: transparent;
  }
  [part='node']:focus-visible,
  [part='relation']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='arrow'] {
    display: inline-flex;
    align-items: center;
    margin-inline: var(--lyra-size-2px);
    color: var(--lyra-color-text-quiet);
  }
  .element-group {
    display: inline-flex;
    align-items: center;
  }
  [part='empty'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
  }
`;
