import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-2xs);
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  [part='previous-button'],
  [part='next-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-size-1-5rem);
    block-size: var(--lyra-size-1-5rem);
    padding: 0;
    border: 0;
    border-radius: var(--lyra-radius-xs);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  [part='previous-button']:hover:not(:disabled),
  [part='next-button']:hover:not(:disabled) {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  [part='previous-glyph'],
  [part='next-glyph'] {
    display: inline-flex;
    line-height: var(--lyra-line-height-none);
  }
  [part='previous-glyph'] {
    transform: rotate(180deg);
  }
  [part='next-glyph'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='previous-glyph'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='next-glyph'] {
    transform: rotate(180deg);
  }
  [part='position'] {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
`;
