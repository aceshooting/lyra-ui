import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* The host itself is the focusable role="menuitem" target (see the class
       doc) -- the ring paints on [part='base'] instead of the host's own
       box, matching lr-tree-item's identical :host(:focus-visible)
       delegation, so it always hugs the visible row rather than any
       host-level margin/inline layout quirks. */
    outline: none;
    border-radius: var(--lr-form-control-radius);
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
       inline affordances, and at this size it collides the leading icon with the label of a menu
       row. The icon/label/chevron rhythm is constant across tiers here; only the box scales. */
    gap: var(--lr-space-xs);
    /* max() rather than the bare ladder value: the ladder's bottom two tiers resolve to 20px/24px,
       and a menu row is a pointer target, so it floors at the WCAG 2.2 SC 2.5.8 minimum. Above
       that floor the row tracks the same heights every other control in a toolbar row uses. */
    min-block-size: max(var(--lr-form-control-height), var(--lr-size-24px));
    padding-block: var(--lr-form-control-padding-block);
    padding-inline: var(--lr-form-control-padding-inline);
    border-radius: var(--lr-form-control-radius);
    cursor: pointer;
    font: inherit;
    font-size: var(--lr-form-control-font-size);
    color: inherit;
    line-height: var(--lr-line-height-snug);
  }
  [part='base']:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* The same fill hover uses, mixed further toward --lr-color-mix-partner (the text colour), so a
     row that is being pressed is always a visible step past the row the pointer merely rests on. */
  [part='base']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  :host([disabled]) [part='base'] {
    /* Shared library-wide disabled-state token -- see lr-checkbox/lr-select. */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host([disabled]) [part='base']:hover {
    background: none;
  }
  /* Suppression, not a treatment: the host is the role="menuitem" target and stays in the DOM as a
     pressable box while disabled, so without this the pressed mix above would still paint under a
     pointer that a disabled row must not respond to. */
  :host([disabled]) [part='base']:active {
    background: none;
  }
  :host([destructive]) [part='base'] {
    color: var(--lr-color-danger);
  }
  :host([destructive]) [part='base']:hover {
    background: var(--lr-color-danger-quiet);
  }
  /* Same step past hover as the ordinary row above, taken on the danger fill this variant hovers
     with. Ordered exactly like the :hover rules it mirrors, so the disabled/destructive precedence
     stays whatever it already was rather than diverging between the two states. */
  :host([destructive]) [part='base']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-danger-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    line-height: var(--lr-line-height-none);
  }
  /* [part='icon'][hidden] rather than a bare :empty selector -- the part
     always contains a literal <slot> child element regardless of assigned
     content, so :empty never matches (same fix as lr-select's
     [part='hint']/[part='error']). Real emptiness is tracked in JS
     (hasIconSlot) and reflected via the hidden attribute instead. */
  [part='icon'][hidden] {
    display: none;
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Only ever present in the DOM at all for a checked type="checkbox" item
     (see menu-item.ts's render()) -- no [hidden]-toggling needed, unlike
     [part='icon'] above, since there's no always-present <slot> child here
     to keep visually empty in between. */
  [part='checkmark'] {
    flex: 0 0 auto;
    color: var(--lr-color-brand);
  }
  /* Only in the DOM at all for a submenu parent (see menu-item.ts's render()),
     so it needs no [hidden] bookkeeping either. */
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
  /* The chevron points at the submenu, which opens on the inline-end side --
     mirrored through this wrapping part rather than by swapping the glyph, so
     the shared icon set stays direction-free. */
  :host(:dir(rtl)) [part='submenu-icon'] {
    transform: scaleX(-1);
  }
`;
