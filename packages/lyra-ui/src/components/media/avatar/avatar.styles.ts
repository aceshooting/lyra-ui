import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    --lr-avatar-size: var(--lr-size-2rem);
    --lr-avatar-bg: var(--lr-color-border);
    --lr-avatar-color: var(--lr-color-text);
    /* The 'md' default reproduces the single font-size every tier used to share, so an unset /
       size="md" avatar renders byte-identical. The other two tiers reassign this same knob (no
       per-tier [part='base'] rules) -- the initials have to track the circle they sit in, or two
       characters overflow a 1.5rem 'sm' circle and look lost in a 2.5rem 'lg' one. */
    --lr-avatar-font-size: var(--lr-font-size-sm);
  }
  :host([size='sm']) {
    --lr-avatar-size: var(--lr-size-1-5rem);
    --lr-avatar-font-size: var(--lr-font-size-xs);
  }
  :host([size='lg']) {
    --lr-avatar-size: var(--lr-size-2-5rem);
    --lr-avatar-font-size: var(--lr-font-size-md);
  }
  :host([tone='brand']) {
    --lr-avatar-bg: var(--lr-color-brand-quiet);
    --lr-avatar-color: var(--lr-color-brand);
  }
  :host([tone='success']) {
    --lr-avatar-bg: var(--lr-color-success-quiet);
    --lr-avatar-color: var(--lr-color-success);
  }
  :host([tone='warning']) {
    --lr-avatar-bg: var(--lr-color-warning-quiet);
    --lr-avatar-color: var(--lr-color-warning);
  }
  :host([tone='danger']) {
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
  :host([shape='square']) [part='base'] {
    border-radius: var(--lr-radius);
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
  [part='image'] {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
`;
