import { css } from "lit";

export const styles = css`
  :host {
    display: block;
  }
  [part="base"] {
    position: relative;
    display: flex;
    flex-direction: column;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    /* Stretches to fill the host's own allocated block-size -- e.g. a CSS Grid row with the
       default align-items: stretch -- so a shorter card's visible border/background reaches the
       row's full height instead of shrink-wrapping to its own content (mirrors lyra-stat's/
       word-cloud's/context-meter's identical fix; card.class.ts's own doc advertises "clickable
       grid tiles" as an intended use case). box-sizing keeps the border inside that measured
       height rather than growing past it. */
    block-size: 100%;
    box-sizing: border-box;
    color: inherit;
    text-decoration: none;
    overflow: hidden;
  }
  :host([appearance="filled"]) [part="base"] {
    border-color: transparent;
    background: var(--lr-color-brand-quiet);
  }
  :host([appearance="filled-outlined"]) [part="base"] {
    background: var(--lr-color-brand-quiet);
  }
  :host([appearance="accent"]) [part="base"] {
    border-color: transparent;
    border-inline-start: var(--lr-size-3px) solid var(--lr-color-brand);
  }
  :host([appearance="plain"]) [part="base"] {
    border-color: transparent;
    background: transparent;
  }
  :host([interactive]) [part="base"] {
    cursor: pointer;
    transition: border-color var(--lr-transition-fast);
  }
  :host([interactive]) [part="base"]:hover {
    border-color: var(--lr-color-brand);
  }
  [part="activation-button"] {
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 0;
    border: 0;
    border-radius: inherit;
    background: transparent;
    pointer-events: none;
  }
  [part="activation-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part="media"][hidden],
  [part="header"][hidden],
  [part="footer"][hidden] {
    display: none;
  }
  [part="media"] ::slotted(*) {
    display: block;
    inline-size: 100%;
  }
  [part="header"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-inline-size: 0;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  ::slotted([slot="header"]) {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part="actions"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
    margin-inline-start: auto;
  }
  [part="actions"][hidden] {
    display: none;
  }
  [part="body"] {
    padding: var(--lr-space-m);
    flex: 1 1 auto;
  }
  [part="footer"] {
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
`;
