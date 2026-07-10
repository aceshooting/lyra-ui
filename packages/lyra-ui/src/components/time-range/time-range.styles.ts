import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    block-size: 1.5rem;
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    display: flex;
    align-items: center;
  }
  [part='track'] {
    position: absolute;
    inset-inline: 0;
    block-size: 4px;
    border-radius: 2px;
    background: var(--lyra-color-border);
  }
  [part='range'] {
    position: absolute;
    block-size: 4px;
    border-radius: 2px;
    background: var(--lyra-color-brand);
  }
  [part^='handle'] {
    position: absolute;
    inline-size: 14px;
    block-size: 14px;
    border-radius: 50%;
    background: var(--lyra-color-brand);
    border: 2px solid var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
    transform: translateX(-50%);
    cursor: grab;
    touch-action: none;
  }
  [part^='handle']:focus-visible {
    outline: 2px solid var(--lyra-color-brand);
    outline-offset: 2px;
  }
  :host([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }
`;
