import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    position: relative;
    display: inline-block;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: var(--lr-size-24rem);
    /* The size ladder itself lives in internal/sizes.styles.ts, which this component composes ahead
       of this sheet. Only the indirection is here: the public --lr-model-select-* surface stays
       exactly as documented, while its VALUES come from the one --lr-form-control-* scale every
       other control in the library sizes against. That keeps a model select the same height as the
       lr-select / lr-input / lr-button next to it in a toolbar row at every tier, and it means the
       shared sheet's per-tier :host([size='...']) rules (which list both spellings of each step)
       are the only place a tier is ever restated. */
    --_lr-model-select-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-form-control-padding-inline);
    --_lr-model-select-trigger-min-height: var(--lr-form-control-height);
    --_lr-model-select-font-size: var(--lr-form-control-font-size);
    --_lr-model-select-expand-size: var(--lr-size-1-75rem);
    --_lr-model-select-gap-default: var(--lr-space-xs);
    --_lr-model-select-radius-default: var(--lr-radius);
  }
  :host(:disabled) {
    cursor: not-allowed;
  }
  /* The decorative expand icon is the one knob the shared ladder has no equivalent for -- it is a
     glyph box, not a control metric -- so its three sizes stay here, listed in both spellings of
     each tier so they track the shared sheet exactly. */
  :host([size="2xs"]),
  :host([size="xs"]) {
    --_lr-model-select-expand-size: var(--lr-size-1rem);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-model-select-expand-size: var(--lr-size-1-25rem);
  }

  [part="form-control-label"] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches here because the part always contains a slot element. Visible-label
     presence is tracked from both the property and named slot, then reflected through hidden. */
  [part="form-control-label"][hidden] {
    display: none;
  }
  /* This control accepts required and renders a visible label like every other field in the
     library, so it marks it the same way -- the [hidden] rule above is what keeps the marker from
     orphaning a stray glyph when no label is set. */
  ${formControlRequiredMarker}

  [part='trigger'],
  [part='combobox'] {
    display: flex;
    align-items: center;
    gap: var(--lr-model-select-gap, var(--_lr-model-select-gap-default));
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(
      --lr-model-select-trigger-min-height,
      var(--_lr-model-select-trigger-min-height)
    );
    box-sizing: border-box;
    padding: var(
      --lr-model-select-trigger-padding,
      var(--_lr-model-select-trigger-padding)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(
      --lr-model-select-radius,
      var(--_lr-model-select-radius-default)
    );
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(
      --lr-model-select-font-size,
      var(--_lr-model-select-font-size)
    );
  }
  [part="trigger"] {
    cursor: pointer;
    text-align: start;
  }
  [part="combobox"] {
    cursor: text;
  }
  [part="trigger"]:focus-visible,
  [part="combobox"]:focus-within {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, keeping this at (0,1,0) --
     matches lr-attachment-trigger's fixed convention, so a consumer's ::part(trigger):hover
     override ((0,1,1)) still wins without needing !important. */
  :where([part="trigger"]):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
  }
  :where([part="trigger"]):active:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  :host([open]) [part="trigger"] {
    border-color: var(
      --lr-model-select-open-border-color,
      var(--lr-color-brand)
    );
  }
  :host(:disabled) [part="trigger"],
  :host(:disabled) [part="combobox"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part="provider-badge"] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-inline-end: var(--lr-space-xs);
    margin-inline-end: var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }

  .trigger-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trigger-label[data-placeholder] {
    color: var(--lr-color-text-quiet);
  }

  [part="combobox-input"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part="combobox-input"]::placeholder {
    color: var(--lr-color-text-quiet);
  }

  [part="expand-icon"] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    min-inline-size: min(
      var(--lr-icon-button-size),
      var(--lr-model-select-expand-size, var(--_lr-model-select-expand-size))
    );
    min-block-size: min(
      var(--lr-icon-button-size),
      var(--lr-model-select-expand-size, var(--_lr-model-select-expand-size))
    );
    line-height: var(--lr-line-height-none);
  }
  [part="expand-icon"] svg {
    transform: rotate(90deg);
  }

  [part="listbox"] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-block-size: var(--lr-size-18rem);
    overflow-y: auto;
    overflow-x: hidden;
    inline-size: max-content;
    min-inline-size: var(--lr-size-12rem);
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-28rem)
    );
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(
      --lr-model-select-radius,
      var(--_lr-model-select-radius-default)
    );
    /* Anchored overlay: a positioner-placed listbox floating over page content, not a modal layer. */
    box-shadow: var(--lr-shadow-m);
    /* Closed state: invisible + slightly raised. visibility (not
       display:none) so opacity/transform can actually transition; hit-testing
       and a11y exposure stay off since this part is already position:fixed. */
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition: opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast), visibility var(--lr-transition-fast);
  }
  :host([open]) [part="listbox"] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="listbox"] {
      transition: none !important;
    }
  }

  [part="option"] {
    display: flex;
    align-items: center;
    gap: var(--lr-model-select-gap, var(--_lr-model-select-gap-default));
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(
      --lr-model-select-radius,
      var(--_lr-model-select-radius-default)
    );
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part="option"]:hover,
  [part="option"][data-active] {
    background: var(
      --lr-model-select-option-active-bg,
      var(--lr-color-brand-quiet)
    );
  }
  /* Mixes the SAME --lr-model-select-option-active-bg the hover/active-descendant rule above uses,
     so a consumer retinting the highlight gets a matching pressed step for free. */
  [part="option"]:active {
    background: color-mix(
      in oklab,
      var(--lr-model-select-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="option"][aria-selected="true"] {
    /* Per-component indirection (inline var() fallbacks to the shared brand tokens, so unset
       rendering is byte-for-byte unchanged) -- so a consumer can retheme just the selected row
       without hijacking --lr-color-brand library-wide. */
    background: var(--lr-model-select-option-selected-bg, transparent);
    border-color: var(
      --lr-model-select-option-selected-border,
      var(--lr-color-brand)
    );
    color: var(--lr-model-select-option-selected-color, var(--lr-color-brand));
    font-weight: var(
      --lr-model-select-option-selected-font-weight,
      var(--lr-font-weight-semibold)
    );
  }
  [part="option-icon"] {
    flex: 0 0 auto;
    line-height: var(--lr-line-height-1-4);
  }
  [part="option-label"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Stale-value row: a previously-saved value that no longer appears in the
     catalog. Marked with a dashed border + italic label (instead of the
     solid border every real row uses) so it visually reads as "remembered,
     not offered" rather than a normal selectable catalog entry. */
  [part="option"][data-synthetic] {
    border-style: var(--lr-model-select-option-synthetic-border-style, dashed);
    border-color: var(
      --lr-model-select-option-synthetic-border-color,
      var(--lr-color-border)
    );
  }
  [part="option"][data-synthetic] [part="option-label"] {
    font-style: italic;
  }
  [part="option-badge"] {
    flex: 0 0 auto;
    font-size: var(--lr-size-0-6875rem);
    font-style: normal;
    font-weight: var(--lr-font-weight-normal);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }

  [part="empty"] {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }

  [part="hint"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches here -- the part always contains a literal slot
     child element regardless of assigned/text content -- so real emptiness
     is tracked in JS (hasHintSlot) and reflected via the hidden attribute
     instead (same fix as lr-select's identical part). */
  [part="hint"][hidden] {
    display: none;
  }
  [part="error"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part="error"][hidden] {
    display: none;
  }
`;
