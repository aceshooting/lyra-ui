import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Captured on the HOST, where this component declares no --lr-icon-button-* of its own, so each
       var() reads whatever an ancestor theme wrapper set and falls back to this row's own move-arrow
       treatment only when nothing did. The move-button rule below re-declares the public tokens from
       these captures; declaring the treatment directly there would shadow the inherited value
       instead of falling back to it. */
    --_lr-reorder-item-move-bg: var(--lr-icon-button-background, transparent);
    --_lr-reorder-item-move-bg-hover: var(
      --lr-icon-button-background-hover,
      var(--lr-color-brand-quiet)
    );
    --_lr-reorder-item-move-bg-active: var(
      --lr-icon-button-background-active,
      color-mix(
        in oklab,
        var(--lr-icon-button-background-hover, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    --_lr-reorder-item-move-color: var(--lr-icon-button-color, var(--lr-color-text-quiet));
    --_lr-reorder-item-move-color-hover: var(--lr-icon-button-color-hover, var(--lr-color-brand));
    --_lr-reorder-item-move-color-active: var(
      --lr-icon-button-color-active,
      var(--lr-icon-button-color-hover, var(--lr-color-brand))
    );
    --_lr-reorder-item-move-radius: var(--lr-icon-button-radius, var(--lr-radius));
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
     hover/press hooks re-expressed through the composed control's public token contract. The
     capture pattern on :host is what lets an ancestor theme wrapper's --lr-icon-button-* still
     win rather than being shadowed by these defaults. */
  [part='move-up-button'],
  [part='move-down-button'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-m);
    --lr-icon-button-background: var(--_lr-reorder-item-move-bg);
    --lr-icon-button-background-hover: var(
      --lr-reorder-item-move-button-hover-bg,
      var(--_lr-reorder-item-move-bg-hover)
    );
    --lr-icon-button-background-active: var(
      --lr-reorder-item-move-button-active-bg,
      var(--_lr-reorder-item-move-bg-active)
    );
    --lr-icon-button-color: var(--_lr-reorder-item-move-color);
    --lr-icon-button-color-hover: var(
      --lr-reorder-item-move-button-hover-color,
      var(--_lr-reorder-item-move-color-hover)
    );
    --lr-icon-button-color-active: var(
      --lr-reorder-item-move-button-active-color,
      var(--_lr-reorder-item-move-color-active)
    );
    --lr-icon-button-radius: var(--_lr-reorder-item-move-radius);
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
     so the two hover hooks above cannot repaint it either. */
  [part='move-up-button'][disabled],
  [part='move-down-button'][disabled] {
    --lr-icon-button-background-hover: var(--_lr-reorder-item-move-bg);
    --lr-icon-button-background-active: var(--_lr-reorder-item-move-bg);
    --lr-icon-button-color-hover: var(--_lr-reorder-item-move-color);
    --lr-icon-button-color-active: var(--_lr-reorder-item-move-color);
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
