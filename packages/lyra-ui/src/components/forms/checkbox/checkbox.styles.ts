import { css } from 'lit';

export const styles = css`
  :host {
    /* The box tracks the shared size ladder (internal/sizes.styles.ts): 70% of the tier's control
       height, so the checkbox lines up with an lr-input/lr-select/lr-button of the same size
       instead of carrying a scale of its own. At the default "m" tier this resolves to exactly the
       1.75rem the control shipped with before it had a size at all, and the
       --lr-icon-button-size cap is kept so a consumer compacting that theme token still compacts
       this control with it. */
    --lr-checkbox-box-size: min(
      var(--lr-icon-button-size),
      calc(var(--lr-form-control-height) * 0.7)
    );
    display: inline-block;
    /* Published (not an override hook, so it is declared rather than read with an inline
       var() fallback) so a consumer composing their own per-option hint text under the label
       can align it without re-deriving the geometry by reading these shadow styles. Same two
       terms the layout below actually uses: the box's floor plus the label gap.
       A :host declaration is still overridable from the consumer's own tree -- a document-tree
       rule on the host (lr-checkbox { --lr-checkbox-label-indent: ... }) beats any :host rule --
       but it does NOT reach a *sibling* node in the consumer's tree, because custom properties
       inherit down, not sideways. A consumer aligning a sibling <p> computes the same formula
       themselves from --lr-theme-icon-button-size and --lr-theme-space-s. */
    --lr-checkbox-label-indent: calc(var(--lr-checkbox-box-size) + var(--lr-space-s));
  }
  [part~='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    /* Derived from the published indent rather than repeating --lr-space-s, so the advertised
       value and the rendered label offset cannot drift: the label always starts exactly
       --lr-checkbox-label-indent from the base's inline start. Resolves to --lr-space-s by default. */
    gap: calc(var(--lr-checkbox-label-indent) - var(--lr-checkbox-box-size));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part~='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host(:disabled) [part~='base'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part~='box'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    /* Matches the inline icon-affordance sizing convention used by
       lr-combobox's clear-button / lr-select's toggle
       (--lr-icon-button-size capped at the tier's own share of the control
       height) — a real touch target without ballooning to the full 2.5rem
       meant for standalone icon-only buttons. */
    min-inline-size: var(--lr-checkbox-box-size);
    min-block-size: var(--lr-checkbox-box-size);
    /* The glyph is drawn at 1em, so the box owns the font size that scales it. Pinning it to the
       ladder rather than letting it inherit keeps the checkmark proportional to the box at every
       tier; at "m" it resolves to the same 1rem the surrounding text carries by default. */
    font-size: var(--lr-form-control-font-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: calc(var(--lr-form-control-radius) * 0.6);
    background: var(--lr-color-surface);
    color: var(--lr-color-on-brand);
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  :host(:not(:disabled)) [part~='base']:hover [part~='box'] {
    border-color: var(--lr-checkbox-hover-border, var(--lr-color-brand));
  }
  /* Pressed. Expressed as a ring around the box rather than as a fill, because the box's own fill
     is the state readout: it is the page surface while unchecked and the brand while checked, and
     tinting it under the thumb would either wash out the checkmark or read as a half-toggled box.
     A ring is unambiguous in both states, and is visibly more than the hover's border-colour step
     -- same soft-ring pressed vocabulary <lr-slider>'s thumb uses. */
  :host(:not(:disabled)) [part~='base']:active [part~='box'] {
    border-color: var(--lr-checkbox-active-border, var(--lr-color-brand));
    box-shadow: 0 0 0 var(--lr-border-width-medium) var(--lr-checkbox-active-ring, var(--lr-color-brand-quiet));
  }
  [part~='checked'],
  [part~='indeterminate'] {
    /* Component-scoped indirection (mirrors lr-source-picker's identical
       --lr-source-picker-checked-bg/-border pair) so a consumer can retint just this control's
       checked/indeterminate fill without hijacking the shared --lr-color-brand token used across
       the rest of the library. */
    background: var(--lr-checkbox-checked-bg, var(--lr-color-brand));
    border-color: var(--lr-checkbox-checked-border, var(--lr-color-brand));
  }
  /* Gives a required-but-unmet checkbox a persistent visible affordance --
     matching lr-combobox/lr-select's data-invalid styling hook --
     beyond the transient native validation-bubble popup, which only shows
     momentarily around reportValidity()/form submission. */
  :host([data-invalid]) [part~='box'] {
    border-color: var(--lr-checkbox-invalid-border, var(--lr-color-danger));
  }

  [part~='checkmark'] {
    display: block;
    color: var(--checked-icon-color, currentColor);
    transform: scale(var(--checked-icon-scale, 1));
  }

  /* No explicit "display" here (unlike e.g. lr-combobox's
     [part='form-control-label']), so the UA stylesheet's default
     "[hidden] { display: none }" rule needs no author-side override to
     take effect when hasLabelSlot is false. */
  [part='label'] {
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }

  [part~='hint'] {
    margin-block-start: var(--lr-space-xs);
    margin-inline-start: var(--lr-checkbox-label-indent);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part~='hint'][hidden] { display: none; }

  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    margin-inline-start: var(--lr-checkbox-label-indent);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  [part='error'][hidden] { display: none; }

  [part='form-control'],
  [part='label'],
  [part~='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }

  @media (prefers-reduced-motion: reduce) {
    [part~='box'] {
      transition: none !important;
    }
  }
`;
