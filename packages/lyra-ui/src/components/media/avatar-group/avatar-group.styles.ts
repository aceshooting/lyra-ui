import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    --lr-avatar-group-avatar-size: var(--lr-size-2rem);
    --lr-avatar-group-overlap: var(--lr-size-neg-6px);
    --lr-avatar-group-ring-color: var(--lr-color-surface);
    --lr-avatar-group-ring-width: var(--lr-border-width-medium);
    --lr-avatar-group-badge-bg: var(--lr-color-border);
    --lr-avatar-group-badge-color: var(--lr-color-text);
    /* Mirrors lr-avatar's own --lr-avatar-font-size scale exactly, so a "+N" badge and the
       avatars it caps read at the same optical weight at every tier. The 'md' default is the
       single font-size the badge used to use at every tier, so an unset group is byte-identical. */
    --lr-avatar-group-badge-font-size: var(--lr-font-size-sm);
  }
  :host([size='sm']) {
    --lr-avatar-group-avatar-size: var(--lr-size-1-5rem);
    --lr-avatar-group-overlap: var(--lr-size-neg-4px);
    --lr-avatar-group-badge-font-size: var(--lr-font-size-xs);
  }
  :host([size='lg']) {
    --lr-avatar-group-avatar-size: var(--lr-size-2-5rem);
    --lr-avatar-group-overlap: var(--lr-size-neg-8px);
    --lr-avatar-group-badge-font-size: var(--lr-font-size-md);
  }
  :host([tone='brand']) {
    --lr-avatar-group-badge-bg: var(--lr-color-brand-quiet);
    --lr-avatar-group-badge-color: var(--lr-color-brand);
  }
  :host([tone='success']) {
    --lr-avatar-group-badge-bg: var(--lr-color-success-quiet);
    --lr-avatar-group-badge-color: var(--lr-color-success);
  }
  :host([tone='warning']) {
    --lr-avatar-group-badge-bg: var(--lr-color-warning-quiet);
    --lr-avatar-group-badge-color: var(--lr-color-warning);
  }
  :host([tone='danger']) {
    --lr-avatar-group-badge-bg: var(--lr-color-danger-quiet);
    --lr-avatar-group-badge-color: var(--lr-color-danger);
  }

  /* Unlike lr-chip-group's [part='base'], this never wraps -- wrapping an overlapping stack to
     a second line breaks the entire visual, so flex-wrap stays at its nowrap default. */
  [part='base'] {
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
  }

  /* Overlap via a logical margin so it auto-mirrors under dir="rtl" with zero JS: the first
     avatar visually anchors at the inline-start edge in either direction, later ones pull toward
     it. Later avatars paint on top of earlier ones for free (non-positioned, non-z-indexed
     elements already paint in flattened-slot order), and the shadow template places <slot> before
     the overflow badge, so the badge continues the same stacking when it renders. This targets
     <lr-avatar>'s own outer host box (sized by avatar.styles.ts's host display: inline-flex
     rule to exactly match its single [part=base] circle) -- avatar.styles.ts never sets
     box-shadow/border-radius on its own host, so there's no conflict. */
  ::slotted(lr-avatar) {
    margin-inline-start: var(--lr-avatar-group-overlap);
    border-radius: var(--lr-radius-pill);
    box-shadow: 0 0 0 var(--lr-avatar-group-ring-width) var(--lr-avatar-group-ring-color);
  }
  ::slotted(lr-avatar:first-child) {
    margin-inline-start: 0;
  }
  /* Each avatar's own ring adapts to that avatar's own reflected shape attribute -- no
     group-level coordination needed even in a mixed-shape group. */
  ::slotted(lr-avatar[shape='square']) {
    border-radius: var(--lr-radius);
  }

  /* Deliberately its own local badge styling rather than instantiating a real <lr-avatar> in
     the shadow DOM for this -- keeps the group's rendering self-contained, the same way
     lr-chip-group's overflow-indicator duplicates rather than nests a real <lr-chip>. */
  [part='overflow-badge'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: var(--lr-avatar-group-avatar-size);
    block-size: var(--lr-avatar-group-avatar-size);
    margin-inline-start: var(--lr-avatar-group-overlap);
    border: none;
    border-radius: var(--lr-radius-pill);
    box-shadow: 0 0 0 var(--lr-avatar-group-ring-width) var(--lr-avatar-group-ring-color);
    background: var(--lr-avatar-group-badge-bg);
    color: var(--lr-avatar-group-badge-color);
    font: inherit;
    font-size: var(--lr-avatar-group-badge-font-size);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lr-transition-fast),
      box-shadow var(--lr-transition-fast);
  }
  :host([shape='square']) [part='overflow-badge'] {
    border-radius: var(--lr-radius);
  }
  [part='overflow-badge']:hover {
    box-shadow: 0 0 0 var(--lr-avatar-group-ring-width) var(--lr-color-brand);
  }
  [part='overflow-badge']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='overflow-badge'] {
      transition: none !important;
    }
  }
`;
