import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    --lr-avatar-size: var(--lr-size-2rem);
    --lr-avatar-bg: var(--lr-color-border);
    --lr-avatar-color: var(--lr-color-text);
    /* The 'medium' default reproduces the single font-size every tier used to share, so an unset /
       size="medium" avatar renders byte-identical. The other two tiers reassign this same knob (no
       per-tier [part='base'] rules) -- the initials have to track the circle they sit in, or two
       characters overflow a 1.5rem 'small' circle and look lost in a 2.5rem 'large' one. */
    --lr-avatar-font-size: var(--lr-font-size-sm);
  }
  /* Every spelling of every tier selects the same declarations. The canonical ladder is the
     library-wide LyraSize one ('2xs'..'xl', with 'small'/'medium'/'large' as the accepted Web
     Awesome / Shoelace spellings of 's'/'m'/'l'), and this component's own older 'sm'/'md'/'lg'
     shorthands stay accepted so existing markup doesn't silently lose its sizing. Each of the six
     tiers gets a real diameter -- a value the type accepts but the stylesheet ignores would render
     at the default tier with nothing anywhere reporting it. */
  :host([size='2xs']) {
    --lr-avatar-size: var(--lr-size-1rem);
    --lr-avatar-font-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --lr-avatar-size: var(--lr-size-1-25rem);
    --lr-avatar-font-size: var(--lr-font-size-2xs);
  }
  :host([size='s']),
  :host([size='small']),
  :host([size='sm']) {
    --lr-avatar-size: var(--lr-size-1-5rem);
    --lr-avatar-font-size: var(--lr-font-size-xs);
  }
  :host([size='l']),
  :host([size='large']),
  :host([size='lg']) {
    --lr-avatar-size: var(--lr-size-2-5rem);
    --lr-avatar-font-size: var(--lr-font-size-m);
  }
  :host([size='xl']) {
    --lr-avatar-size: var(--lr-size-3rem);
    --lr-avatar-font-size: var(--lr-font-size-lg);
  }
  /* Deliberately NOT the shared internal/variants.styles.ts sheet. That sheet re-points the
     generic slots at the 45-slot semantic grid's contrast-checked pairing, where text on a quiet
     fill is on-quiet (a near-black/near-white). An avatar's initials are the accent itself --
     they read in the variant's own loud colour on that variant's quiet tint -- so adopting the
     grid pairing here would repaint every non-neutral avatar, and the neutral default (a
     --lr-color-border circle, not a neutral-fill-quiet one) with it. */
  :host([variant='brand']) {
    --lr-avatar-bg: var(--lr-color-brand-quiet);
    --lr-avatar-color: var(--lr-color-brand);
  }
  :host([variant='success']) {
    --lr-avatar-bg: var(--lr-color-success-quiet);
    --lr-avatar-color: var(--lr-color-success);
  }
  :host([variant='warning']) {
    --lr-avatar-bg: var(--lr-color-warning-quiet);
    --lr-avatar-color: var(--lr-color-warning);
  }
  :host([variant='danger']) {
    --lr-avatar-bg: var(--lr-color-danger-quiet);
    --lr-avatar-color: var(--lr-color-danger);
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-avatar-size);
    block-size: var(--lr-avatar-size);
    overflow: hidden;
    border-radius: var(--lr-radius-pill);
    background: var(--lr-avatar-bg);
    color: var(--lr-avatar-color);
    font-size: var(--lr-avatar-font-size);
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
`;
