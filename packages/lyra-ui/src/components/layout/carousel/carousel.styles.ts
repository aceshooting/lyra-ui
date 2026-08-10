import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part~="base"] {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    block-size: 100%;
  }

  [part~="scroll-container"] {
    position: relative;
    min-inline-size: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: inline mandatory;
    scroll-padding-inline: var(--scroll-hint, 0);
    scroll-behavior: smooth;
    overscroll-behavior-inline: contain;
    outline: none;
    scrollbar-width: none;
    aspect-ratio: var(--aspect-ratio, 16 / 9);
  }

  [part~="scroll-container"]::-webkit-scrollbar {
    display: none;
  }

  [data-orientation="vertical"] [part~="scroll-container"] {
    min-block-size: 0;
    block-size: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    scroll-snap-type: block mandatory;
    scroll-padding-inline: 0;
    scroll-padding-block: var(--scroll-hint, 0);
    overscroll-behavior-inline: auto;
    overscroll-behavior-block: contain;
    aspect-ratio: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    [part~="scroll-container"] {
      scroll-behavior: auto;
    }
  }

  [part~="scroll-container"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  /* no-pressed-state: no press action. */
  [part~="scroll-container"]:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border-strong);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [data-mouse-dragging] [part~="scroll-container"]:hover {
    cursor: grab;
    user-select: none;
  }

  [data-mouse-dragging] [part~="scroll-container"]:active {
    cursor: grabbing;
  }

  [data-mouse-dragging] [part~="scroll-container"][data-dragging] {
    cursor: grabbing;
    scroll-snap-type: none;
  }

  .scroll-hint-probe {
    position: absolute;
    inline-size: var(--scroll-hint, 0);
    block-size: 0;
    visibility: hidden;
    pointer-events: none;
  }

  [data-orientation="vertical"] .scroll-hint-probe {
    inline-size: 0;
    block-size: var(--scroll-hint, 0);
  }

  [part="track"] {
    display: flex;
    flex-direction: row;
    gap: var(--slide-gap, var(--lr-space-m));
    inline-size: 100%;
    min-inline-size: 100%;
    padding-inline: var(--scroll-hint, 0);
  }

  [data-orientation="vertical"] [part="track"] {
    flex-direction: column;
    inline-size: auto;
    min-inline-size: 0;
    min-block-size: 100%;
    block-size: 100%;
    padding-inline: 0;
    padding-block: var(--scroll-hint, 0);
  }

  .loop-clones {
    display: contents;
  }

  [part="track"] > ::slotted(*),
  .loop-clones > * {
    flex: 0 0
      var(
        --lr-carousel-slide-basis,
        var(--_lr-carousel-computed-slide-basis, 100%)
      );
    min-inline-size: 0;
    scroll-snap-align: start;
    aspect-ratio: var(--aspect-ratio, 16 / 9);
  }

  [data-orientation="vertical"] [part="track"] > ::slotted(*),
  [data-orientation="vertical"] .loop-clones > * {
    min-block-size: 0;
    aspect-ratio: auto;
  }

  [part="controls"] {
    display: grid;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }

  [part~="navigation"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
  }

  [part~="navigation-button"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }

  [part~="navigation-button"]:hover {
    background: var(--lr-carousel-navigation-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-carousel-navigation-hover-border-color, var(--lr-color-brand));
  }

  [part~="navigation-button"]:active {
    background: var(
      --lr-carousel-navigation-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    border-color: var(--lr-carousel-navigation-active-border-color, var(--lr-color-brand));
  }

  [part~="navigation-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part~="navigation-button"]:focus-visible,
  [part~="pagination-item"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~="pagination"] {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--lr-space-xs);
  }

  [data-orientation="vertical"] [part~="pagination"] {
    flex-direction: column;
    align-items: center;
  }

  @container (max-inline-size: 20rem) {
    [part="controls"],
    [part~="navigation"] {
      gap: var(--lr-space-xs);
    }

    [part~="pagination"] {
      min-inline-size: 0;
    }
  }

  [part~="pagination-item"] {
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

  [part="indicator-dot"] {
    display: block;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
  }

  [part~="pagination-item-active"] [part="indicator-dot"] {
    background: var(
      --lr-carousel-indicator-current-bg,
      var(--lr-color-brand-quiet)
    );
    border-color: var(
      --lr-carousel-indicator-current-border-color,
      var(--lr-color-brand)
    );
  }

  [part~="pagination-item"]:hover [part="indicator-dot"] {
    background: var(--lr-carousel-pagination-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-carousel-pagination-hover-border-color, var(--lr-color-brand));
  }

  [part~="pagination-item"]:active [part="indicator-dot"] {
    background: var(
      --lr-carousel-pagination-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    border-color: var(--lr-carousel-pagination-active-border-color, var(--lr-color-brand));
  }

  :host(:dir(rtl)) [part="previous-glyph"],
  :host(:dir(rtl)) [part="next-glyph"] {
    transform: scaleX(-1);
  }
`;
