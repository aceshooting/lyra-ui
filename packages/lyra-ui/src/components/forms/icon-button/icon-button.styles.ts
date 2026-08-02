import { css } from 'lit';
export const styles = css`
  :host { display: inline-flex; --lr-icon-button-radius: var(--lr-radius); }
  /* --lr-icon-button-size is a minimum tappable box, not a fixed one: floor both axes so a small
     glyph still pads out to a full target, while slotted content larger than it grows the button
     and keeps its own aspect ratio instead of being squashed to 1:1. */
  [part~='button'] { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); padding: 0; border: var(--lr-icon-button-border, 0); border-radius: var(--lr-icon-button-radius); background: var(--lr-icon-button-background, transparent); color: var(--lr-icon-button-color, inherit); cursor: pointer; text-decoration: none; }
  /* The hover fallback used to be var(--lr-color-surface) -- the PAGE background -- so hovering an
     icon button on a default page changed nothing at all. It mixes the page surface toward
     --lr-color-mix-partner (which follows the text colour) instead, which always moves, and always
     in the direction the surface needs: darker on a light page, lighter on a dark one. The press
     fallback is the same mix at the stronger --lr-color-mix-active share, so the pressed state
     reads as more than the hover rather than as a repeat of it. */
  [part~='button']:not(:disabled):not([aria-disabled='true']):hover { border: var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0)); background: var(--lr-icon-button-background-hover, color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover))); color: var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit)); }
  [part~='button']:not(:disabled):not([aria-disabled='true']):active { border: var(--lr-icon-button-border-active, var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0))); background: var(--lr-icon-button-background-active, color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))); color: var(--lr-icon-button-color-active, var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit))); }
  [part~='button']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  :host(:disabled) [part~='button'],
  [part~='button'][aria-disabled='true'] { opacity: var(--lr-opacity-disabled); cursor: not-allowed; }
  /* The standalone icon canvas is intentionally font-relative. An icon button has its own
     established 1.25rem visual-glyph contract, independent of the button label font-size that
     the nested component inherits. Size the integration boundary with the existing rem token;
     a consumer's inherited --lr-icon-size still wins through the first var() branch. */
  lr-icon { inline-size: var(--lr-icon-size, var(--lr-size-1-25rem)); block-size: var(--lr-icon-size, var(--lr-size-1-25rem)); }
  /* Mirrors lr-icon's own default box so the bare-geometry SVG fallback sizes the same as a
     named icon glyph would. Only ever mounted (see icon-button.class.ts's hasBareGeometry) when
     there is fallback content to show. */
  [part='fallback'] { display: block; inline-size: var(--lr-icon-size, var(--lr-size-1-25rem)); block-size: var(--lr-icon-size, var(--lr-size-1-25rem)); color: inherit; }
`;
