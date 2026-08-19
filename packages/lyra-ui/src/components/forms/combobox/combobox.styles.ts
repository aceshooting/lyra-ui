import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    /* Two-value shorthand, block axis first. Only the INLINE half is this component's own per-tier
       geometry; the BLOCK half is the shared ladder's --lr-form-control-padding-block at every
       tier, since that axis pays for the trigger's height floor -- see the [part='combobox']
       comment below. */
    --_lr-combobox-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-space-s);
    /* Height and text size come from the one shared form-control ladder (internal/sizes.styles.ts)
       rather than a sixth private copy. The ladder matches both spellings of every tier, so
       size="small" and size="s" resolve identically with no per-component alias rules. */
    --_lr-combobox-trigger-min-height: var(--lr-form-control-height);
    --_lr-combobox-font-size: var(--lr-form-control-font-size);
    --_lr-combobox-tag-padding: var(--lr-size-0-1rem) var(--lr-size-0-4rem);
    --_lr-combobox-tag-font-size: var(--lr-font-size-sm);
    --_lr-combobox-expand-size: var(--lr-size-1-75rem);
    /* Gap and radius do not vary by size tier, so each is declared once here rather than per
       :host([size='...']) block -- mirrors lr-button's --lr-button-gap/--lr-button-radius. */
    --_lr-combobox-gap: var(--lr-space-xs);
    --_lr-combobox-radius: var(--lr-form-control-radius);
    /* Fill/border pair swapped per appearance below, as
       lr-input/lr-textarea/lr-otp-input/lr-time-input do -- a property re-pointed on :host, never a
       :host([appearance='...']) [part='combobox'] rule. That form is (0,3,0), out-ranking every
       [part='combobox'] state rule ([part='combobox']:focus-within is (0,2,0)), so
       appearance="filled" reinstated its transparent border over the focus rule's brand one,
       leaving no visible focus indicator (WCAG 2.4.7; the focus rule's only outline is the
       forced-colors 'solid transparent' hook, and [part='combobox-input'] carries outline: none).
       Re-pointing a property cannot regress that way -- no [part] rule out-ranks another. */
    --_lr-combobox-fill: var(--lr-color-surface);
    --_lr-combobox-border-color: var(--lr-color-border);
    /* --lr-combobox-trigger-height is deliberately undeclared: read only through the two var()
       fallbacks on [part='combobox'] below, so any declared value (even 'auto') dead-arms them and
       makes --lr-combobox-trigger-min-height dead code. The per-tier floor then falls out of the
       fallback, and any override pins an exact height. */
  }
  :host([pill]) {
    --_lr-combobox-radius: var(--lr-radius-pill);
  }
  :host([appearance="filled"]) {
    --_lr-combobox-fill: var(--lr-color-surface-raised);
    --_lr-combobox-border-color: transparent;
  }
  :host([appearance="filled-outlined"]) {
    --_lr-combobox-fill: var(--lr-color-surface-raised);
  }
  /* What remains per tier is this component's own geometry -- the selected-tag chip and the
     decorative expand glyph -- not a form-control height/text ladder, so not part of the shared
     one. Each tier matches both spellings because the shared ladder accepts size="small", and tags
     silently ignoring it would be worse than never accepting it. */
  :host([size="2xs"]) {
    --_lr-combobox-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-space-2xs);
    --_lr-combobox-tag-padding: 0 var(--lr-size-0-25rem);
    --_lr-combobox-tag-font-size: var(--lr-font-size-2xs);
    --_lr-combobox-expand-size: var(--lr-size-1rem);
  }
  :host([size="xs"]) {
    --_lr-combobox-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-space-xs);
    --_lr-combobox-tag-padding: 0 var(--lr-size-0-25rem);
    --_lr-combobox-tag-font-size: var(--lr-font-size-2xs);
    --_lr-combobox-expand-size: var(--lr-size-1rem);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-combobox-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-space-xs);
    --_lr-combobox-tag-padding: var(--lr-size-0-05rem) var(--lr-size-0-3125rem);
    --_lr-combobox-tag-font-size: var(--lr-font-size-xs);
    --_lr-combobox-expand-size: var(--lr-size-1-25rem);
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-combobox-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-space-m);
    --_lr-combobox-tag-padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    --_lr-combobox-tag-font-size: var(--lr-font-size-md-sm);
  }
  :host([size="xl"]) {
    --_lr-combobox-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-space-l);
    --_lr-combobox-tag-padding: var(--lr-size-0-25rem) var(--lr-size-0-625rem);
    --_lr-combobox-tag-font-size: var(--lr-font-size-m);
  }
  [part="form-control-label"] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches (the part always holds a literal slot child), so emptiness is tracked by
     SlotPresenceController and reflected with hidden -- same fix as [part='hint']/[part='error']
     below. Without it the required-asterisk ::after renders a stray ' *' when label is unset. */
  [part="form-control-label"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}

  /* min-block-size is a border-box floor, so it sets the height only while the row's content stays
     under it -- and that content includes the search input, whose line-height: normal follows
     whatever font the ambient stack resolves; system-ui differs per machine, so any tier reaching
     the floor renders differently on each. Keeping block padding on the shared ladder and zeroing
     the input's UA block padding below holds content under the floor at every tier, which is what
     lines this trigger up with lr-input/lr-select/lr-button in a toolbar row -- the promise
     sizes.styles.ts makes. */
  [part='combobox'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-combobox-gap, var(--_lr-combobox-gap));
    inline-size: 100%;
    min-block-size: var(
      --lr-combobox-trigger-height,
      var(
        --lr-combobox-trigger-min-height,
        var(--_lr-combobox-trigger-min-height)
      )
    );
    box-sizing: border-box;
    /* Pinned only when --lr-combobox-trigger-height is set; 'auto' otherwise, so the row grows to
       fit its content (and a wrapping tag row in multiple mode). */
    block-size: var(--lr-combobox-trigger-height, auto);
    padding: var(
      --lr-combobox-trigger-padding,
      var(--_lr-combobox-trigger-padding)
    );
    border: var(--lr-border-width-thin) solid var(--_lr-combobox-border-color);
    border-radius: var(--lr-combobox-radius, var(--_lr-combobox-radius));
    background: var(--_lr-combobox-fill);
    font-size: var(--lr-combobox-font-size, var(--_lr-combobox-font-size));
    cursor: text;
  }
  [part="combobox"]:focus-within {
    border-color: var(--lr-color-brand);
    outline: var(--lr-border-width-medium) solid transparent;
  }
  :host(:disabled) [part="combobox"] {
    /* Shared library-wide disabled-state token; still 0.5 by fallback, so no visual change here. */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part="start"],
  [part="end"] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    color: var(--lr-color-text-quiet);
  }

  .control-contents {
    display: contents;
  }
  [part="start"][hidden],
  [part="end"][hidden] {
    display: none;
  }

  [part="tags"] {
    display: contents;
  }
  [part="tag"] {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: min(100%, var(--tag-max-size, var(--lr-size-5rem)));
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-combobox-tag-padding, var(--_lr-combobox-tag-padding));
    font-size: var(
      --lr-combobox-tag-font-size,
      var(--_lr-combobox-tag-font-size)
    );
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-text);
    border-radius: var(--lr-radius);
  }
  /* text-overflow only fires on inline overflow, so a label left at white-space: normal wraps
     instead of overflowing and the ellipsis is unreachable -- with overflow-wrap: anywhere the wrap
     also lands mid-word. Matches lr-select's [part='tag-label'], which has always had this. */
  [part="tag-label"] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Same compact-chip-remove pattern as lr-chip's [part='remove-button']: the hit target meets the
     --lr-icon-button-size floor while the visible glyph stays a compact 1rem close icon (font-size:
     var(--lr-font-size-m), independent of --lr-combobox-tag-font-size, which shrinks below that at
     size="xs"/"s") -- a small inline pill grown to 40px would balloon the tags row. The negative
     margin pulls the enlarged hit area back into the tag's own padding, leaving the visible
     footprint and the row's layout box unchanged. */
  [part="tag__remove-button"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin: calc((var(--lr-icon-button-size) - var(--lr-size-1rem)) / -2);
    border: none;
    background: none;
    cursor: pointer;
    color: inherit;
    padding: 0;
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-font-size-m);
  }

  [part="combobox-input"] {
    flex: 1 1 var(--lr-size-6ch);
    min-inline-size: var(--lr-size-4ch);
    /* 0, not the UA's 1px default -- the same neutralisation lr-input applies to its
       [part='input']. The trigger row already owns this control's block padding; leaving the UA's
       on too spent two more pixels of the floor's budget at every tier, which pushed the dense
       tiers over their floor and handed the rendered height to the ambient font. */
    padding-block: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part="combobox-input"]::placeholder {
    color: var(--lr-color-text-quiet);
  }

  /* no-hover-state: [part='expand-icon'] is a decorative aria-hidden dropdown indicator -- the
     whole [part='combobox'] row opens the listbox, so the glyph owes no pointer feedback.
     [part='clear-button'] shares this rule but is a real button with its own :hover further down.
     */
  [part="clear-button"],
  [part="expand-icon"] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    line-height: var(--lr-line-height-none);
  }
  /* Keeps its compact box rather than the interactive floor below: a decorative indicator nobody
     taps directly should not push every tier's trigger row taller. The row itself opens the listbox
     via onComboMouseDown. */
  [part="expand-icon"] {
    box-sizing: border-box;
    min-inline-size: min(
      var(--lr-icon-button-size),
      var(--lr-combobox-expand-size, var(--_lr-combobox-expand-size))
    );
    min-block-size: min(
      var(--lr-icon-button-size),
      var(--lr-combobox-expand-size, var(--_lr-combobox-expand-size))
    );
    padding: 0;
  }
  /* Unlike [part='expand-icon'], [part='clear-button'] is a real focusable <button>
     (combobox.class.ts's @click), so it takes the full shared icon-button hit-area floor instead of
     the capped box above. */
  [part="clear-button"] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part="expand-icon"] svg {
    transform: rotate(90deg);
  }
  /* Mirrors <lr-input>'s [part='clear-button']:hover -- the same quiet-to-full text token step, so
     mouse users get the feedback keyboard users get from the focus ring below. */
  [part="clear-button"]:hover {
    color: var(--lr-color-text);
  }
  /* Pressed adds what hover cannot: hover already spent the colour step (quiet -> full text), so
     the press is a background pad mixed off the row's own surface, stronger by construction since
     --lr-color-mix-active is the larger of the two shared knobs. */
  [part="clear-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    border-radius: var(--lr-radius);
  }
  /* Mirrors <lr-chip>'s [part='remove-button']:hover -- a currentColor-derived tint rather than a
     fixed token, since this part's rest color is 'inherit' (the tag's text color), not a quiet
     token to darken. */
  [part="tag__remove-button"]:hover {
    background: color-mix(in srgb, currentColor 16%, transparent);
  }
  /* Same currentColor idiom as the hover above, taken to the shared pressed strength -- 22% against
     the hover's 16%. */
  [part="tag__remove-button"]:active {
    background: color-mix(
      in srgb,
      currentColor var(--lr-color-mix-active),
      transparent
    );
  }
  [part="clear-button"]:focus-visible,
  [part="tag__remove-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part="listbox"] {
    position: fixed;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-dropdown));
    box-sizing: border-box;
    /* --lr-combobox-visible-block-size is published by the visibleOptions property and falls back
       to the original 18rem ceiling, so an unset cap resolves to exactly the previous expression. */
    max-block-size: min(
      var(--lr-combobox-visible-block-size, var(--lr-size-18rem)),
      var(--lr-positioner-available-block-size, var(--lr-size-18rem))
    );
    overflow-y: auto;
    overflow-x: hidden;
    inline-size: max-content;
    min-inline-size: min(
      var(--lr-size-12rem),
      var(--lr-positioner-available-inline-size, var(--lr-size-12rem))
    );
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-28rem),
      var(--lr-positioner-available-inline-size, 100vw)
    );
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Anchored overlay: a positioner-placed listbox floating over page content, not a modal layer. */
    box-shadow: var(--lr-shadow-m);
    /* Closed state: invisible and slightly raised. visibility rather than display:none so
       opacity/transform can transition; the part is already position:fixed, so hit-testing and a11y
       exposure stay off. */
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition: opacity var(--hide-duration, var(--lr-transition-fast)),
      transform var(--hide-duration, var(--lr-transition-fast)),
      visibility var(--hide-duration, var(--lr-transition-fast));
  }
  [part="option"],
  .group-label,
  .loading,
  .empty,
  .source-error {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  :host([open]) [part="listbox"] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
    transition-duration: var(--show-duration, var(--lr-transition-fast));
  }
  @media (prefers-reduced-motion: reduce) {
    [part="listbox"] {
      transition: none !important;
    }
  }

  [part="option"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part="option"][aria-selected="true"] {
    /* Per-component indirection (var() fallbacks to the shared brand tokens leave unset rendering
       unchanged), so a consumer can retheme just the selected row without hijacking
       --lr-color-brand library-wide. */
    background: var(--lr-combobox-option-selected-bg, transparent);
    border-color: var(
      --lr-combobox-option-selected-border,
      var(--lr-color-brand)
    );
    color: var(--lr-combobox-option-selected-color, var(--lr-color-brand));
    font-weight: var(
      --lr-combobox-option-selected-font-weight,
      var(--lr-font-weight-semibold)
    );
  }
  /* Must stay AFTER the [aria-selected='true'] rule above: all four are (0,2,0) on the same row, so
     source order alone decides the background. Reversed, the selected rule's
     --lr-combobox-option-selected-bg (transparent by default) swallowed hover, press and
     [data-active] -- the aria-activedescendant highlight -- so an arrow-keyed selected option
     showed nothing. The selected row keeps its affordance either way: that rule paints
     border-color/color/font-weight. */
  [part="option"]:hover,
  [part="option"][data-active] {
    background: var(
      --lr-combobox-option-active-bg,
      var(--lr-color-brand-quiet)
    );
  }
  /* Mixing the hover tint itself, not the bare token, keeps a consumer who retinted
     --lr-combobox-option-active-bg in charge of both states: the pressed row is always their
     colour, one shared step further toward the text colour. */
  [part="option"]:active {
    background: color-mix(
      in oklab,
      var(--lr-combobox-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="option"][aria-disabled="true"] {
    /* Unified with the library's single disabled-state opacity token; deliberately changes the old
       literal 0.4 to 0.5. */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="option-dot"] {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: 50%;
    flex: 0 0 auto;
  }
  [part="option-icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
  }
  [part="option-start"],
  [part="option-end"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Content-sized, never shrinking the label away, and bounded so one oversized adornment cannot
       take the row -- the same shape lr-button's own adornments settled on. */
    flex: 0 0 auto;
    max-inline-size: 40%;
    overflow: hidden;
  }
  [part="option-label"] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part="option-sub"] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part="option-badge"] {
    flex: 0 0 auto;
    padding: 0 var(--lr-space-xs);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-brand-quiet);
    /* Full-strength text, not the quiet tone: quiet-on-quiet measured 4.25:1, under WCAG 1.4.3's
       4.5:1. The badge already reads as secondary from its size and tinted pill, so the muted text
       colour on top was double de-emphasis. */
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
  }
  [part="option-overflow"],
  .loading {
    padding: var(--lr-space-s) var(--lr-space-m);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }

  .group-label {
    padding: var(--lr-space-xs) var(--lr-space-s) 0;
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
  .empty {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  [part="hint"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches (the part always holds a literal slot child), so emptiness is tracked by
     SlotPresenceController and reflected with hidden -- same fix as lr-stat's icon/caption. */
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
  [part="form-control"],
  [part="form-control-label"],
  [part="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
