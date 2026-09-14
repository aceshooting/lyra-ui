import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    /* Captured on the HOST, where this component declares no --lr-icon-button-* of its own, so each
       var() reads whatever an ancestor theme wrapper set and falls back to this toolbar's own
       treatment only when nothing did. The action rule below re-declares the public tokens from
       these captures; declaring the treatment directly there would shadow the inherited value
       instead of falling back to it. */
    --_lr-message-actions-button-bg: var(--lr-icon-button-background, transparent);
    --_lr-message-actions-button-bg-hover: var(
      --lr-icon-button-background-hover,
      var(--lr-color-surface-raised)
    );
    --_lr-message-actions-button-bg-active: var(
      --lr-icon-button-background-active,
      color-mix(
        in oklab,
        var(--lr-icon-button-background-hover, var(--lr-color-surface-raised)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    --_lr-message-actions-button-color: var(--lr-icon-button-color, var(--lr-color-text-quiet));
    --_lr-message-actions-button-color-hover: var(
      --lr-icon-button-color-hover,
      var(--lr-color-text)
    );
    --_lr-message-actions-button-color-active: var(
      --lr-icon-button-color-active,
      var(--lr-icon-button-color-hover, var(--lr-color-text))
    );
    --_lr-message-actions-button-radius: var(--lr-icon-button-radius, var(--lr-radius));
  }
  :host([reveal-on-interaction]) {
    opacity: 0;
    transition: opacity var(--lr-transition-fast);
  }
  :host([reveal-on-interaction][data-revealed]) {
    opacity: 1;
  }
  @media (hover: none) {
    :host([reveal-on-interaction]) {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :host([reveal-on-interaction]) {
      transition: none;
    }
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-2xs);
    max-inline-size: 100%;
  }
  /* Both built-in actions ARE lr-icon-buttons now, so the hit-area floor, the radius, the
     hover/press mixes, the focus ring and the disabled dimming all come from that one component.
     What stays is this toolbar's own resting/hover paint, re-expressed through the composed
     control's public token contract. The capture pattern on :host above is what lets an ancestor
     theme wrapper's --lr-icon-button-* still win rather than being shadowed by these defaults. */
  [part~='regenerate-button'],
  [part~='edit-button'] {
    --lr-icon-button-background: var(--_lr-message-actions-button-bg);
    --lr-icon-button-background-hover: var(--_lr-message-actions-button-bg-hover);
    --lr-icon-button-background-active: var(--_lr-message-actions-button-bg-active);
    --lr-icon-button-color: var(--_lr-message-actions-button-color);
    --lr-icon-button-color-hover: var(--_lr-message-actions-button-color-hover);
    --lr-icon-button-color-active: var(--_lr-message-actions-button-color-active);
    --lr-icon-button-radius: var(--_lr-message-actions-button-radius);
  }
`;
