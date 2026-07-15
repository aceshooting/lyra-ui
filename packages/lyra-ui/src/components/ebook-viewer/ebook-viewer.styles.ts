import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    box-sizing: border-box;
    overflow: hidden;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='toolbar'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='previous-button'],
  [part='next-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-size-2rem);
    block-size: var(--lyra-size-2rem);
    padding: 0;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='previous-icon'],
  [part='next-icon'] {
    display: inline-flex;
  }
  [part='previous-icon'] { transform: rotate(180deg); }
  :host(:dir(rtl)) [part='previous-icon'] { transform: rotate(0deg); }
  :host(:dir(rtl)) [part='next-icon'] { transform: rotate(180deg); }
  [part='mount'] {
    flex: 1 1 auto;
    min-block-size: var(--lyra-size-10rem);
    overflow: hidden;
  }
  [part='mount'] iframe {
    display: block;
    border: none;
  }
  .status-note,
  [part='error'] {
    margin: 0;
    padding: var(--lyra-space-l);
    text-align: center;
  }
  .status-note { color: var(--lyra-color-text-quiet); }
  [part='error'] { color: var(--lyra-color-danger); }
`;
