import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Lets the host shrink below its row's max-content width when it's a flex/grid
       item in a consumer's own narrow layout -- the default min-width:auto for flex
       items would otherwise force the row wide regardless of [part='base']'s
       flex-wrap below. */
    min-inline-size: 0;
  }
  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: var(--lyra-size-0-125rem);
    gap: var(--lyra-size-0-125rem);
  }
  [part='segment'] {
    min-inline-size: 0;
    border: none;
    border-radius: calc(var(--lyra-radius) * 0.7);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    padding: var(--lyra-size-0-125rem) var(--lyra-space-s);
    cursor: pointer;
  }
  [part='segment-icon'] {
    display: inline-flex;
    align-items: center;
    margin-inline-end: var(--lyra-space-xs);
    block-size: var(--lyra-size-1em);
    max-inline-size: var(--lyra-size-2-5rem);
  }
  [part='segment'][aria-disabled='true'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='segment']:hover:not([aria-disabled='true']):not([aria-checked='true']) {
    color: var(--lyra-color-text);
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
