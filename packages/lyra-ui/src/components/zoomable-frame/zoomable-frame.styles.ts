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
    min-block-size: var(--lr-zoomable-frame-min-block-size, var(--lr-size-10rem));
    overflow: auto;
    overscroll-behavior: contain;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    outline: none;
  }
  [part='viewport']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='content'] {
    display: grid;
    place-items: center;
    min-inline-size: 100%;
    min-block-size: 100%;
    inline-size: max-content;
    block-size: max-content;
    transform: scale(var(--lr-zoomable-frame-zoom, 1));
    transform-origin: center;
  }
  [part='content'] ::slotted(*) {
    max-inline-size: none;
  }
  [part='content'] img {
    display: block;
    max-inline-size: none;
  }
  [part='controls'] {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
  }
  [part='zoom-out'],
  [part='zoom-in'],
  [part='reset'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='zoom-out']:hover,
  [part='zoom-in']:hover,
  [part='reset']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='zoom-out']:disabled,
  [part='zoom-in']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='zoom-out']:focus-visible,
  [part='zoom-in']:focus-visible,
  [part='reset']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
