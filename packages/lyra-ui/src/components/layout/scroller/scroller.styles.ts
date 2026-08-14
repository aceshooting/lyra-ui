import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
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
    inline-size: var(--shadow-size, var(--lr-size-2rem));
    pointer-events: none;
  }
  [part="start-shadow"][hidden],
  [part="end-shadow"][hidden] { display: none; }
  [part="start-shadow"] {
    inset-inline-start: 0;
    background: linear-gradient(to right, var(--shadow-color, var(--lr-color-surface)), transparent);
  }
  [part="end-shadow"] {
    inset-inline-end: 0;
    background: linear-gradient(to left, var(--shadow-color, var(--lr-color-surface)), transparent);
  }
  :host(:dir(rtl)) [part="start-shadow"] {
    background: linear-gradient(to left, var(--shadow-color, var(--lr-color-surface)), transparent);
  }
  :host(:dir(rtl)) [part="end-shadow"] {
    background: linear-gradient(to right, var(--shadow-color, var(--lr-color-surface)), transparent);
  }

  [part="content"] {
    display: flex;
    gap: var(--lr-space-s);
    min-inline-size: max-content;
  }

  :host([orientation="vertical"]) [part="base"] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-block-size: var(--lr-scroller-min-block-size, var(--lr-size-10rem));
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
    block-size: var(--shadow-size, var(--lr-size-2rem));
  }
  :host([orientation="vertical"]) [part="start-shadow"] {
    inset-block: 0 auto;
    background: linear-gradient(to bottom, var(--shadow-color, var(--lr-color-surface)), transparent);
  }
  :host([orientation="vertical"]) [part="end-shadow"] {
    inset-block: auto 0;
    background: linear-gradient(to top, var(--shadow-color, var(--lr-color-surface)), transparent);
  }

  [part~="control"] {
    /* Keep the glyph-sized control compact by default (--lr-scroller-control-size
       is a consumer-tunable custom property, not this floor) while still giving the
       interactive box the shared minimum target size -- same "small glyph, padded hit
       box" pattern as lr-code-block's/lr-json-viewer's [part='toggle']. Covers
       both previous and next (the shared part on both, per csspart doc above). */
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

  /* previous/next are the same rendered button as [part='control'] above (each
     button's part attribute carries both tokens, e.g. part="control previous", so
     this needs the token-matching ~= form, not =, to actually hit it) -- this
     restates the identical floor directly against each individual part name too,
     since a shadow-part guard lookup is per-name, not per-rendered-element. */
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
