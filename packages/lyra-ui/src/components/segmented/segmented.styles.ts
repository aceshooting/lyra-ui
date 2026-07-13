import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
  }
  [part='base'] {
    display: inline-flex;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: var(--lyra-size-0-125rem);
    gap: var(--lyra-size-0-125rem);
  }
  [part='segment'] {
    border: none;
    border-radius: calc(var(--lyra-radius) * 0.7);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    padding: var(--lyra-size-0-125rem) var(--lyra-space-s);
    cursor: pointer;
  }
  [part='segment'][aria-disabled='true'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='segment']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='segment'][aria-checked='true'] {
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font-weight: var(--lyra-font-weight-semibold);
    box-shadow: var(--lyra-shadow);
  }
`;
