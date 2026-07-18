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
  [part='next-button'] {
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
  [part='next-button']:hover {
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
  /* The interactive hit target meets the shared minimum tappable size (same --lyra-icon-button-size
     floor as lyra-code-block's/lyra-json-viewer's [part='toggle'] and lyra-swatch-picker's
     [part='swatch']), while the *visible* dot stays a compact --lyra-size-0-5rem circle -- rendered
     on the separate [part='indicator-dot'] child below and centered via flex, not by resizing this
     button itself. */
  [part='indicator'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lyra-radius-pill);
    background: transparent;
    cursor: pointer;
  }
  [part='indicator-dot'] {
    display: block;
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface);
  }
  [part='indicator'][aria-current='true'] [part='indicator-dot'] {
    background: var(--lyra-color-brand-quiet);
    border-color: var(--lyra-color-brand);
  }
  :host(:dir(rtl)) [part='previous-glyph'],
  :host(:dir(rtl)) [part='next-glyph'] {
    transform: scaleX(-1);
  }
`;
