import { css } from 'lit';

export const styles = css`
  :host {
    position: relative;
    display: block;
    overflow: hidden;
    min-inline-size: 0;
    inline-size: 100%;
    aspect-ratio: 16 / 9;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  :host(:where([data-frame-focused])) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='iframe'] {
    position: absolute;
    top: 0;
    /* policy-allow(physical-css): the scaled iframe is a physical pixel canvas, so its origin
       must stay at physical top-left under both text directions. */
    right: auto;
    bottom: auto;
    /* policy-allow(physical-css): paired physical edge of the fixed transform canvas origin. */
    left: 0;
    display: block;
    inline-size: calc(100% / var(--lr-zoomable-frame-zoom, 1));
    block-size: calc(100% / var(--lr-zoomable-frame-zoom, 1));
    border: 0;
    background: var(--lr-color-surface);
    transform: scale(var(--lr-zoomable-frame-zoom, 1));
    /* Iframe pixels are a physical canvas; scaling must stay pinned to its physical top-left
       corner under both LTR and RTL rather than mirroring the embedded document. */
    transform-origin: top left;
  }

  :host([without-interaction]) [part='iframe'] {
    pointer-events: none;
    user-select: none;
  }

  [part='controls'] {
    position: absolute;
    z-index: var(--lr-layer-content);
    inset-inline-end: var(--lr-space-s);
    inset-block-end: var(--lr-space-s);
    display: flex;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-overlay);
    box-shadow: var(--lr-shadow-s);
  }

  [part='zoom-in-button'],
  [part='zoom-out-button'] {
    display: inline-grid;
    place-items: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }

  [part='zoom-in-button']:not(:disabled):hover,
  [part='zoom-out-button']:not(:disabled):hover {
    background: var(
      --lr-zoomable-frame-control-hover-background,
      var(--lr-color-brand-quiet)
    );
  }

  [part='zoom-in-button']:not(:disabled):active,
  [part='zoom-out-button']:not(:disabled):active {
    background: color-mix(
      in oklab,
      var(
        --lr-zoomable-frame-control-hover-background,
        var(--lr-color-brand-quiet)
      ),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part='zoom-in-button']:focus-visible,
  [part='zoom-out-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='zoom-in-button']:disabled,
  [part='zoom-out-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
`;
