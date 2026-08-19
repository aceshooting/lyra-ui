import { css } from 'lit';

export const styles = css`
  /* Inline var() fallbacks for the row-chrome hooks, not :host declarations, so an application can
     set them once on a menu or other ancestor and every item inherits. Unset, they resolve to the
     spacing and size-ladder radius this row used before. */
  :host {
    display: block;
    /* place() gives every floating panel a 4px main-axis gap; Shoelace's public --submenu-offset is
       the *final* signed distance instead, its -2px default overlapping the parent menu by 2px.
       Keep that exact compatibility default, both literals resolved through design tokens, before
       the class forwards this translation to the nested menu's popup. */
    --_lr-menu-item-submenu-translation: calc(
      var(--submenu-offset, calc(-1 * var(--lr-size-2px))) - var(--lr-size-4px)
    );
    /* The host is the focusable role="menuitem" target (see the class doc), but the ring paints on
       [part='base'] -- lr-tree-item's identical :host(:focus-visible) delegation -- so it hugs the
       visible row rather than any host-level margin/inline layout quirks. */
    outline: none;
    border-radius: var(--lr-menu-item-radius, var(--lr-form-control-radius));
  }
  :host(:focus-visible) [part='base'] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='base'] {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    /* Deliberately NOT --lr-form-control-gap: that knob is the 2px rhythm between an input's own
       inline affordances, and at that size the leading icon collides with a menu row's label. The
       icon/label/chevron rhythm is constant across tiers here; only the box scales. */
    gap: var(--lr-menu-item-gap, var(--lr-space-xs));
    /* max() rather than the bare ladder value: the ladder's bottom two tiers resolve to 20px/24px
       and a menu row is a pointer target, so it floors at the WCAG 2.2 SC 2.5.8 minimum. Above the
       floor the row tracks the heights every other control in a toolbar row uses. */
    min-block-size: max(var(--lr-form-control-height), var(--lr-size-24px));
    padding-block: var(--lr-form-control-padding-block);
    padding-inline: var(--lr-form-control-padding-inline);
    border-radius: var(--lr-menu-item-radius, var(--lr-form-control-radius));
    cursor: pointer;
    font: inherit;
    font-size: var(--lr-form-control-font-size);
    color: inherit;
    line-height: var(--lr-line-height-snug);
  }
  [part='base']:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* The hover fill mixed further toward --lr-color-mix-partner (the text colour), so a pressed row
     is always a visible step past the row the pointer merely rests on. */
  [part='base']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  :host([disabled]) [part='base'],
  :host([loading]) [part='base'] {
    /* Shared library-wide disabled-state token -- see lr-checkbox/lr-select. */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host([disabled]) [part='base']:hover,
  :host([loading]) [part='base']:hover {
    background: none;
  }
  /* Suppression, not a treatment: the host stays a pressable role="menuitem" box while disabled, so
     without this the pressed mix above would still paint under the pointer. */
  :host([disabled]) [part='base']:active,
  :host([loading]) [part='base']:active {
    background: none;
  }
  :host([variant='danger']) [part='base'] {
    color: var(--lr-menu-item-danger-color, var(--lr-color-danger));
  }
  :host([variant='danger']:not([disabled]):not([loading])) [part='base']:hover {
    background: var(
      --lr-menu-item-danger-hover-bg,
      var(--lr-color-danger-quiet)
    );
  }
  /* Same step past hover as the ordinary row above, taken on the danger fill this variant hovers
     with. Disabled/loading rows never regain enabled paint through this later danger rule. */
  :host([variant='danger']:not([disabled]):not([loading]))
    [part='base']:active {
    background: var(
      --lr-menu-item-danger-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-danger-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part~='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    line-height: var(--lr-line-height-none);
  }
  /* [hidden] rather than :empty -- the part always contains a literal <slot> child, so :empty never
     matches (same fix as lr-select's [part='hint']/[part='error']). Emptiness is tracked in JS
     (hasIconSlot). */
  [part~='icon'][hidden] {
    display: none;
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='details'],
  [part='suffix'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    /* Resolve each slotted fragment from its own first strong character -- a shortcut hint like
       '⌘D' leads with a bidi-neutral glyph -- not the row's ambient direction. Only the *position*
       of these trailing parts mirrors under RTL (the flex row above handles that); their glyph
       order stays fixed, matching the OS. Same mechanism as toast-item.styles.ts's and
       alert.styles.ts's [part="content"]/[part="message"] rules. */
    unicode-bidi: plaintext;
  }
  [part='details'] ::slotted(*),
  [part='suffix'] ::slotted(*) {
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='details'][hidden],
  [part='suffix'][hidden] {
    display: none;
  }
  [part~='spinner'] {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    animation: lr-menu-item-spin var(--lr-transition-ambient) linear infinite;
  }
  @keyframes lr-menu-item-spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* Only in the DOM for a checked type="checkbox" item (see menu-item.ts's render()), so unlike
     [part='icon'] above it needs no [hidden] toggling -- there is no always-present <slot> child
     here to keep visually empty. */
  [part='checkmark'] {
    flex: 0 0 auto;
    color: var(--lr-color-brand);
  }
  /* Only in the DOM for a submenu parent (see menu-item.ts's render()), so it needs no [hidden]
     bookkeeping either. */
  [part='submenu-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    margin-inline-start: auto;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-none);
  }
  /* The chevron points at the submenu, which opens inline-end. Mirrored through this wrapping part
     rather than by swapping the glyph, so the shared icon set stays direction-free. */
  :host(:dir(rtl)) [part='submenu-icon'] {
    transform: scaleX(-1);
  }
  :host(:dir(rtl)) {
    /* A positive distance moves away from the parent, a negative one overlaps it, whichever inline
       edge owns the submenu. */
    --_lr-menu-item-submenu-translation: calc(
      var(--lr-size-4px) - var(--submenu-offset, calc(-1 * var(--lr-size-2px)))
    );
  }
  [part='submenu'] {
    display: contents;
  }
  @media (prefers-reduced-motion: reduce) {
    [part~='spinner'] {
      animation: none;
    }
  }
`;
