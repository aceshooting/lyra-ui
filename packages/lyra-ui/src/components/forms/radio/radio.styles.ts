import { css } from 'lit';

export const styles = css`
  :host {
    /* The indicator tracks the shared size ladder (internal/sizes.styles.ts): 70% of the tier's
       control height, so a radio lines up with an lr-input/lr-select/lr-button of the same size
       rather than carrying a scale of its own. At the default "m" tier this resolves to exactly the
       1.75rem the control shipped with before it had a size at all, and the --lr-icon-button-size
       cap is kept so a consumer compacting that theme token still compacts this control with it. */
    --lr-radio-circle-size: min(
      var(--lr-icon-button-size),
      calc(var(--lr-form-control-height) * 0.7)
    );
    /* Capped at half the circle so the dot can never outgrow the ring it sits in, whatever a
       consumer does to either the ladder or the --lr-icon-button-size cap above. Resolves to
       0.75rem at "m", the size the dot shipped with. */
    --lr-radio-dot-size: min(
      calc(var(--lr-radio-circle-size) * 0.5),
      calc(var(--lr-form-control-height) * 0.3)
    );
    /* The corner radius of the control's own chrome. A circular indicator is fully round at every
       setting; the knob exists so <lr-radio-button>'s rectangular chrome -- which inherits this
       class, and with it the pill property -- has one name to override. */
    --lr-radio-radius: var(--lr-radius-pill);
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Published (not an override hook, so it is declared rather than read with an inline
       var() fallback) so a consumer composing their own per-option hint text under the label
       can align it without re-deriving the geometry by reading these shadow styles. Same two
       terms the layout below actually uses: the circle's floor plus the label gap.
       A :host declaration is still overridable from the consumer's own tree -- a document-tree
       rule on the host (lr-radio { --lr-radio-label-indent: ... }) beats any :host rule -- but
       it does NOT reach a *sibling* node in the consumer's tree, because custom properties
       inherit down, not sideways. A consumer aligning a sibling <p> computes the same formula
       themselves from --lr-theme-icon-button-size and --lr-theme-space-s. */
    --lr-radio-label-indent: calc(var(--lr-radio-circle-size) + var(--lr-space-s));
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Derived from the published indent rather than repeating --lr-space-s, so the advertised
       value and the rendered label offset cannot drift: the label always starts exactly
       --lr-radio-label-indent from the base's inline start. Resolves to --lr-space-s by default. */
    gap: calc(var(--lr-radio-label-indent) - var(--lr-radio-circle-size));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* :host(:disabled), not :host([disabled]) -- this is a form-associated
     custom element (static formAssociated = true), so the UA computes its
     disabled state (and therefore :disabled/:enabled matching) the same way
     it does for a native form control: from its own disabled content
     attribute *or* an ancestor <fieldset disabled>'s cascade. Keying this
     off the attribute selector only ever matched the first case -- a radio
     disabled purely via an ancestor fieldset had effectiveDisabled correctly
     gating tabindex/aria-disabled, but the base still rendered at full
     opacity with a normal cursor. */
  :host(:disabled) [part='base'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part~='circle'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    /* A floor, never a hard size -- matching <lr-checkbox>'s [part='box'] exactly. For a
       label-less radio this circle *is* the whole tap target ([part='base'] contributes no box
       of its own), so a hard inline-size/block-size would let the indicator overflow it and
       would size the target below its own content. Same inline icon-affordance convention as
       lr-combobox's clear-button / lr-select's toggle: --lr-icon-button-size capped at the
       tier's own share of the control height. */
    min-inline-size: var(--lr-radio-circle-size);
    min-block-size: var(--lr-radio-circle-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radio-radius);
    background: var(--lr-color-surface);
    transition: border-color var(--lr-transition-fast), background-color var(--lr-transition-fast);
  }
  :host(:not(:disabled)) [part='base']:hover [part~='circle'] {
    border-color: var(--lr-radio-hover-border-color, var(--lr-color-brand));
  }
  /* Pressed. A ring rather than a fill, for the same reason <lr-checkbox>'s [part='box'] takes one:
     the circle's fill IS the state readout (surface unchecked, the dot inside it once checked), so
     tinting it under the thumb would read as a half-selected radio. Visibly more than the hover's
     border-colour step, and the same soft-ring vocabulary <lr-slider>'s thumb uses. */
  :host(:not(:disabled)) [part='base']:active [part~='circle'] {
    border-color: var(--lr-radio-active-border-color, var(--lr-radio-hover-border-color, var(--lr-color-brand)));
    box-shadow: 0 0 0 var(--lr-border-width-medium) var(--lr-radio-active-ring-color, var(--lr-color-brand-quiet));
  }
  [part~='circle'][part~='checked'] {
    /* Component-scoped indirection (mirrors lr-checkbox's identical --lr-checkbox-checked-bg/
       -border pair) so a consumer can retint just this control's checked ring without hijacking
       the shared --lr-color-brand token used across the rest of the library. */
    border-color: var(--lr-radio-checked-border-color, var(--lr-color-brand));
  }
  [part~='dot'] {
    inline-size: var(--lr-radio-dot-size);
    block-size: var(--lr-radio-dot-size);
    border-radius: var(--lr-radius-pill);
    background: var(--checked-icon-color, var(--lr-radio-checked-dot-color, var(--lr-color-brand)));
    transform: scale(var(--checked-icon-scale, 1));
  }
  [part='label'][hidden] {
    display: none;
  }
  [part='label'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    [part~='circle'] { transition: none !important; }
  }
`;
