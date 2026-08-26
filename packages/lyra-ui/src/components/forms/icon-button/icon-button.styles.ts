import { css } from 'lit';
export const styles = css`
  :host { display: inline-flex; --_lr-icon-button-radius-default: var(--lr-radius); }
  /* --lr-icon-button-size is a minimum tappable box, not a fixed one: flooring both axes pads a
     small glyph out to a full target, while larger slotted content grows the button and keeps its
     aspect ratio instead of being squashed to 1:1. */
  [part~='button'] { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); padding: 0; border: var(--lr-icon-button-border, 0); border-radius: var(--lr-icon-button-radius, var(--_lr-icon-button-radius-default)); background: var(--lr-icon-button-background, transparent); color: var(--lr-icon-button-color, inherit); cursor: pointer; text-decoration: none; }
  /* The hover fallback was once var(--lr-color-surface), the PAGE background, so hovering on a
     default page changed nothing. Mixing that surface toward --lr-color-mix-partner (the text
     colour) always moves, and the way the surface needs: darker on a light page, lighter on a dark
     one. The press fallback is the same mix at the stronger --lr-color-mix-active share. */
  [part~='button']:not(:disabled):not([aria-disabled='true']):hover { border: var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0)); background: var(--lr-icon-button-background-hover, color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover))); color: var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit)); }
  [part~='button']:not(:disabled):not([aria-disabled='true']):active { border: var(--lr-icon-button-border-active, var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0))); background: var(--lr-icon-button-background-active, color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))); color: var(--lr-icon-button-color-active, var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit))); }
  [part~='button']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  :host(:disabled) [part~='button'],
  [part~='button']:disabled,
  [part~='button'][aria-disabled='true'] { opacity: var(--lr-opacity-disabled); cursor: not-allowed; }
  /* Font-relative on purpose: an icon button has its own 1.25rem visual-glyph contract,
     independent of the button label font-size the nested component inherits, so the integration
     boundary uses the existing rem token. A consumer's inherited --lr-icon-size still wins on the
     first var() branch. */
  lr-icon { inline-size: var(--lr-icon-size, var(--lr-size-1-25rem)); block-size: var(--lr-icon-size, var(--lr-size-1-25rem)); }
  /* Mirrors lr-icon's own default box so the bare-geometry SVG fallback sizes like a named glyph.
     Mounted only when there is fallback content (see icon-button.class.ts's hasBareGeometry). */
  [part='fallback'] { display: block; inline-size: var(--lr-icon-size, var(--lr-size-1-25rem)); block-size: var(--lr-icon-size, var(--lr-size-1-25rem)); color: inherit; }
`;
