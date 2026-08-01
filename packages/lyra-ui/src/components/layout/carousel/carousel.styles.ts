import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
  }
  [part="base"] {
    display: grid;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  /* The viewport is the real scroll port. Touch/trackpad panning, momentum, and rubber-banding all
     come from the platform scroller; the component only reads where it came to rest. Both axes are
     pinned explicitly: per the CSS overflow spec, setting one axis to a scrolling value forces the
     other's computed 'visible' to 'auto', which would add an unwanted vertical scrollbar. */
  [part="viewport"] {
    position: relative;
    min-inline-size: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: inline mandatory;
    scroll-behavior: smooth;
    overscroll-behavior-inline: contain;
    outline: none;
    scrollbar-width: none;
  }
  [part="viewport"]::-webkit-scrollbar {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="viewport"] {
      scroll-behavior: auto;
    }
  }
  [part="viewport"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* no-pressed-state: the viewport is a scroll port, not a target -- pressing it activates
     nothing, and :active matches the ancestors of whatever was pressed, so a click on any slide's
     own content would flash this outline across the whole carousel. */
  [part="viewport"]:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border-strong);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="track"] {
    display: flex;
    flex-direction: row;
    min-inline-size: 0;
  }
  /* One snap area per slide. min-inline-size: 0 disables the flex automatic minimum size, which
     would otherwise let a slide whose content is wider than the allocation grow past its basis and
     desynchronize every snap position after it. Deliberately no scroll-snap-stop: always -- it
     forces every scroll operation to stop at the first snap area it crosses, which would strand
     goTo(), Home, and End one slide from wherever they were aiming. */
  [part="track"] > ::slotted(*) {
    flex: 0 0 var(--lr-carousel-slide-basis, 100%);
    min-inline-size: 0;
    scroll-snap-align: start;
  }
  [part="controls"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
  }
  [part="previous-button"],
  [part="next-button"] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part="previous-button"],
  [part="next-button"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part="previous-button"]:hover,
  [part="next-button"]:hover {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  /* The same brand-quiet fill hover uses, mixed further toward --lr-color-mix-partner (the text
     colour) so the pressed step is deeper than the hover step on either theme. Declared before
     :disabled below, which restates neither colour, so a disabled arrow cannot be activated and
     never reaches this rule anyway. */
  [part="previous-button"]:active,
  [part="next-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    border-color: var(--lr-color-brand);
  }
  [part="previous-button"]:disabled,
  [part="next-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="previous-button"]:focus-visible,
  [part="next-button"]:focus-visible,
  [part="indicator"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="indicators"] {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--lr-space-xs);
  }
  /* Container-query lengths cannot reference custom properties. This is the documented 320px
     narrow-allocation baseline expressed in root-relative units so it still follows the page's
     type scale: at that width a long indicator row would otherwise push the arrows off-screen. */
  @container (max-inline-size: 20rem) {
    [part="controls"] {
      gap: var(--lr-space-xs);
    }
    [part="indicators"] {
      min-inline-size: 0;
    }
  }
  /* The interactive hit target meets the shared minimum tappable size (same --lr-icon-button-size
     floor as lr-code-block's/lr-json-viewer's [part='toggle'] and lr-swatch-picker's
     [part='swatch']), while the *visible* dot stays a compact --lr-size-0-5rem circle -- rendered
     on the separate [part='indicator-dot'] child below and centered via flex, not by resizing this
     button itself. */
  [part="indicator"] {
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
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor without a :host declaration shadowing that. ::part(indicator)[aria-current='true'] is
     invalid CSS (an attribute selector cannot follow ::part), so recoloring the current indicator
     used to require hijacking the shared --lr-color-brand-quiet/--lr-color-brand tokens, repainting
     everything else that reads them. Unset, each falls back to the token the rule used before, so
     the rendering is unchanged. */
  [part="indicator"][aria-current="true"] [part="indicator-dot"] {
    background: var(
      --lr-carousel-indicator-current-bg,
      var(--lr-color-brand-quiet)
    );
    border-color: var(
      --lr-carousel-indicator-current-border-color,
      var(--lr-color-brand)
    );
  }
  [part="indicator"]:hover [part="indicator-dot"] {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  /* The dot is the only painted surface on this button (the hit box itself is transparent), so the
     pressed state deepens the dot's own hover fill rather than the box around it. */
  [part="indicator"]:active [part="indicator-dot"] {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    border-color: var(--lr-color-brand);
  }
  :host(:dir(rtl)) [part="previous-glyph"],
  :host(:dir(rtl)) [part="next-glyph"] {
    transform: scaleX(-1);
  }
`;
