import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    --_lr-token-input-min-input-inline-size: var(--lr-size-4rem);
    /* Two-value shorthand, block axis first: inline half is this component's denser ladder
       (per-tier blocks below), block half the shared form-control ladder so it cannot outgrow the
       height floor beside it -- see the [part='input-wrapper'] comment. */
    --_lr-token-input-padding: var(--lr-form-control-padding-block)
      var(--lr-space-xs);
    --_lr-token-input-font-size: var(--lr-font-size-md-sm);
    --_lr-token-input-token-padding: var(--lr-space-2xs) var(--lr-space-xs);
    --_lr-token-input-gap: var(--lr-space-xs);
    --_lr-token-input-token-gap: var(--lr-space-2xs);
    --_lr-token-input-radius: var(--lr-radius);
    /* The row's height floor is the one shared form-control ladder (internal/sizes.styles.ts), so
       --lr-theme-form-control-height-* retunes this control and every sibling field together; it
       matches both tier spellings, so size="small" needs no alias rule. */
    --_lr-token-input-control-min-height: var(--lr-form-control-height);
    /* --lr-token-input-control-height is deliberately not declared here, as in
       lr-input/lr-select/lr-combobox: an exact-height escape hatch read only through the var()
       fallback on [part='input-wrapper'] below. */
  }
  :host([pill]) {
    --_lr-token-input-radius: var(--lr-radius-pill);
  }
  /* Inline padding, text size and chip padding stay this component's denser ladder: m runs 0.25rem
     and --lr-font-size-md-sm against the shared ladder's 0.75rem and --lr-font-size-m. The block
     half stays --lr-form-control-padding-block at every tier -- that axis pays for the height floor
     (see [part='input-wrapper']). Both tier spellings match, since the height ladder accepts
     size="small". */
  :host([size="2xs"]) {
    --_lr-token-input-padding: var(--lr-form-control-padding-block)
      var(--lr-size-0-0625rem);
    --_lr-token-input-font-size: var(--lr-font-size-2xs);
    --_lr-token-input-token-padding: 0 var(--lr-space-2xs);
  }
  :host([size="xs"]) {
    --_lr-token-input-padding: var(--lr-form-control-padding-block)
      var(--lr-size-0-125rem);
    --_lr-token-input-font-size: var(--lr-font-size-xs);
    --_lr-token-input-token-padding: var(--lr-size-1px) var(--lr-space-2xs);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-token-input-padding: var(--lr-form-control-padding-block)
      var(--lr-space-xs);
    --_lr-token-input-font-size: var(--lr-font-size-sm);
    --_lr-token-input-token-padding: var(--lr-space-2xs) var(--lr-space-xs);
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-token-input-padding: var(--lr-form-control-padding-block)
      var(--lr-space-m);
    --_lr-token-input-font-size: var(--lr-font-size-lg);
    --_lr-token-input-token-padding: var(--lr-space-xs) var(--lr-space-s);
  }
  :host([size="xl"]) {
    --_lr-token-input-padding: var(--lr-form-control-padding-block)
      var(--lr-space-l);
    --_lr-token-input-font-size: var(--lr-font-size-xl);
    --_lr-token-input-token-padding: var(--lr-space-s) var(--lr-space-m);
  }
  [part="form-control"] {
    display: grid;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-token-input-gap, var(--_lr-token-input-gap));
  }
  [part="form-control-label"] {
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* The required marker comes from the one shared sheet (internal/form-control.styles.ts), keeping
     its glyph, colour and spacing consumer-settable. The rule below hides the older hand-rolled
     glyph, a literal <span> the label template still renders, so the two never double up; dead
     once that span goes. */
  :host([required]) [part="form-control-label"] > span[aria-hidden="true"] {
    display: none;
  }
  ${formControlRequiredMarker}
  /* min-block-size is a FLOOR on a border-box, so it sets the height only while content stays
     under it -- and the content is the draft input, whose line-height: normal box is an
     ambient-font metric varying by machine. Hence shared-ladder block padding, not the denser
     inline one: with it and the zeroed input padding below, content is <= lr-input's at every tier
     (per-tier font-size never exceeds the ladder's), so this row's floor wins wherever lr-input's
     does and the two align in a toolbar. Widen past the ladder and the font decides the height. */
  [part='input-wrapper'] {
    display: flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    align-items: center;
    gap: var(--lr-token-input-gap, var(--_lr-token-input-gap));
    min-block-size: var(
      --lr-token-input-control-height,
      var(
        --lr-token-input-control-min-height,
        var(--_lr-token-input-control-min-height)
      )
    );
    block-size: var(--lr-token-input-control-height, auto);
    padding: var(--lr-token-input-padding, var(--_lr-token-input-padding));
    font-size: var(
      --lr-token-input-font-size,
      var(--_lr-token-input-font-size)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-token-input-radius, var(--_lr-token-input-radius));
    background: var(--lr-color-surface);
  }
  [part="input-wrapper"]:focus-within {
    border-color: var(
      --lr-token-input-focus-border-color,
      var(--lr-color-brand)
    );
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* padding-block: 0 replaces the UA's 1px default, as lr-input does on its [part='input']: the
     wrapper above owns this row's block padding, and the UA's spent two more pixels of the floor's
     budget per tier, pushing the dense tiers over their floor and handing the height to the
     font. */
  [part="input"] {
    flex: 1 1 var(--lr-token-input-input-inline-size, var(--lr-size-8rem));
    min-inline-size: var(
      --lr-token-input-min-input-inline-size,
      var(--_lr-token-input-min-input-inline-size)
    );
    padding-block: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
  }
  [part="input"]::placeholder {
    color: var(--lr-color-text-quiet);
  }
  /* Mirrors lr-combobox's [part='start']/[part='end'] wrappers: the span is always present so JS
     can toggle hidden -- and an author display rule beats the UA's [hidden] rule at any
     specificity, so declaring display here makes the override below required. */
  [part="start"],
  [part="end"] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    color: var(--lr-color-text-quiet);
  }
  [part="start"][hidden],
  [part="end"][hidden] {
    display: none;
  }
  [part="token"] {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    align-items: center;
    gap: var(--lr-token-input-token-gap, var(--_lr-token-input-token-gap));
    padding: var(
      --lr-token-input-token-padding,
      var(--_lr-token-input-token-padding)
    );
    border-radius: var(--lr-token-input-radius, var(--_lr-token-input-radius));
    background: var(--lr-token-input-token-bg, var(--lr-color-brand-quiet));
    color: var(--lr-color-text);
  }
  [part="token"] > span:first-child {
    min-inline-size: 0;
  }
  /* Same reachability rule as lr-combobox's [part='tag-label']: the ellipsis needs a
     non-wrapping line to fire, and overflow-wrap: anywhere would break the token mid-word. */
  [part="token"] > span:first-child,
  [part="token-label"] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The hit target takes the shared --lr-icon-button-size floor, as lr-swatch-picker's
     [part='swatch'] does, while closeIcon() stays at 1em and is only flex-centered inside it, so
     the dense token row keeps its compact glyph. */
  [part="remove"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  [part="remove"]:hover {
    background: var(
      --lr-token-input-remove-hover-bg,
      var(--lr-token-input-action-hover-bg, var(--lr-color-brand-quiet))
    );
  }
  [part="remove"]:active {
    background: var(
      --lr-token-input-remove-pressed-bg,
      color-mix(
        in oklab,
        var(
          --lr-token-input-remove-hover-bg,
          var(--lr-token-input-action-hover-bg, var(--lr-color-brand-quiet))
        ),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="remove"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Only rendered while [editable] is set, so a non-editable token row keeps its plain,
     non-focusable text span and its current metrics. */
  [part="token-label"] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border-radius: var(--lr-token-input-radius, var(--_lr-token-input-radius));
    cursor: pointer;
  }
  :host(:where(:not(:disabled))) [part="token-label"]:hover {
    background: var(
      --lr-token-input-edit-hover-bg,
      var(--lr-token-input-action-hover-bg, var(--lr-color-brand-quiet))
    );
  }
  :host(:where(:not(:disabled))) [part="token-label"]:active {
    background: var(
      --lr-token-input-edit-pressed-bg,
      color-mix(
        in oklab,
        var(
          --lr-token-input-edit-hover-bg,
          var(--lr-token-input-action-hover-bg, var(--lr-color-brand-quiet))
        ),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="token-label"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host(:disabled) [part="token-label"] {
    cursor: default;
  }
  [part="token-editor"] {
    inline-size: var(--lr-token-input-editor-inline-size, var(--lr-size-6rem));
    max-inline-size: 100%;
    border: 0;
    outline: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  [part="token-editor"]::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part="hint"],
  [part="error"] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part="error"] {
    color: var(--lr-color-danger);
  }
  :host([data-invalid]) [part="input-wrapper"] {
    border-color: var(
      --lr-token-input-invalid-border-color,
      var(--lr-color-danger)
    );
  }
  /* :host(:disabled), not :host([disabled]) -- only the pseudo-class matches an ancestor
     <fieldset disabled> cascade (see effectiveDisabled in token-input.class.ts), which the
     attribute selector misses. Mirrors lr-select/lr-combobox. */
  :host(:disabled) {
    opacity: var(--lr-opacity-disabled);
  }
  [part="form-control-label"],
  [part="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
