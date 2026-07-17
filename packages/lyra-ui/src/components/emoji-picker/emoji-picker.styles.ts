import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: var(--lyra-space-s);
    background: var(--lyra-color-surface);
  }
  [part='search'] {
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
  }
  [part='search']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='grid'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-2xs);
    max-block-size: var(--lyra-size-16rem);
    overflow-y: auto;
  }
  [part='group-label'] {
    flex-basis: 100%;
    padding-block: var(--lyra-space-2xs);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='emoji'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-size-2rem);
    block-size: var(--lyra-size-2rem);
    border: none;
    border-radius: var(--lyra-radius-xs);
    background: transparent;
    font-size: var(--lyra-font-size-lg);
    cursor: pointer;
  }
  [part='emoji']:hover,
  [part='emoji'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='empty'] {
    flex-basis: 100%;
    padding: var(--lyra-space-m);
    text-align: center;
    color: var(--lyra-color-text-quiet);
  }
`;
