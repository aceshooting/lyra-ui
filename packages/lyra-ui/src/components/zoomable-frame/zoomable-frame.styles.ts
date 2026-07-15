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
    min-block-size: var(--lyra-zoomable-frame-min-block-size, var(--lyra-size-10rem));
    overflow: auto;
    overscroll-behavior: contain;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface-raised);
    outline: none;
  }
  [part='viewport']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='content'] {
    display: grid;
    place-items: center;
    min-inline-size: 100%;
    min-block-size: 100%;
    inline-size: max-content;
    block-size: max-content;
    transform: scale(var(--lyra-zoomable-frame-zoom, 1));
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
    gap: var(--lyra-space-xs);
  }
  [part='zoom-out'],
  [part='zoom-in'],
  [part='reset'] {
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='zoom-out']:hover,
  [part='zoom-in']:hover,
  [part='reset']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='zoom-out']:disabled,
  [part='zoom-in']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='zoom-out']:focus-visible,
  [part='zoom-in']:focus-visible,
  [part='reset']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
