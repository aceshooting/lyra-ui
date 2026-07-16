import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    --lyra-avatar-group-avatar-size: var(--lyra-size-2rem);
    --lyra-avatar-group-overlap: var(--lyra-size-neg-6px);
    --lyra-avatar-group-ring-color: var(--lyra-color-surface);
    --lyra-avatar-group-ring-width: var(--lyra-border-width-medium);
    --lyra-avatar-group-badge-bg: var(--lyra-color-border);
    --lyra-avatar-group-badge-color: var(--lyra-color-text);
  }
  :host([size='sm']) {
    --lyra-avatar-group-avatar-size: var(--lyra-size-1-5rem);
    --lyra-avatar-group-overlap: var(--lyra-size-neg-4px);
  }
  :host([size='lg']) {
    --lyra-avatar-group-avatar-size: var(--lyra-size-2-5rem);
    --lyra-avatar-group-overlap: var(--lyra-size-neg-8px);
  }
  :host([tone='brand']) {
    --lyra-avatar-group-badge-bg: var(--lyra-color-brand-quiet);
    --lyra-avatar-group-badge-color: var(--lyra-color-brand);
  }
  :host([tone='success']) {
    --lyra-avatar-group-badge-bg: var(--lyra-color-success-quiet);
    --lyra-avatar-group-badge-color: var(--lyra-color-success);
  }
  :host([tone='warning']) {
    --lyra-avatar-group-badge-bg: var(--lyra-color-warning-quiet);
    --lyra-avatar-group-badge-color: var(--lyra-color-warning);
  }
  :host([tone='danger']) {
    --lyra-avatar-group-badge-bg: var(--lyra-color-danger-quiet);
    --lyra-avatar-group-badge-color: var(--lyra-color-danger);
  }

  /* Unlike lyra-chip-group's [part='base'], this never wraps -- wrapping an overlapping stack to
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
     <lyra-avatar>'s own outer host box (sized by avatar.styles.ts's host display: inline-flex
     rule to exactly match its single [part=base] circle) -- avatar.styles.ts never sets
     box-shadow/border-radius on its own host, so there's no conflict. */
  ::slotted(lyra-avatar) {
    margin-inline-start: var(--lyra-avatar-group-overlap);
    border-radius: var(--lyra-radius-pill);
    box-shadow: 0 0 0 var(--lyra-avatar-group-ring-width) var(--lyra-avatar-group-ring-color);
  }
  ::slotted(lyra-avatar:first-child) {
    margin-inline-start: 0;
  }
  /* Each avatar's own ring adapts to that avatar's own reflected shape attribute -- no
     group-level coordination needed even in a mixed-shape group. */
  ::slotted(lyra-avatar[shape='square']) {
    border-radius: var(--lyra-radius);
  }

  /* Deliberately its own local badge styling rather than instantiating a real <lyra-avatar> in
     the shadow DOM for this -- keeps the group's rendering self-contained, the same way
     lyra-chip-group's overflow-indicator duplicates rather than nests a real <lyra-chip>. */
  [part='overflow-badge'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: var(--lyra-avatar-group-avatar-size);
    block-size: var(--lyra-avatar-group-avatar-size);
    margin-inline-start: var(--lyra-avatar-group-overlap);
    border: none;
    border-radius: var(--lyra-radius-pill);
    box-shadow: 0 0 0 var(--lyra-avatar-group-ring-width) var(--lyra-avatar-group-ring-color);
    background: var(--lyra-avatar-group-badge-bg);
    color: var(--lyra-avatar-group-badge-color);
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    font-weight: var(--lyra-font-weight-semibold);
    line-height: var(--lyra-line-height-snug);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lyra-transition-fast),
      box-shadow var(--lyra-transition-fast);
  }
  :host([shape='square']) [part='overflow-badge'] {
    border-radius: var(--lyra-radius);
  }
  [part='overflow-badge']:hover {
    box-shadow: 0 0 0 var(--lyra-avatar-group-ring-width) var(--lyra-color-brand);
  }
  [part='overflow-badge']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='overflow-badge'] {
      transition: none !important;
    }
  }
`;
