import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    /* This toolbar's own default paint for its actions, set on the HOST for organization only --
       nothing here reads an --lr-icon-button-* token to compute it. The action rule below writes
       these onto lr-icon-button's own --_lr-icon-button-<token>-default tier (never the public
       --lr-icon-button-* name), so an ancestor theme wrapper's own --lr-icon-button-* still wins:
       lr-icon-button's own stylesheet already checks the public token FIRST, ahead of any default a
       composing parent supplies. */
    --_lr-message-actions-button-bg: transparent;
    --_lr-message-actions-button-bg-hover: var(--lr-color-surface-raised);
    /* Reads the PUBLIC hover token (not this component's own -bg-hover default) so that an
       ancestor override of just the hover tier still shapes the press mix -- a cross-reference to a
       DIFFERENT public token than the one being defined here, so it introduces no loop. */
    --_lr-message-actions-button-bg-active: color-mix(
      in oklab,
      var(--lr-icon-button-background-hover, var(--lr-color-surface-raised)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    --_lr-message-actions-button-color: var(--lr-color-text-quiet);
    --_lr-message-actions-button-color-hover: var(--lr-color-text);
    --_lr-message-actions-button-color-active: var(--lr-icon-button-color-hover, var(--lr-color-text));
    --_lr-message-actions-button-radius: var(--lr-radius);
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
     What stays is this toolbar's own resting/hover paint, re-expressed through lr-icon-button's
     private --_lr-icon-button-<token>-default tier rather than the public token itself, so an
     ancestor theme wrapper's own --lr-icon-button-* still wins rather than being shadowed by these
     defaults. */
  [part~='regenerate-button'],
  [part~='edit-button'] {
    --_lr-icon-button-background-default: var(--_lr-message-actions-button-bg);
    --_lr-icon-button-background-hover-default: var(--_lr-message-actions-button-bg-hover);
    --_lr-icon-button-background-active-default: var(--_lr-message-actions-button-bg-active);
    --_lr-icon-button-color-default: var(--_lr-message-actions-button-color);
    --_lr-icon-button-color-hover-default: var(--_lr-message-actions-button-color-hover);
    --_lr-icon-button-color-active-default: var(--_lr-message-actions-button-color-active);
    --_lr-icon-button-radius-default: var(--_lr-message-actions-button-radius);
  }
`;
