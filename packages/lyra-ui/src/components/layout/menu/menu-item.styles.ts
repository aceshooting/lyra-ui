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
       floor the row tracks the heights every other control in a toolbar row uses. The hook is the
       outer arm, so a denser or roomier menu is one declaration on the menu rather than a
       ::part(base) rule per item -- and unset it is byte-identical to the ladder expression that
       was here before. A value below the 24px floor is the consumer's own call, exactly as it is
       when they override the ladder itself. */
    min-block-size: var(
      --lr-menu-item-min-height,
      max(var(--lr-form-control-height), var(--lr-size-24px))
    );
    padding-block: var(--lr-form-control-padding-block);
    padding-inline: var(--lr-form-control-padding-inline);
    border-radius: var(--lr-menu-item-radius, var(--lr-form-control-radius));
    cursor: pointer;
    /* A link-item's [part='base'] renders as a real <a>; the plain (non-link) row stays a <span>,
       for which this is a no-op. */
    text-decoration: none;
    font: inherit;
    font-size: var(--lr-form-control-font-size);
    color: inherit;
    line-height: var(--lr-line-height-snug);
    /* Hover/active/checked below only ever repaint background, so background-color is all this
       needs; without it this row's fill snaps while lr-button/lr-icon-button/lr-app-rail-item ease.
       No local reduced-motion override needed -- tokens.styles.ts's shared reduced-motion block
       already flattens --lr-transition-fast to 0.001ms and applies a blanket transition-duration:
       0.001ms across the whole shadow tree under prefers-reduced-motion. */
    transition: background-color var(--lr-transition-fast);
  }
  /* Unlike lr-option/lr-select/lr-combobox/lr-tree-item, a checked row here previously had no
     row-chrome hooks of its own: type="checkbox" only painted the checkmark glyph, leaving the
     row's own background/color/weight identical to an unchecked one. Inline var() fallbacks
     (never :host declarations), matching every other row-chrome hook above, so unset this is a
     byte-identical no-op and a menu/ancestor can retune it without a ::part(base) rule. :where()
     keeps the [checked] qualifier out of the specificity count -- same mechanism lr-tree-item's
     selected-row rule uses -- so this lands at the SAME (0,2,0) specificity as the hover/active
     rules below rather than the (0,3,0) a bare :host([checked]) would reach; landing higher would
     let a checked row's resting background permanently defeat its own :hover/:active paint. Being
     declared BEFORE those rules means the later hover/active rule still wins the resulting tie, so
     a checked row keeps normal pointer feedback. */
  :host(:where([checked])) [part='base'] {
    background: var(--lr-menu-item-checked-bg, transparent);
    color: var(--lr-menu-item-checked-color, inherit);
    font-weight: var(--lr-menu-item-checked-font-weight, inherit);
  }
  /* The row's own hover fill, an inline var() fallback like every other row-chrome hook here, so
     unset it is the quiet brand fill this row has always painted. Menus are the one surface an
     application most often wants a different resting-to-hover step on, and the alternative was a
     ::part(base):hover rule in the consumer's stylesheet -- which the pressed mix below could not
     then follow. */
  [part='base']:hover {
    background: var(--lr-menu-item-hover-bg, var(--lr-color-brand-quiet));
  }
  /* The public arm the hover hook's sibling never had: for parity with --lr-option-active-bg /
     --lr-select-option-active-bg / --lr-combobox-option-active-bg / --lr-locale-picker-option-
     active-bg, a consumer can now set the pressed fill directly rather than only through the
     hover-derived mix below, which stays the unset fallback. It mixes from the SAME hover hook the
     hover rule reads, so a retuned hover fill keeps its pressed step instead of snapping back to
     the brand default under the pointer when --lr-menu-item-active-bg itself is left unset. */
  [part='base']:active {
    background: var(
      --lr-menu-item-active-bg,
      color-mix(
        in oklab,
        var(--lr-menu-item-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
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
    /* Unset this inherits the row's own colour, exactly as the leading glyph did before the hook
       existed -- including the danger variant's red and the disabled row's dimmed text. Set, it
       de-emphasises or accents the glyph without touching the label beside it, which a
       ::part(icon) rule could only do by re-stating the row's every state. */
    color: var(--lr-menu-item-icon-color, inherit);
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
