import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* This row's own default paint for its move arrows, set on the HOST for organization only --
       nothing here reads an --lr-icon-button-* token to compute it. The move-button rule below
       writes these onto lr-icon-button's own --_lr-icon-button-<token>-default tier (never the
       public --lr-icon-button-* name), so an ancestor theme wrapper's own --lr-icon-button-* still
       wins: lr-icon-button's own stylesheet already checks the public token FIRST, ahead of any
       default a composing parent supplies. */
    --_lr-reorder-item-move-bg: transparent;
    --_lr-reorder-item-move-bg-hover: var(--lr-color-brand-quiet);
    /* Reads the PUBLIC hover token (not this component's own -bg-hover default) so that an
       ancestor override of just the hover tier still shapes the press mix -- a cross-reference to a
       DIFFERENT public token than the one being defined here, so it introduces no loop. */
    --_lr-reorder-item-move-bg-active: color-mix(
      in oklab,
      var(--lr-icon-button-background-hover, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    --_lr-reorder-item-move-color: var(--lr-color-text-quiet);
    --_lr-reorder-item-move-color-hover: var(--lr-color-brand);
    --_lr-reorder-item-move-color-active: var(--lr-icon-button-color-hover, var(--lr-color-brand));
    --_lr-reorder-item-move-radius: var(--lr-radius);
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lr-reorder-item-gap, var(--lr-space-xs));
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* Both move controls ARE lr-icon-buttons now, so the hit-area floor, the radius, the hover/press
     mixes, the focus ring, the disabled dimming and the transition all come from that one
     component. What stays here is placement, the rotation, and this component's own two
     hover/press hooks, re-expressed through lr-icon-button's private
     --_lr-icon-button-<token>-default tier rather than the public token itself, so an ancestor
     theme wrapper's own --lr-icon-button-* still wins rather than being shadowed by these
     defaults. */
  [part='move-up-button'],
  [part='move-down-button'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-m);
    --_lr-icon-button-background-default: var(--_lr-reorder-item-move-bg);
    --_lr-icon-button-background-hover-default: var(
      --lr-reorder-item-move-button-hover-bg,
      var(--_lr-reorder-item-move-bg-hover)
    );
    --_lr-icon-button-background-active-default: var(
      --lr-reorder-item-move-button-active-bg,
      var(--_lr-reorder-item-move-bg-active)
    );
    --_lr-icon-button-color-default: var(--_lr-reorder-item-move-color);
    --_lr-icon-button-color-hover-default: var(
      --lr-reorder-item-move-button-hover-color,
      var(--_lr-reorder-item-move-color-hover)
    );
    --_lr-icon-button-color-active-default: var(
      --lr-reorder-item-move-button-active-color,
      var(--_lr-reorder-item-move-color-active)
    );
    --_lr-icon-button-radius-default: var(--_lr-reorder-item-move-radius);
  }
  /* chevronIcon() bakes in no rotation (see icons.ts), so the whole button rotates -- as
     lr-tree-item's [part='toggle'] does. */
  [part='move-up-button'] {
    transform: rotate(-90deg);
  }
  [part='move-down-button'] {
    transform: rotate(90deg);
  }
  /* A disabled arrow stays flat whatever the pointer does to it: the composed control's own
     :disabled rules already suppress its hover/press paint, and these restate the resting colour
     so the two hover hooks above cannot repaint it either. Selector specificity (this compound
     beats the plain [part='move-up-button'] rule above) decides the winner between reorder-item's
     own rules for the same --_lr-icon-button-<token>-default property, exactly as it did when both
     rules declared the public token directly. */
  [part='move-up-button'][disabled],
  [part='move-down-button'][disabled] {
    --_lr-icon-button-background-hover-default: var(--_lr-reorder-item-move-bg);
    --_lr-icon-button-background-active-default: var(--_lr-reorder-item-move-bg);
    --_lr-icon-button-color-hover-default: var(--_lr-reorder-item-move-color);
    --_lr-icon-button-color-active-default: var(--_lr-reorder-item-move-color);
  }
  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='move-up-button'],
    [part='move-down-button'] {
      transition: none !important;
    }
  }
`;
