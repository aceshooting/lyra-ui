import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part="base"] {
    display: grid;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part="viewport"] {
    position: relative;
    min-inline-size: 0;
    overflow: hidden;
    outline: none;
  }
  [part="viewport"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="viewport"]:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border-strong);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="track"] {
    display: block;
    min-inline-size: 0;
  }
  [part="track"] > ::slotted(*) {
    min-inline-size: 0;
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
    justify-content: center;
    gap: var(--lr-space-xs);
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
  :host(:dir(rtl)) [part="previous-glyph"],
  :host(:dir(rtl)) [part="next-glyph"] {
    transform: scaleX(-1);
  }
`;
