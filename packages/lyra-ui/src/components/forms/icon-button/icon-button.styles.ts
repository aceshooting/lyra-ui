import { forcedColorsPart } from '../../../internal/forced-colors.styles.js';
import { iconAction, iconActionHover, iconActionActive } from '../../../internal/icon-action.styles.js';
import { disabledControl, focusRing, iconHitTarget } from '../../../internal/interactive-control.styles.js';
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
  /* Paint tokens resolve public override -> private composing default -> local fallback. The
     private tier lets a composing parent provide defaults without reading and writing the same
     public token, which creates a custom-property cycle in scope-flattening test resolvers. */
  [part~='button'] { ${iconHitTarget} ${iconAction} }
  /* Inline padding only, after the shared action's padding reset. The default 0 keeps an icon-only
     button at exactly its hit-area floor; a short text label (a currency or unit code) opts into
     breathing room through the public property instead of a part rule. */
  [part~='button'] { padding-inline: var(--lr-icon-button-padding-inline, 0); }
  /* line-height: 1 restores what font: inherit above takes away. A glyph slotted inside an inline
     wrapper (a span or an icon element around an svg) is laid out in a line box, and that box is
     never shorter than the inherited line-height: at a 200% root size under a page line-height of
     1.6 it measured 51px and broke the exact-square recipe at a 44px --lr-icon-button-size. A
     one-glyph or short-code label needs no leading; the min-block-size floor still pads it. */
  [part~='button'] { line-height: 1; }
  /* The hover fallback was once var(--lr-color-surface), the PAGE background, so hovering on a
     default page changed nothing. Mixing that surface toward --lr-color-mix-partner (the text
     colour) always moves, and the way the surface needs: darker on a light page, lighter on a dark
     one. The press fallback is the same mix at the stronger --lr-color-mix-active share. */
  [part~='button']:not(:disabled):not([aria-disabled='true']):hover { ${iconActionHover} }
  [part~='button']:not(:disabled):not([aria-disabled='true']):active { ${iconActionActive} }
  [part~='button']:focus-visible { ${focusRing} }
  [part~='button']:disabled,
  [part~='button'][aria-disabled='true'] { ${disabledControl} }
  /* Font-relative on purpose: an icon button has its own 1.25rem visual-glyph contract,
     independent of the button label font-size the nested component inherits, so the integration
     boundary uses the existing rem token. A consumer's inherited --lr-icon-size still wins on the
     first var() branch. */
  lr-icon { inline-size: var(--lr-icon-size, var(--lr-size-1-25rem)); block-size: var(--lr-icon-size, var(--lr-size-1-25rem)); }
  /* Mirrors lr-icon's own default box so the bare-geometry SVG fallback sizes like a named glyph.
     Mounted only when there is fallback content (see icon-button.class.ts's hasBareGeometry). */
  [part='fallback'] { display: block; inline-size: var(--lr-icon-size, var(--lr-size-1-25rem)); block-size: var(--lr-icon-size, var(--lr-size-1-25rem)); color: inherit; }

  ${forcedColorsPart('[part~="button"]:not(:disabled, [aria-disabled="true"]):hover:not(:focus-visible)')}
  @media (forced-colors: active) {
    [part~="button"]:not(:disabled, [aria-disabled="true"]):active:not(:focus-visible) {
      outline: var(--lr-border-width-medium) double Highlight;
    }
  }
`;
