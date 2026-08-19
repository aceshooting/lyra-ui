import { css } from 'lit';

export const styles = css`
  :host {
    /* 70% of the tier's control height on the shared size ladder (internal/sizes.styles.ts), so the
       box lines up with a same-size lr-input/lr-select/lr-button; at "m" that is exactly the
       1.75rem it shipped with before it had a size. The --lr-icon-button-size cap stays so
       compacting that theme token compacts this control too. */
    --_lr-checkbox-box-size: min(
      var(--lr-icon-button-size),
      calc(var(--lr-form-control-height) * 0.7)
    );
    display: inline-block;
    /* Private default for the public label-indent hook: the box's floor plus the label gap, the
       same two terms the layout below uses. Overridable on an ancestor or the checkbox itself, but
       never on a sibling -- custom properties inherit down, not sideways, so a sibling <p> computes
       the formula from --lr-theme-icon-button-size and --lr-theme-space-s. */
    --_lr-checkbox-label-indent: calc(
      var(--lr-checkbox-box-size, var(--_lr-checkbox-box-size)) +
        var(--lr-space-s)
    );
  }
  .checkbox-layout {
    display: inline-flex;
    align-items: center;
    /* Derived from the published indent rather than repeating --lr-space-s, so the advertised value
       and the rendered label offset cannot drift: the label always starts exactly
       --lr-checkbox-label-indent from the base's inline start. Defaults to --lr-space-s. */
    gap: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .checkbox-owner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  .checkbox-owner:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host(:disabled) .checkbox-layout {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part~="box"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    /* The inline icon-affordance sizing convention of lr-combobox's clear-button and lr-select's
       toggle: --lr-icon-button-size capped at the tier's own share of the control height -- a real
       touch target without ballooning to the full 2.5rem meant for standalone icon-only buttons. */
    min-inline-size: var(--lr-checkbox-box-size, var(--_lr-checkbox-box-size));
    min-block-size: var(--lr-checkbox-box-size, var(--_lr-checkbox-box-size));
    /* The glyph is drawn at 1em, so the box owns the font size that scales it. Pinned to the ladder
       rather than inherited, the checkmark stays proportional to the box at every tier; at "m" it
       resolves to the same 1rem the surrounding text carries by default. */
    font-size: var(--lr-form-control-font-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: calc(var(--lr-form-control-radius) * 0.6);
    background: var(--lr-color-surface);
    color: var(--lr-color-on-brand);
    transition: background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  :host(:not(:disabled)) .checkbox-layout:hover [part~="box"] {
    border-color: var(--lr-checkbox-hover-border, var(--lr-color-brand));
  }
  /* Pressed as a ring, not a fill: the box's own fill is the state readout (page surface unchecked,
     brand checked), and tinting it under the thumb would wash out the checkmark or read as a
     half-toggled box. A ring is unambiguous in both states and visibly more than the hover's
     border-colour step -- the soft-ring pressed vocabulary <lr-slider>'s thumb uses. */
  :host(:not(:disabled)) .checkbox-layout:active [part~="box"] {
    border-color: var(--lr-checkbox-active-border, var(--lr-color-brand));
    box-shadow: 0 0 0 var(--lr-border-width-medium)
      var(--lr-checkbox-active-ring, var(--lr-color-brand-quiet));
  }
  [part~="checked"],
  [part~="indeterminate"] {
    /* Component-scoped indirection, mirroring lr-source-picker's identical
       --lr-source-picker-checked-bg/-border pair, so a consumer can retint just this control's
       checked/indeterminate fill without hijacking the shared --lr-color-brand token. */
    background: var(--lr-checkbox-checked-bg, var(--lr-color-brand));
    border-color: var(--lr-checkbox-checked-border, var(--lr-color-brand));
  }
  /* A persistent visible affordance for a required-but-unmet checkbox, matching
     lr-combobox/lr-select's data-invalid styling hook: the native validation bubble only shows
     momentarily around reportValidity()/form submission. */
  :host([data-invalid]) [part~="box"] {
    border-color: var(--lr-checkbox-invalid-border, var(--lr-color-danger));
  }

  [part~="checkmark"] {
    display: block;
    color: var(--checked-icon-color, currentColor);
    transform: scale(var(--checked-icon-scale, 1));
  }

  /* No explicit "display" here (unlike lr-combobox's [part='form-control-label']), so the UA
     stylesheet's default "[hidden] { display: none }" rule needs no author-side override when
     hasLabelSlot is false. */
  [part="label"] {
    margin-inline-start: calc(
      var(--lr-checkbox-label-indent, var(--_lr-checkbox-label-indent)) -
        max(
          var(--lr-icon-button-size),
          var(--lr-checkbox-box-size, var(--_lr-checkbox-box-size))
        )
    );
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }

  [part~="hint"] {
    margin-block-start: var(--lr-space-xs);
    margin-inline-start: var(
      --lr-checkbox-label-indent,
      var(--_lr-checkbox-label-indent)
    );
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part~="hint"][hidden] {
    display: none;
  }

  [part="error"] {
    margin-block-start: var(--lr-space-xs);
    margin-inline-start: var(
      --lr-checkbox-label-indent,
      var(--_lr-checkbox-label-indent)
    );
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  [part="error"][hidden] {
    display: none;
  }

  [part="form-control"],
  [part="label"],
  [part~="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }

  @media (prefers-reduced-motion: reduce) {
    [part~="box"] {
      transition: none !important;
    }
  }
`;
