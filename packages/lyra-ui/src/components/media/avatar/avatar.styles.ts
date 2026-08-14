import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    --_lr-avatar-size: var(--lr-size-3rem);
    --_lr-avatar-bg: var(--lr-color-border);
    --_lr-avatar-color: var(--lr-color-text);
    /* Keep initials proportional across the complete mirrored size ladder. */
    --_lr-avatar-font-size: var(--lr-font-size-m);
  }
  /* The canonical LyraSize ladder plus the mirrored long aliases. */
  :host([size='2xs']) {
    --_lr-avatar-size: var(--lr-size-1-5rem);
    --_lr-avatar-font-size: var(--lr-font-size-xs);
  }
  :host([size='xs']) {
    --_lr-avatar-size: var(--lr-size-2rem);
    --_lr-avatar-font-size: var(--lr-font-size-sm);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-avatar-size: var(--lr-size-2-5rem);
    --_lr-avatar-font-size: var(--lr-font-size-md-sm);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-avatar-size: var(--lr-size-4rem);
    --_lr-avatar-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --_lr-avatar-size: var(--lr-size-5rem);
    --_lr-avatar-font-size: var(--lr-font-size-xl);
  }
  /* Deliberately NOT the shared internal/variants.styles.ts sheet. That sheet re-points the
     generic slots at the 45-slot semantic grid's contrast-checked pairing, where text on a quiet
     fill is on-quiet (a near-black/near-white). An avatar's initials are the accent itself --
     they read in the variant's own loud colour on that variant's quiet tint -- so adopting the
     grid pairing here would repaint every non-neutral avatar, and the neutral default (a
     --lr-color-border circle, not a neutral-fill-quiet one) with it. */
  :host([variant='brand']) {
    --_lr-avatar-bg: var(--lr-color-brand-quiet);
    --_lr-avatar-color: var(--lr-color-brand);
  }
  :host([variant='success']) {
    --_lr-avatar-bg: var(--lr-color-success-quiet);
    --_lr-avatar-color: var(--lr-color-success);
  }
  :host([variant='warning']) {
    --_lr-avatar-bg: var(--lr-color-warning-quiet);
    --_lr-avatar-color: var(--lr-color-warning);
  }
  :host([variant='danger']) {
    --_lr-avatar-bg: var(--lr-color-danger-quiet);
    --_lr-avatar-color: var(--lr-color-danger);
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--size, var(--lr-avatar-size, var(--_lr-avatar-size)));
    block-size: var(--size, var(--lr-avatar-size, var(--_lr-avatar-size)));
    overflow: hidden;
    border-radius: var(--lr-radius-pill);
    background: var(--lr-avatar-bg, var(--_lr-avatar-bg));
    color: var(--lr-avatar-color, var(--_lr-avatar-color));
    font-size: var(--lr-avatar-font-size, var(--_lr-avatar-font-size));
    font-weight: var(--lr-font-weight-semibold);
    flex: 0 0 auto;
  }
  /* Three genuinely distinct corners: 'circle' (the pill radius above), 'rounded' (the shared
     medium radius), and 'square' (no radius at all). */
  :host([shape='rounded']) [part='base'] {
    border-radius: var(--lr-radius);
  }
  :host([shape='square']) [part='base'] {
    border-radius: 0;
  }
  [part='icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  [part='icon'] ::slotted(svg) {
    display: block;
  }
  /* The native [hidden] UA rule alone would lose to [part='icon']'s own
     'display: inline-flex' above at equal specificity -- same fix
     lr-chip's/lr-stat's identical [part='icon'][hidden] already applies. */
  [part='icon'][hidden] {
    display: none;
  }
  /* Both glyph slots stay mounted at every tier so their slotchange handlers keep firing; the
     inactive one is collapsed rather than removed. Stated explicitly instead of leaning on the
     UA [hidden] rule, since a slot's own 'display: contents' default makes that easy to break. */
  [part='icon'] slot[hidden] {
    display: none;
  }
  [part='image'] {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  @media (forced-colors: active) {
    [part='base'] {
      border: var(--lr-border-width-thin) solid CanvasText;
      background: Canvas;
      color: CanvasText;
      forced-color-adjust: auto;
    }
    [part='image'] {
      forced-color-adjust: none;
    }
  }
`;
