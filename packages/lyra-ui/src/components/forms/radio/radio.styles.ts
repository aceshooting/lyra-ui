import { css } from 'lit';

export const styles = css`
  :host {
    /* The indicator tracks the shared size ladder (internal/sizes.styles.ts): 70% of the tier's
       control height, so a radio lines up with an lr-input/lr-select/lr-button of the same size
       rather than carrying its own scale. At the default "m" tier that is exactly the 1.75rem it
       shipped with; the --lr-icon-button-size cap stays so compacting that theme token still
       compacts this control. */
    --_lr-radio-circle-size: min(
      var(--lr-icon-button-size),
      calc(var(--lr-form-control-height) * 0.7)
    );
    /* Capped at half the circle so the dot can never outgrow its ring, whatever a consumer does to
       the ladder or the --lr-icon-button-size cap above. 0.75rem at "m", the size it shipped
       with. */
    --_lr-radio-dot-size: min(
      calc(var(--lr-radio-circle-size, var(--_lr-radio-circle-size)) * 0.5),
      calc(var(--lr-form-control-height) * 0.3)
    );
    /* Corner radius of the control's own chrome. A circular indicator is fully round at every
       setting; the knob exists so <lr-radio-button>'s rectangular chrome -- which inherits this
       class and with it the pill value -- has one name to override. */
    --_lr-radio-radius: var(--lr-radius-pill);
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Private default for the public label-indent hook: the layout's own two terms, the circle's
       floor plus the label gap. Overridable on an ancestor or on the radio, but never on a sibling
       -- custom properties inherit down, not sideways; a sibling <p> computes the same formula
       from --lr-theme-icon-button-size and --lr-theme-space-s. */
    --_lr-radio-label-indent: calc(
      var(--lr-radio-circle-size, var(--_lr-radio-circle-size)) +
        var(--lr-space-s)
    );
  }
  /* A group projects its tier without rewriting the option's authored size: explicit inherit beats
     sizes.styles.ts's local default and reads the group host's already-resolved ladder variables.
     Removing or reparenting clears the private marker and restores the option's own tier. */
  :host([data-lr-group-size]) {
    --lr-form-control-height: inherit;
    --lr-form-control-font-size: inherit;
    --lr-form-control-padding-inline: inherit;
    --lr-form-control-padding-block: inherit;
    --lr-form-control-gap: inherit;
    --lr-form-control-radius: inherit;
  }
  [part~="base"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    /* Derived from the published indent, not a repeated --lr-space-s, so the advertised value and
       the rendered offset cannot drift: the label starts exactly --lr-radio-label-indent from the
       base's inline start. --lr-space-s by default. */
    gap: calc(
      var(--lr-radio-label-indent, var(--_lr-radio-label-indent)) -
        var(--lr-radio-circle-size, var(--_lr-radio-circle-size))
    );
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part~="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* :host(:disabled), not :host([disabled]): a form-associated custom element
     (static formAssociated = true) matches :disabled/:enabled like a native control, from its own
     disabled content attribute *or* an ancestor <fieldset disabled>'s cascade. The attribute
     selector caught only the first, leaving a fieldset-disabled radio's base at full opacity with
     a normal cursor while effectiveDisabled correctly gated tabindex/aria-disabled. */
  [part~="base"][part~="disabled"] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part~="circle"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    /* A floor, never a hard size -- exactly <lr-checkbox>'s [part='box']. A label-less radio keeps
       the indicator centered in the base's shared target floor, where a hard
       inline-size/block-size would let an enlarged indicator overflow its content box. Same inline
       icon-affordance convention as lr-combobox's clear-button / lr-select's toggle:
       --lr-icon-button-size capped at the tier's share of the control height. */
    min-inline-size: var(--lr-radio-circle-size, var(--_lr-radio-circle-size));
    min-block-size: var(--lr-radio-circle-size, var(--_lr-radio-circle-size));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radio-radius, var(--_lr-radio-radius));
    background: var(--lr-color-surface);
    transition: border-color var(--lr-transition-fast),
      background-color var(--lr-transition-fast);
  }
  [part~="base"]:not([part~="disabled"]):hover [part~="circle"] {
    border-color: var(--lr-radio-hover-border-color, var(--lr-color-brand));
  }
  /* Pressed: a ring, not a fill, for the same reason <lr-checkbox>'s [part='box'] takes one -- the
     circle's fill IS the state readout (surface unchecked, the dot once checked), so tinting it
     would read as a half-selected radio. Visibly more than the hover's border-colour step, in
     <lr-slider>'s thumb's soft-ring vocabulary. */
  [part~="base"]:not([part~="disabled"]):active [part~="circle"] {
    border-color: var(
      --lr-radio-active-border-color,
      var(--lr-radio-hover-border-color, var(--lr-color-brand))
    );
    box-shadow: 0 0 0 var(--lr-border-width-medium)
      var(--lr-radio-active-ring-color, var(--lr-color-brand-quiet));
  }
  [part~="circle"][part~="checked"] {
    /* Component-scoped indirection (mirrors lr-checkbox's --lr-checkbox-checked-bg/-border pair)
       so a consumer can retint this control's checked ring without hijacking the shared
       --lr-color-brand used across the library. */
    border-color: var(--lr-radio-checked-border-color, var(--lr-color-brand));
  }
  [part~="dot"] {
    inline-size: var(--lr-radio-dot-size, var(--_lr-radio-dot-size));
    block-size: var(--lr-radio-dot-size, var(--_lr-radio-dot-size));
    border-radius: var(--lr-radius-pill);
    background: var(
      --checked-icon-color,
      var(--lr-radio-checked-dot-color, var(--lr-color-brand))
    );
    transform: scale(var(--checked-icon-scale, 1));
  }
  [part="label"][hidden] {
    display: none;
  }
  [part="label"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    [part~="circle"] {
      transition: none !important;
    }
  }
`;
