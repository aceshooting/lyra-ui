import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* Published (not an override hook, so it is declared rather than read with an inline
       var() fallback) so a consumer composing their own per-option hint text under the label
       can align it without re-deriving the geometry by reading these shadow styles. Same two
       terms the layout below actually uses: the circle's floor plus the label gap.
       A :host declaration is still overridable from the consumer's own tree -- a document-tree
       rule on the host (lr-radio { --lr-radio-label-indent: ... }) beats any :host rule -- but
       it does NOT reach a *sibling* node in the consumer's tree, because custom properties
       inherit down, not sideways. A consumer aligning a sibling <p> computes the same formula
       themselves from --lr-theme-icon-button-size and --lr-theme-space-s. */
    --lr-radio-label-indent: calc(
      min(var(--lr-icon-button-size), var(--lr-size-1-75rem)) + var(--lr-space-s)
    );
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    /* Derived from the published indent rather than repeating --lr-space-s, so the advertised
       value and the rendered label offset cannot drift: the label always starts exactly
       --lr-radio-label-indent from the base's inline start. Resolves to --lr-space-s by default. */
    gap: calc(
      var(--lr-radio-label-indent) - min(var(--lr-icon-button-size), var(--lr-size-1-75rem))
    );
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
  [part='circle'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    /* A floor, never a hard size -- matching <lr-checkbox>'s [part='box'] exactly. For a
       label-less radio this circle *is* the whole tap target ([part='base'] contributes no box
       of its own), so a hard inline-size/block-size would let the indicator overflow it and
       would size the target below its own content. Same inline icon-affordance convention as
       lr-combobox's clear-button / lr-select's toggle: --lr-icon-button-size capped at 1.75rem. */
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    transition: border-color var(--lr-transition-fast), background-color var(--lr-transition-fast);
  }
  :host(:not(:disabled)) [part='base']:hover [part='circle'] {
    border-color: var(--lr-color-brand);
  }
  :host([checked]) [part='circle'] {
    border-color: var(--lr-color-brand);
  }
  [part='dot'] {
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-brand);
  }
  [part='label'][hidden] {
    display: none;
  }
  [part='label'] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='circle'] { transition: none !important; }
  }
`;
