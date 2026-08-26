import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    /* Geometry from the shared form-control ladder (internal/sizes.styles.ts, loaded by
       select.class.ts ahead of this sheet): one scale for
       lr-button/lr-input/lr-select/lr-combobox/lr-date-input. It matches both tier spellings, so
       size="small" is size="s". */
    --_lr-select-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-form-control-padding-inline);
    --_lr-select-trigger-min-height: var(--lr-form-control-height);
    --_lr-select-font-size: var(--lr-form-control-font-size);
    --_lr-select-expand-size: var(--lr-size-1-75rem);
    /* The trigger's adornment gap deliberately skips the ladder: it does not vary by tier, and the
       ladder's value is tuned for button icon-beside-label spacing, tighter than a field wants. */
    --_lr-select-gap: var(--lr-space-xs);
    --_lr-select-radius: var(--lr-form-control-radius);
    --_lr-select-tag-padding: var(--lr-space-2xs) var(--lr-space-xs);
    --_lr-select-tag-font-size: var(--lr-font-size-sm);
    /* --lr-select-trigger-height is deliberately undeclared: it is read only through the two var()
       fallbacks on [part='trigger'] below, so any declared value (even auto) dead-arms them -- how
       --lr-select-trigger-min-height became dead code. The per-tier floor then falls out of the
       fallback, and any override pins an exact height. */
  }
  /* Only the decorative expand glyph needs per-tier rules -- it sizes an icon box, not the control
     row. Both tier spellings are matched as the ladder does, so size="small" cannot take the s
     tier's padding with the default chevron. */
  :host([size="2xs"]),
  :host([size="xs"]) {
    --_lr-select-expand-size: var(--lr-size-1rem);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-select-expand-size: var(--lr-size-1-25rem);
  }
  [part="form-control-label"] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches (the part always holds a literal slot child), so emptiness is tracked in
     JS via hasLabelSlot and reflected with hidden -- same fix as [part~='hint']/[part='error']
     below and lr-combobox. Without it the required-asterisk ::after renders a stray ' *' when label
     is unset. */
  [part="form-control-label"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}

  /* Pill only retunes the shared radius property, so [part='trigger'] stays the single place a
     radius is read and a consumer's --lr-select-radius override still wins. */
  :host([pill]) {
    --_lr-select-radius: var(--lr-radius-pill);
  }
  :host([filled]) [part="trigger"] {
    background: var(--lr-color-surface-raised);
    border-color: transparent;
  }

  /* Positioning context for [part='clear-button'], a sibling not a child: the trigger is a
     <button>, and a nested button is invalid interactive content no keyboard or AT user could
     reach. display: block leaves the trigger's box, and its size/height contracts, unchanged. */
  .control {
    position: relative;
    display: grid;
  }

  .control > [part="trigger"],
  .control > [part="tags"] {
    grid-area: 1 / 1;
  }

  [part="trigger"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-select-gap, var(--_lr-select-gap));
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(
      --lr-select-trigger-height,
      var(--lr-select-trigger-min-height, var(--_lr-select-trigger-min-height))
    );
    box-sizing: border-box;
    block-size: var(--lr-select-trigger-height, auto);
    padding: var(
      --lr-select-trigger-padding,
      var(--_lr-select-trigger-padding)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-select-radius, var(--_lr-select-radius));
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(--lr-select-font-size, var(--_lr-select-font-size));
    text-align: start;
    cursor: pointer;
  }
  [part="trigger"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* :where() keeps this at (0,1,0), as in lr-model-select/lr-attachment-trigger, so a consumer's
     ::part(trigger):hover ((0,1,1)) still wins without !important. */
  :where([part="trigger"]):hover:where(:not(:disabled)) {
    background: var(--lr-select-trigger-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed: the hover's quiet brand tint carried further toward --lr-color-mix-partner (which
     follows the text colour), so the press reads deeper. Same :where() zeroing as the hover, so
     ::part(trigger):active still wins. */
  :where([part="trigger"]):active:where(:not(:disabled)) {
    background: var(
      --lr-select-trigger-active-bg,
      color-mix(
        in oklab,
        var(--lr-select-trigger-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  /* Appearance treatments. outlined is the base rule above, so the other four restate only what
     changes: same box, border width and radius; only fill, border color and (for accent) text color
     move. */
  :host([appearance="filled"]) [part="trigger"] {
    background: var(--lr-color-surface-raised);
    border-color: transparent;
  }
  :host([appearance="filled-outlined"]) [part="trigger"] {
    background: var(--lr-color-surface-raised);
  }
  :host([appearance="plain"]) [part="trigger"] {
    background: transparent;
    border-color: transparent;
  }
  :host([appearance="accent"]) [part="trigger"] {
    background: var(--lr-color-brand);
    border-color: transparent;
    color: var(--lr-color-on-brand);
  }
  /* The quiet-text tokens below are far too low-contrast on the loud brand fill, so placeholder,
     expand icon and chips ride the on-brand text color. */
  :host([appearance="accent"])
    [part="trigger"]
    .trigger-label[data-placeholder],
  :host([appearance="accent"]) [part="trigger"] [part="expand-icon"],
  :host([appearance="accent"]) [part="trigger"] [part="start"],
  :host([appearance="accent"]) [part="trigger"] [part="end"] {
    color: inherit;
  }
  :host([appearance="accent"]) [part~="tag"] {
    background: color-mix(in srgb, currentColor 20%, transparent);
  }
  /* Every appearance restates the hover feedback: the treatments above out-specify the shared hover
     rule, so otherwise only outlined keeps a pointer affordance. :host([filled]) is listed for the
     same reason, not as a duplicate of :host([appearance='filled']) -- the boolean alias is pure
     CSS (select.class.ts never derives appearance from it) and its (0,3,0) fill rule out-ranks the
     shared (0,1,0) rules. */
  :host([appearance="filled"])
    :where([part="trigger"]):hover:where(:not(:disabled)),
  :host([appearance="filled-outlined"])
    :where([part="trigger"]):hover:where(:not(:disabled)),
  :host([filled]) :where([part="trigger"]):hover:where(:not(:disabled)),
  :host([appearance="plain"])
    :where([part="trigger"]):hover:where(:not(:disabled)) {
    background: var(--lr-select-trigger-hover-bg, var(--lr-color-brand-quiet));
  }
  :host([appearance="filled"])
    :where([part="trigger"]):active:where(:not(:disabled)),
  :host([appearance="filled-outlined"])
    :where([part="trigger"]):active:where(:not(:disabled)),
  :host([filled]) :where([part="trigger"]):active:where(:not(:disabled)),
  :host([appearance="plain"])
    :where([part="trigger"]):active:where(:not(:disabled)) {
    background: var(
      --lr-select-trigger-active-bg,
      color-mix(
        in oklab,
        var(--lr-select-trigger-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  /* The loud fill has no quieter tint to move to, so it shifts toward --lr-color-mix-partner, which
     follows the text colour -- darker in light, lighter in dark, always away from the fill. Same
     two shares as every other hovered/pressed surface, not the hand-written 12% this pair carried
     before 8.0.0. */
  :host([appearance="accent"])
    :where([part="trigger"]):hover:where(:not(:disabled)) {
    background: var(
      --lr-select-trigger-hover-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand),
        var(--lr-color-mix-partner) var(--lr-color-mix-hover)
      )
    );
  }
  :host([appearance="accent"])
    :where([part="trigger"]):active:where(:not(:disabled)) {
    background: var(
      --lr-select-trigger-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  :host([open]) [part="trigger"] {
    border-color: var(--lr-select-open-border-color, var(--lr-color-brand));
  }
  :host(:disabled) [part="trigger"] {
    /* Shared library-wide disabled-state token -- see lr-combobox. */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  /* Same start/end adornment wrapper convention as lr-combobox/lr-date-input --
     hidden (both the attribute and display:none) while nothing is slotted. */
  [part="start"],
  [part="end"] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    color: var(--lr-color-text-quiet);
    pointer-events: none;
  }
  [part="start"][hidden],
  [part="end"][hidden] {
    display: none;
  }

  .trigger-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Placeholder text (no value selected yet) renders quieter, matching a
     native <select>'s empty-option / combobox's placeholder styling. */
  .trigger-label[data-placeholder] {
    color: var(--lr-color-text-quiet);
  }
  /* In multiple mode the real focusable tags are a sibling layered over the trigger; the shared
     sr-only rule keeps this joined value available to assistive technology without painting a
     duplicate under the chips. */

  /* Multi-select chip row. Wraps rather than scrolls, so a long selection grows the trigger's
     block size instead of hiding chips behind an invisible scroll axis. */
  [part="tags"] {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }
  .control > [part="tags"] {
    z-index: var(--lr-layer-content);
    align-self: center;
    margin-inline-start: var(--lr-form-control-padding-inline);
    margin-inline-end: calc(
      var(--lr-select-expand-size, var(--_lr-select-expand-size)) +
        var(--lr-form-control-padding-inline)
    );
    padding-block: var(--lr-form-control-padding-block);
    pointer-events: none;
  }
  /* [part~=] because the overflow chip carries two names ('tag tag-overflow'); state lives in the
     part name because a state selector after ::part() never matches. */
  [part~="tag"] {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    max-inline-size: min(100%, var(--tag-max-size, var(--lr-size-12rem)));
    padding: var(--lr-select-tag-padding, var(--_lr-select-tag-padding));
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface-raised);
    font-size: var(--lr-select-tag-font-size, var(--_lr-select-tag-font-size));
    line-height: var(--lr-line-height-none);
    pointer-events: auto;
  }
  [part="tag-label"] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part~="tag-overflow"] {
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }

  [part~="tag__remove-button"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin-block: calc(var(--lr-space-2xs) * -1);
    margin-inline-end: calc(var(--lr-space-xs) * -1);
    padding: var(--lr-space-2xs);
    border: none;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  [part~="tag__remove-button"]:hover {
    color: var(--lr-color-text);
    background: var(--lr-color-brand-quiet);
  }
  [part~="tag__remove-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part~="tag__remove-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~="tag__remove-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  /* Sits in the trigger's reserved inline-end band (see .control[data-clearable] below), outboard
     of the expand icon: the trigger is a <button>, so the clear action is overlaid from the
     wrapper. Padding reserves the band rather than overlapping, keeping the trigger's content
     clear. */
  [part="clear-button"] {
    position: absolute;
    z-index: var(--lr-layer-content);
    inset-inline-end: 0;
    inset-block-start: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    /* A real, independently-focusable control, so it takes the full shared icon-button hit-area
       floor rather than the capped decorative box [part='expand-icon'] uses. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-2xs);
    border: none;
    border-radius: var(--lr-select-radius, var(--_lr-select-radius));
    background: none;
    color: var(--lr-color-text-quiet);
    line-height: var(--lr-line-height-none);
    cursor: pointer;
  }
  .control[data-clearable] [part="trigger"] {
    padding-inline-end: var(--lr-icon-button-size);
  }
  /* Mirrors <lr-combobox>'s own [part='clear-button']:hover -- the same quiet-to-full text token
     step, so mouse users get the feedback keyboard users get from the focus ring below. */
  [part="clear-button"]:hover {
    color: var(--lr-color-text);
  }
  /* Pressed: the hover's quiet-to-full text step plus a fill, mixing the page surface toward
     --lr-color-mix-partner at the stronger active share -- mirrors <lr-input>'s
     clear-button/password-toggle. The button carries --lr-select-radius, so the fill lands as a
     rounded chip. */
  [part="clear-button"]:active {
    color: var(--lr-color-text);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="clear-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="clear-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part="expand-icon"] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    /* Same real-touch-target reasoning as lr-combobox's expand-icon. */
    min-inline-size: min(
      var(--lr-icon-button-size),
      var(--lr-select-expand-size, var(--_lr-select-expand-size))
    );
    min-block-size: min(
      var(--lr-icon-button-size),
      var(--lr-select-expand-size, var(--_lr-select-expand-size))
    );
    line-height: var(--lr-line-height-none);
  }
  [part="expand-icon"] svg {
    transform: rotate(90deg);
  }

  [part="listbox"] {
    position: absolute;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-dropdown));
    box-sizing: border-box;
    max-block-size: var(--lr-size-18rem);
    /* Per the CSS overflow spec, pinning one axis to a non-'visible' value forces the other to
       'auto', and an implicit overflow-x: auto risks a phantom horizontal scrollbar from sub-pixel
       rounding on a vertical-only listbox. Pin it explicitly -- same fix as lr-tab-group' tablist,
       opposite axis. */
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
  :host([hoist]) [part="listbox"] {
    position: fixed;
  }
  :host([open]) [part="listbox"] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
    transition: opacity var(--show-duration, var(--lr-transition-fast)),
      transform var(--show-duration, var(--lr-transition-fast)),
      visibility var(--show-duration, var(--lr-transition-fast));
  }
  /* A disabled form control cannot retain even the outgoing visibility frame of an ordinary
     close transition: fieldset-cascaded disablement uses :disabled too, unlike [disabled]. */
  :host(:disabled) [part="listbox"] {
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transition: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="listbox"] {
      transition: none !important;
    }
  }

  [part="option"] {
    display: flex;
    flex-direction: row;
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
       unchanged), like the active-bg indirection below and lr-segmented's/lr-tab-group'
       selected-state tokens, so the selected row is rethemeable without hijacking --lr-color-brand.
       */
    background: var(--lr-select-option-selected-bg, transparent);
    border-color: var(
      --lr-select-option-selected-border,
      var(--lr-color-brand)
    );
    color: var(--lr-select-option-selected-color, var(--lr-color-brand));
    font-weight: var(
      --lr-select-option-selected-font-weight,
      var(--lr-font-weight-semibold)
    );
  }
  /* Must stay AFTER the [aria-selected='true'] rule above: all four are (0,2,0) on the same row, so
     source order alone decides the background. Reversed, the selected rule's
     --lr-select-option-selected-bg (transparent by default) swallowed hover, press and
     [data-active] -- the aria-activedescendant highlight -- so an arrow-keyed selected option
     showed nothing. The selected row keeps its affordance either way: that rule paints
     border-color/color/font-weight. */
  [part="option"]:where(:not([aria-disabled="true"])):hover,
  [part="option"][data-active] {
    /* Per-component indirection with a var() fallback to the shared brand-quiet token -- as in
       lr-command-palette/lr-notebook-viewer -- so this row state is rethemeable without hijacking
       --lr-color-brand-quiet. */
    background: var(--lr-select-option-active-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed row. Pointer-down commits the selection and closes the listbox, so this is the last
     frame the user sees and has to read deeper than the hover it replaces. Mixes the same row tint
     (consumer override included) toward --lr-color-mix-partner. */
  [part="option"]:where(:not([aria-disabled="true"])):active {
    background: color-mix(
      in oklab,
      var(--lr-select-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="option"][aria-disabled="true"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="option-dot"] {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: 50%;
    flex: 0 0 auto;
  }
  [part="option-label"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part="option-sub"] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  [part="form-control"],
  [part="form-control-label"],
  [part~="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }

  [part="option"] {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part="option-label"] {
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }

  [part="option-sub"],
  .group-label {
    overflow-wrap: anywhere;
  }

  .group-label {
    padding: var(--lr-space-xs) var(--lr-space-s) 0;
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
  [part~="hint"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches here either -- same fix as lr-combobox's hint/error. */
  [part~="hint"][hidden] {
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
