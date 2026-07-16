import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: grid;
    gap: var(--lyra-space-s);
    min-inline-size: 0;
  }
  [part='viewport'] {
    position: relative;
    min-inline-size: 0;
    overflow: hidden;
    outline: none;
  }
  [part='viewport']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='track'] {
    display: block;
    min-inline-size: 0;
  }
  [part='track'] > ::slotted(*) {
    min-inline-size: 0;
  }
  [part='controls'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lyra-space-s);
  }
  [part='previous-button'],
  [part='next-button'],
  [part='indicator'] {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='previous-button'],
  [part='next-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
  }
  [part='previous-button']:hover,
  [part='next-button']:hover,
  [part='indicator'][aria-current='true'] {
    background: var(--lyra-color-brand-quiet);
    border-color: var(--lyra-color-brand);
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible,
  [part='indicator']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='indicators'] {
    display: flex;
    justify-content: center;
    gap: var(--lyra-space-xs);
  }
  [part='indicator'] {
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    padding: 0;
  }
  :host(:dir(rtl)) [part='previous-glyph'],
  :host(:dir(rtl)) [part='next-glyph'] {
    transform: scaleX(-1);
  }
`;
