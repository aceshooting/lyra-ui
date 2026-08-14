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
    min-block-size: var(--lr-pan-zoom-min-block-size, var(--lr-size-10rem));
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
  /* no-pressed-state: the viewport is a focusable scroll surface, not an activation target. */
  [part='viewport']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='content'] {
    display: grid;
    place-items: center;
    min-inline-size: 100%;
    min-block-size: 100%;
    inline-size: max-content;
    block-size: max-content;
    /* CSS zoom participates in layout, so scaled content expands the scrollable footprint instead
       of painting into an unreachable area outside transform-based scroll geometry. */
    zoom: var(--lr-pan-zoom-zoom, 1);
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
    min-inline-size: 0;
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
  [part='reset'] {
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='zoom-out']:hover,
  [part='zoom-in']:hover,
  [part='reset']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='zoom-out']:active,
  [part='zoom-in']:active,
  [part='reset']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
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
