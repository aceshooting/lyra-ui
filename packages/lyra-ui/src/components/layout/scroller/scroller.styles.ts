import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* --lr-scroller-shadow-color and -size are the Lyra-prefixed aliases of the upstream
       --shadow-color and --shadow-size cssprops (see the class JSDoc), resolved once here so each
       edge-shadow rule below reads one value instead of repeating the three-level fallback chain
       -- the same indirection lr-split-panel and lr-dock-panel use. */
    --_lr-scroller-effective-shadow-color: var(
      --lr-scroller-shadow-color,
      var(--shadow-color, var(--lr-color-surface))
    );
    --_lr-scroller-effective-shadow-size: var(
      --lr-scroller-shadow-size,
      var(--shadow-size, var(--lr-size-2rem))
    );
  }

  [part="base"] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part="viewport"] {
    min-inline-size: 0;
    overflow: auto;
    overscroll-behavior-inline: contain;
    scroll-behavior: smooth;
    scrollbar-width: auto;
  }

  :host([without-scrollbar]) [part="viewport"] {
    scrollbar-width: none;
  }

  :host([without-scrollbar]) [part="viewport"]::-webkit-scrollbar {
    display: none;
  }

  .viewport-wrap {
    position: relative;
    min-inline-size: 0;
    min-block-size: 0;
  }

  [part="start-shadow"],
  [part="end-shadow"] {
    position: absolute;
    z-index: var(--lr-layer-content);
    inset-block: 0;
    inline-size: var(--_lr-scroller-effective-shadow-size);
    pointer-events: none;
  }
  [part="start-shadow"][hidden],
  [part="end-shadow"][hidden] { display: none; }
  [part="start-shadow"] {
    inset-inline-start: 0;
    background: linear-gradient(to right, var(--_lr-scroller-effective-shadow-color), transparent);
  }
  [part="end-shadow"] {
    inset-inline-end: 0;
    background: linear-gradient(to left, var(--_lr-scroller-effective-shadow-color), transparent);
  }
  :host(:dir(rtl)) [part="start-shadow"] {
    background: linear-gradient(to left, var(--_lr-scroller-effective-shadow-color), transparent);
  }
  :host(:dir(rtl)) [part="end-shadow"] {
    background: linear-gradient(to right, var(--_lr-scroller-effective-shadow-color), transparent);
  }

  [part="content"] {
    display: flex;
    gap: var(--lr-space-s);
    min-inline-size: max-content;
  }

  :host([orientation="vertical"]) {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    block-size: 100%;
    min-block-size: 0;
  }

  :host([orientation="vertical"]) [part="base"] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    block-size: 100%;
    min-block-size: min(
      var(--lr-scroller-min-block-size, var(--lr-size-10rem)),
      100%
    );
    max-block-size: 100%;
  }

  :host([orientation="vertical"]) [part="viewport"],
  :host([orientation="vertical"]) [part="content"],
  :host([orientation="vertical"]) .viewport-wrap {
    block-size: 100%;
  }

  :host([orientation="vertical"]) [part="content"] {
    flex-direction: column;
    min-block-size: max-content;
    min-inline-size: 100%;
  }

  :host([orientation="vertical"]) [part="start-shadow"],
  :host([orientation="vertical"]) [part="end-shadow"] {
    inset-inline: 0;
    inline-size: auto;
    block-size: var(--_lr-scroller-effective-shadow-size);
  }
  :host([orientation="vertical"]) [part="start-shadow"] {
    inset-block: 0 auto;
    background: linear-gradient(to bottom, var(--_lr-scroller-effective-shadow-color), transparent);
  }
  :host([orientation="vertical"]) [part="end-shadow"] {
    inset-block: auto 0;
    background: linear-gradient(to top, var(--_lr-scroller-effective-shadow-color), transparent);
  }

  [part~="control"] {
    /* A compact glyph-sized control (tuned by --lr-scroller-control-size, not this floor) whose
       interactive box still meets the shared minimum target -- the small-glyph, padded-hit-box
       pattern of lr-code-block's and lr-json-viewer's [part='toggle']. Covers previous and next,
       which share this part. */
    font: inherit;
    display: inline-grid;
    place-items: center;
    inline-size: var(--lr-scroller-control-size, var(--lr-size-2rem));
    block-size: var(--lr-scroller-control-size, var(--lr-size-2rem));
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }

  [part~="control"]:hover:not(:disabled) {
    background: var(--lr-color-brand-quiet);
  }

  /* Held down, the control scrolls repeatedly, so the press is the long-lived state here rather
     than an instant -- the deeper mix of the same brand-quiet fill marks it for its duration. */
  [part~="control"]:active:not(:disabled) {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  /* no-pressed-state: the viewport is a scroll port, not a target -- pressing it activates
     nothing, and :active matches the ancestors of whatever was pressed, so clicking any slotted
     item would flash this outline around the whole strip. */
  [part="viewport"]:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border);
    outline-offset: var(--lr-focus-ring-offset);
  }

  /* previous and next are the same rendered button as [part='control'] above -- each carries both
     tokens (part='control previous'), so this needs the token-matching ~= form, not =. The floor
     is restated per part name because a shadow-part guard lookup is per-name, not
     per-rendered-element. */
  [part~="previous"],
  [part~="next"] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  [part~="control"]:disabled {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }

  [part~="control"]:focus-visible,
  [part="viewport"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  :host(:dir(rtl)) [part="previous-glyph"],
  :host(:dir(rtl)) [part="next-glyph"] {
    transform: scaleX(-1);
  }

  :host([orientation="vertical"]) [part~="previous"] {
    grid-row: 1;
  }

  :host([orientation="vertical"]) [part~="next"] {
    grid-row: 3;
  }

  @media (prefers-reduced-motion: reduce) {
    [part="viewport"] {
      scroll-behavior: auto;
    }
  }
`;
