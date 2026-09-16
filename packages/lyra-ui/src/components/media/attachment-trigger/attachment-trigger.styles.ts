import { css } from 'lit';

export const styles = css`
  /* Fully transparent to layout, matching the nested dropdown/menu shell -- the visible/clickable
     surface is entirely the rendered button (in the multi-capability case, lr-dropdown's trigger
     wrapper around that same button), so this host contributes no stray box for a composer's start
     slot to fight with margin/inline-block quirks against the textarea. */
  :host {
    display: contents;
  }

  /* The internal native file input has no visible surface -- the trigger button/menu above are the
     only affordance; it exists purely so its synthetic .click() opens the OS file picker. Exposed
     as a part (the class doc's @csspart) only so a consumer's ::part(hidden-input) can override
     this if their integration needs to. */
  [part='hidden-input'] {
    display: none;
  }

  /* This component's own default paint, set on the HOST for organization only -- nothing here
     reads an --lr-icon-button-* token to compute it (except -color-active's cross-reference to the
     PUBLIC hover tier, noted below). The appearance tiers move only the fill/foreground/edge inputs
     these read, and the .trigger-button rule further down writes the results onto lr-icon-button's
     own --_lr-icon-button-<token>-default tier (never the public --lr-icon-button-* name), so an
     ancestor theme wrapper's own --lr-icon-button-* still wins: lr-icon-button's own stylesheet
     already checks the public token FIRST, ahead of any default a composing parent supplies.
     The neutral row of the semantic grid is named directly rather than importing
     internal/variants.styles.ts: that sheet is ~45 declarations per shadow root and exists to swap
     the generic slots per the variant attribute, which this component deliberately does not take. */
  :host {
    --_lr-attachment-trigger-fill: transparent;
    --_lr-attachment-trigger-on-fill: var(--lr-color-text-quiet);
    --_lr-attachment-trigger-edge: 0;
    --_lr-attachment-trigger-bg: var(--_lr-attachment-trigger-fill);
    --_lr-attachment-trigger-bg-hover: color-mix(
      in oklab,
      var(--_lr-attachment-trigger-fill),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
    --_lr-attachment-trigger-bg-active: color-mix(
      in oklab,
      var(--_lr-attachment-trigger-fill),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    --_lr-attachment-trigger-color: var(--_lr-attachment-trigger-on-fill);
    --_lr-attachment-trigger-color-hover: var(--_lr-attachment-trigger-on-fill);
    /* Reads the PUBLIC hover token (not this component's own -color-hover default) so that an
       ancestor override of just the hover tier still shapes the press colour -- a cross-reference
       to a DIFFERENT public token than the one being defined here, so it introduces no loop. */
    --_lr-attachment-trigger-color-active: var(
      --lr-icon-button-color-hover,
      var(--_lr-attachment-trigger-on-fill)
    );
    --_lr-attachment-trigger-border: var(--_lr-attachment-trigger-edge);
    --_lr-attachment-trigger-radius: calc(var(--lr-radius) * 0.6);
    /* The default tier. Unset, this is byte-identical to the --lr-font-size-lg this control painted
       before it had a size property. */
    --_lr-attachment-trigger-font-size: var(--lr-font-size-lg);
  }
  /* The appearance tiers move only the three fill/foreground/edge inputs the formulas above read,
     so an ancestor's own --lr-icon-button-* still out-ranks every one of them. "plain" needs no
     rule: the :host defaults ARE that tier, byte-identical to the pre-property treatment. */
  :host([appearance='filled']) {
    --_lr-attachment-trigger-fill: var(--lr-color-neutral-fill-quiet);
    --_lr-attachment-trigger-on-fill: var(--lr-color-neutral-on-quiet);
  }
  :host([appearance='accent']) {
    --_lr-attachment-trigger-fill: var(--lr-color-neutral-fill-loud);
    --_lr-attachment-trigger-on-fill: var(--lr-color-neutral-on-loud);
  }
  :host([appearance='outlined']) {
    --_lr-attachment-trigger-edge: var(--lr-border-width-thin) solid
      var(--lr-color-neutral-border-loud);
  }
  :host([appearance='filled-outlined']) {
    --_lr-attachment-trigger-fill: var(--lr-color-neutral-fill-quiet);
    --_lr-attachment-trigger-on-fill: var(--lr-color-neutral-on-quiet);
    --_lr-attachment-trigger-edge: var(--lr-border-width-thin) solid
      var(--lr-color-neutral-border-loud);
  }
  /* The glyph tier, taken from the shared ladder (internal/sizes.styles.ts, loaded ahead of this
     sheet by attachment-trigger.class.ts) so this control scales with every same-tier neighbour
     instead of maintaining a second scale. Both spellings of each aliased tier match, as the
     ladder does. The tappable box is NOT wired to the ladder -- see the size property's own doc. */
  :host([size='2xs']),
  :host([size='xs']),
  :host([size='s']),
  :host([size='small']),
  :host([size='m']),
  :host([size='medium']),
  :host([size='l']),
  :host([size='large']),
  :host([size='xl']) {
    --_lr-attachment-trigger-font-size: var(--lr-form-control-font-size);
  }
  /* The default tier has to restate the pre-property value: the ladder's own m tier resolves to
     --lr-font-size-m, which is smaller than the --lr-font-size-lg this control has always painted,
     so keying m off the ladder would silently shrink every existing consumer's glyph. */
  :host([size='m']),
  :host([size='medium']) {
    --_lr-attachment-trigger-font-size: var(--lr-font-size-lg);
  }

  /* Shared placement for the single-capability control ([part='trigger']) and the multi-capability
     one ([part='menu-trigger']) slotted into lr-dropdown's trigger slot. The latter cannot reuse
     part='trigger' -- reserved for the single-capability case so a consumer's ::part(trigger)
     targets exactly one control -- so both share this plain class for the identical declarations,
     on top of their own distinct part names.
     Both ARE lr-icon-buttons now, so the tappable floor, the radius, the hover/press mixes, the
     focus ring, the disabled dimming and the transition all come from that one component; the
     appearance and size tiers below only re-point the defaults this rule feeds into lr-icon-button's
     private --_lr-icon-button-<token>-default tier, never the public token itself, so an ancestor
     theme wrapper's own --lr-icon-button-* still wins. */
  .trigger-button {
    flex: 0 0 auto;
    line-height: var(--lr-line-height-none);
    --_lr-icon-button-background-default: var(--_lr-attachment-trigger-bg);
    --_lr-icon-button-background-hover-default: var(--_lr-attachment-trigger-bg-hover);
    --_lr-icon-button-background-active-default: var(--_lr-attachment-trigger-bg-active);
    --_lr-icon-button-color-default: var(--_lr-attachment-trigger-color);
    --_lr-icon-button-color-hover-default: var(--_lr-attachment-trigger-color-hover);
    --_lr-icon-button-color-active-default: var(--_lr-attachment-trigger-color-active);
    --_lr-icon-button-border-default: var(--_lr-attachment-trigger-border);
    --_lr-icon-button-radius-default: var(--_lr-attachment-trigger-radius);
    /* The size tier scales the GLYPH. The tappable box stays on the shared
       --lr-icon-button-size floor, which lr-icon-button applies for us. */
    font-size: var(--_lr-attachment-trigger-font-size);
  }
  .trigger-button svg {
    display: block;
  }

  /* [part='menu-trigger'] carries a second glyph -- the paperclip plus the disclosure chevron --
     where the single-capability [part='trigger'] has one, so it alone needs a gap. The gap belongs
     on the composed control's own flex row, which is one shadow boundary deeper. */
  [part='menu-trigger']::part(button) {
    gap: var(--lr-space-xs);
  }

  /* Disclosure cue for the multi-capability trigger, matching
     lr-combobox/lr-select's [part='expand-icon'] convention (same
     chevronIcon() rotated to point down) but sized down from their
     dedicated-touch-target treatment: here it is a second glyph inside one
     already-compact icon button, not its own separate control. */
  [part='expand-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    font-size: var(--lr-size-0-75em);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .trigger-button::part(button) {
      transition: none !important;
    }
  }
`;
