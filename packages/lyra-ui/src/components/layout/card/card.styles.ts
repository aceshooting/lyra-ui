import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    /* Inline-size containment deliberately removes content-based intrinsic sizing. Supply the
       centered/shrink-to-fit fallback that lets a standalone card remain visible while definite
       allocations (grid tracks, percentages, explicit inline-size) continue to win normally. */
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }
  [part="base"] {
    position: relative;
    display: flex;
    flex-direction: column;
    border: var(--border-width, var(--lr-border-width-thin)) solid
      var(--border-color, var(--lr-color-border));
    border-radius: var(--border-radius, var(--lr-radius));
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
  /* Pressed keeps the hover border and adds a tint of the whole tile, so it reads as a step past
     hover rather than a different colour of the same step. The tint is a background-IMAGE layer,
     not a background colour: the appearance variants own background-color (filled and
     filled-outlined set brand-quiet), and a colour here would replace theirs instead of deepening
     it, so a filled card would flash back to plain surface on mousedown. */
  :host([interactive]) [part="base"]:active {
    border-color: var(--lr-color-brand);
    background-image: linear-gradient(
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      ),
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="activation-button"] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-content);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
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
  [part~="media"][hidden],
  [part="header"][hidden],
  [part="footer"][hidden] {
    display: none;
  }
  [part~="media"] ::slotted(*) {
    display: block;
    inline-size: 100%;
  }
  [part="header"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-inline-size: 0;
    gap: var(--spacing, var(--padding, var(--lr-space-m)));
    padding: var(--spacing, var(--padding, var(--lr-space-m)));
    border-block-end: var(--border-width, var(--lr-border-width-thin)) solid
      var(--border-color, var(--lr-color-border));
  }
  ::slotted([slot="header"]) {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part="actions"] {
    display: flex;
    align-items: center;
    gap: var(--spacing, var(--padding, var(--lr-space-m)));
    flex: 0 0 auto;
    margin-inline-start: auto;
  }
  [part="actions"][hidden] {
    display: none;
  }
  [part="body"] {
    padding: var(--spacing, var(--padding, var(--lr-space-m)));
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part="footer"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing, var(--padding, var(--lr-space-m)));
    padding: var(--spacing, var(--padding, var(--lr-space-m)));
    border-block-start: var(--border-width, var(--lr-border-width-thin)) solid
      var(--border-color, var(--lr-color-border));
  }
  .footer-actions {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing, var(--padding, var(--lr-space-m)));
    margin-inline-start: auto;
  }
  .footer-actions[hidden] { display: none; }

  :host([orientation="horizontal"]) [part="base"] {
    flex-direction: row;
    align-items: stretch;
  }
  :host([orientation="horizontal"]) [part~="media"] {
    flex: 0 1 auto;
    min-inline-size: 0;
  }
  :host([orientation="horizontal"]) [part="header"]:not([hidden]) {
    display: contents;
  }
  :host([orientation="horizontal"]) [part="header"] > slot[name="header"],
  :host([orientation="horizontal"]) [part="header"] > [part="actions"] > slot[name="header-actions"],
  :host([orientation="horizontal"]) [part="footer"] {
    display: none;
  }
  :host([orientation="horizontal"]) [part="body"] { order: 2; }
  :host([orientation="horizontal"]) [part="actions"] {
    order: 3;
    margin-inline-start: 0;
    padding: var(--spacing, var(--padding, var(--lr-space-m)));
  }

  @container (max-inline-size: 30rem) {
    :host([orientation="horizontal"]) [part="base"] {
      flex-direction: column;
    }
    :host([orientation="horizontal"]) [part~="media"] {
      inline-size: 100%;
    }
  }
`;
