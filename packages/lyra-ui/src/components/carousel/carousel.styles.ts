import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: grid;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='viewport'] {
    position: relative;
    min-inline-size: 0;
    overflow: hidden;
    outline: none;
  }
  [part='viewport']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
    gap: var(--lr-space-s);
  }
  [part='previous-button'],
  [part='next-button'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='previous-button'],
  [part='next-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='previous-button']:hover,
  [part='next-button']:hover {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible,
  [part='indicator']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='indicators'] {
    display: flex;
    justify-content: center;
    gap: var(--lr-space-xs);
  }
  /* The interactive hit target meets the shared minimum tappable size (same --lr-icon-button-size
     floor as lr-code-block's/lr-json-viewer's [part='toggle'] and lr-swatch-picker's
     [part='swatch']), while the *visible* dot stays a compact --lr-size-0-5rem circle -- rendered
     on the separate [part='indicator-dot'] child below and centered via flex, not by resizing this
     button itself. */
  [part='indicator'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-radius-pill);
    background: transparent;
    cursor: pointer;
  }
  [part='indicator-dot'] {
    display: block;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
  }
  [part='indicator'][aria-current='true'] [part='indicator-dot'] {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  :host(:dir(rtl)) [part='previous-glyph'],
  :host(:dir(rtl)) [part='next-glyph'] {
    transform: scaleX(-1);
  }
`;
