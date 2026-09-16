import { css } from 'lit';
export const styles = css`
  :host { display: inline-flex; --_lr-icon-button-radius-default: var(--lr-radius); }
  /* --lr-icon-button-size is a minimum tappable box, not a fixed one: flooring both axes pads a
     small glyph out to a full target, while larger slotted content grows the button and keeps its
     aspect ratio instead of being squashed to 1:1. */
  /* font: inherit is load-bearing, not tidiness. Slotted content inherits through the FLATTENED
     tree, so an <svg width="1em"> a consumer (or a composing component) slots here inherits the
     native button's UA font-size -- 13.33px -- not the host's. A glyph sized in em therefore
     silently shrank below the surrounding text; lr-dialog's composed close control found it. */
  /* Every paint token below (background/color/border and their hover/active variants) resolves in
     the SAME three tiers, in this exact order: the PUBLIC --lr-icon-button-* token (so an ancestor
     theme override always wins first, whether it is set above a standalone button or above a
     composing parent like lr-dialog); then a PRIVATE --_lr-icon-button-<token>-default, which a
     composing parent sets directly on this element (its own [part] rule, from OUTSIDE this shadow
     root) to supply that component's own default paint WITHOUT ever reading or re-declaring the
     public token itself; then this rule's own built-in literal/formula, unchanged, for a standalone
     button with no composing parent. A composing parent must never read the public token to derive
     its own default and then write that derived value back onto the SAME public token name -- that
     round trip is exactly what icon-button.test.ts's "keeps the public radius inheritable" test
     already enforced for --lr-icon-button-radius (see --_lr-icon-button-radius-default below); this
     generalizes the same non-looping shape to background/color/border. A scope-flattening custom
     property resolver with no notion of which element declared what (happy-dom, at least through
     20.14.5) sees a public-token round trip as a literal cycle -- --lr-icon-button-background would
     depend on a private token that itself depends on --lr-icon-button-background -- and recurses
     until it exhausts the call stack; a real, per-shadow-scoped browser never had this problem,
     since :host and a composed child's [part] rule resolve on different elements in document order.
     See llms/shared.md's "happy-dom's custom-property resolver and host-to-part token forwarding"
     section for the full incident writeup. */
  [part~='button'] { font: inherit; display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); padding: 0; border: var(--lr-icon-button-border, var(--_lr-icon-button-border-default, 0)); border-radius: var(--lr-icon-button-radius, var(--_lr-icon-button-radius-default)); background: var(--lr-icon-button-background, var(--_lr-icon-button-background-default, transparent)); color: var(--lr-icon-button-color, var(--_lr-icon-button-color-default, inherit)); cursor: pointer; text-decoration: none; transition: background-color var(--lr-transition-fast), border-color var(--lr-transition-fast), color var(--lr-transition-fast); }
  /* The hover fallback was once var(--lr-color-surface), the PAGE background, so hovering on a
     default page changed nothing. Mixing that surface toward --lr-color-mix-partner (the text
     colour) always moves, and the way the surface needs: darker on a light page, lighter on a dark
     one. The press fallback is the same mix at the stronger --lr-color-mix-active share. */
  [part~='button']:not(:disabled):not([aria-disabled='true']):hover { border: var(--lr-icon-button-border-hover, var(--_lr-icon-button-border-hover-default, var(--lr-icon-button-border, 0))); background: var(--lr-icon-button-background-hover, var(--_lr-icon-button-background-hover-default, color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover)))); color: var(--lr-icon-button-color-hover, var(--_lr-icon-button-color-hover-default, var(--lr-icon-button-color, inherit))); }
  [part~='button']:not(:disabled):not([aria-disabled='true']):active { border: var(--lr-icon-button-border-active, var(--_lr-icon-button-border-active-default, var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0)))); background: var(--lr-icon-button-background-active, var(--_lr-icon-button-background-active-default, color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active)))); color: var(--lr-icon-button-color-active, var(--_lr-icon-button-color-active-default, var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit)))); }
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
