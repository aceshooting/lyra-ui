import { css } from "lit";
import { formControlRequiredMarker } from "../../../internal/form-control.styles.js";

export const styles = css`
  :host {
    display: block;
    /* Geometry from the shared form-control ladder (internal/sizes.styles.ts, pulled in ahead of
       this sheet by select.class.ts): one scale for lr-button/lr-input/lr-select/lr-combobox/
       lr-date-input instead of five hand-maintained copies. The ladder matches both spellings of
       every tier in one selector list, so size="small" is size="s" here for free. */
    --_lr-select-trigger-padding: var(--lr-form-control-padding-block)
      var(--lr-form-control-padding-inline);
    --_lr-select-trigger-min-height: var(--lr-form-control-height);
    --_lr-select-font-size: var(--lr-form-control-font-size);
    --_lr-select-expand-size: var(--lr-size-1-75rem);
    /* The trigger's own adornment gap is deliberately NOT taken from the ladder: it does not vary
       by tier there either, and the ladder's value is tuned for a button's icon-beside-label
       spacing, which is tighter than a field wants between an adornment and its label. */
    --_lr-select-gap: var(--lr-space-xs);
    --_lr-select-radius: var(--lr-form-control-radius);
    --_lr-select-tag-padding: var(--lr-space-2xs) var(--lr-space-xs);
    --_lr-select-tag-font-size: var(--lr-font-size-sm);
    /* --lr-select-trigger-height is intentionally NOT declared here. It is a consumer-facing
       escape hatch consumed only through the two var() fallbacks on [part='trigger'] below;
       declaring any value for it (even 'auto') makes those fallback arms unreachable, which is
       what previously left --lr-select-trigger-min-height as dead code. Leaving it genuinely
       undeclared keeps both arms live, so the per-tier floor falls out of the fallback with no
       extra specificity rules, and setting the property from anywhere (inline style, an ancestor,
       an outer-tree rule) pins an exact height. */
  }
  /* Only the decorative expand glyph still needs per-tier rules: it sizes an icon box, not the
     control row, so the shared ladder has nothing to say about it. Both spellings of the aliased
     tier are matched here exactly as the ladder does, so size="small" can never take the s tier's
     padding with the default tier's chevron. */
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
  /* :empty never matches here -- the part always contains a literal slot
     child element regardless of assigned/text content -- so real emptiness
     is tracked in JS (hasLabelSlot) and reflected via the hidden attribute
     instead (same fix as [part~='hint']/[part='error'] below, and as
     lr-combobox). Without this, the required-asterisk ::after below
     (which attaches to this box) renders a stray ' *' with nothing before
     it whenever label is unset. */
  [part="form-control-label"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}

  /* Pill only retunes the shared radius property, so the single consumption point on
     [part='trigger'] stays the only place a corner radius is read -- and a consumer's own
     --lr-select-radius override (an inline style or an outer-tree rule) still wins over it. */
  :host([pill]) {
    --_lr-select-radius: var(--lr-radius-pill);
  }
  :host([filled]) [part="trigger"] {
    background: var(--lr-color-surface-raised);
    border-color: transparent;
  }

  /* Positioning context for [part='clear-button'], which is a *sibling* of the trigger rather
     than a child: the trigger is a real <button>, and a nested button would be invalid
     interactive-content nesting that no keyboard or AT user could ever reach. The wrapper is
     display: block so the trigger's own box (and therefore every existing size/height contract)
     is unchanged. */
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
  /* :where() zeroes the wrapped selectors' specificity contribution, keeping this at (0,1,0) --
     matches lr-model-select's/lr-attachment-trigger's fixed convention, so a consumer's own
     ::part(trigger):hover override ((0,1,1)) still wins without needing !important. */
  :where([part="trigger"]):hover:where(:not(:disabled)) {
    background: var(--lr-select-trigger-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed: the same quiet brand tint the hover lands on, carried further toward
     --lr-color-mix-partner (which follows the text colour), so the press is visibly deeper than
     the hover instead of a repeat of it. Same :where() zeroing as the hover above, so a consumer's
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
  /* Appearance treatments. outlined is the base rule above, so only the other four restate
     what they change. Each keeps the same box, border width and radius -- only the fill, the
     border color and (for accent) the text color move. */
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
  /* On the loud brand fill the quiet-text tokens below would sit at far too low a contrast --
     the placeholder, the expand icon and the chips all ride the on-brand text color instead. */
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
  /* Each appearance restates the hover feedback: the treatments above out-specify the shared
     hover rule further up, so without these the pointer affordance would silently disappear for
     every appearance except the default outlined. */
  :host([appearance="filled"])
    :where([part="trigger"]):hover:where(:not(:disabled)),
  :host([appearance="filled-outlined"])
    :where([part="trigger"]):hover:where(:not(:disabled)),
  :host([appearance="plain"])
    :where([part="trigger"]):hover:where(:not(:disabled)) {
    background: var(--lr-select-trigger-hover-bg, var(--lr-color-brand-quiet));
  }
  :host([appearance="filled"])
    :where([part="trigger"]):active:where(:not(:disabled)),
  :host([appearance="filled-outlined"])
    :where([part="trigger"]):active:where(:not(:disabled)),
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
  /* The loud fill has no quieter tint to move to, so it shifts toward --lr-color-mix-partner --
     which follows the text colour, i.e. darkens in the light theme and lightens in the dark one,
     both times away from the fill. Same two shares every other pressed/hovered surface in the
     library uses, rather than the hand-written 12% this pair carried before 8.0.0. */
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
  /* In multiple mode the real, independently-focusable tags are a sibling layered over the
     trigger. The shared sr-only rule keeps this complete joined value available to assistive
     technology without painting a duplicate underneath the chips. */

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
  /* [part~=] because the overflow chip carries two part names ('tag tag-overflow'), and an exact
     [part='tag'] match would skip it -- state lives in the part name because a state selector
     after ::part() never matches. */
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
     of the expand icon: the trigger is a <button>, so the clear action cannot live inside it and
     has to be overlaid from the wrapper instead. Reserving the band with padding rather than
     overlapping keeps the trigger's own content clear of it in both directions. */
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
     --lr-color-mix-partner at the stronger active share -- mirrors <lr-input>'s own
     clear-button/password-toggle pressed rule, so the two controls feel identical under the thumb.
     The button already carries --lr-select-radius, so the fill lands as a rounded chip. */
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
    /* Per the CSS overflow spec, pinning one axis to a non-'visible' value forces the other
       axis's used value to 'auto' too (never staying 'visible') -- an implicit overflow-x: auto
       here risks a phantom horizontal scrollbar from sub-pixel rounding even though this listbox
       only ever scrolls vertically. Pin overflow-x explicitly instead. Same fix as lr-tab-group'
       tablist (overflow-x: auto; overflow-y: hidden;), just on the opposite axis. */
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
    /* Closed state: invisible + slightly raised. visibility (not
       display:none) so opacity/transform can actually transition; hit-testing
       and a11y exposure stay off since this part is already position:fixed. */
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
  [part="option"]:hover,
  [part="option"][data-active] {
    /* Per-component indirection (with an inline var() fallback to the shared brand-quiet token)
       -- same fix as lr-command-palette's/lr-notebook-viewer's identical active-row pattern -- so
       a consumer can retheme just this row state without hijacking --lr-color-brand-quiet
       library-wide. */
    background: var(--lr-select-option-active-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed row. A pointer-down on an option commits a selection and closes the listbox, so this
     is the last frame the user sees before the panel goes away -- it has to read as deeper than
     the hover it replaces, not the same. Mixes the same row tint (consumer override included)
     toward --lr-color-mix-partner. */
  [part="option"]:active {
    background: color-mix(
      in oklab,
      var(--lr-select-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="option"][aria-selected="true"] {
    /* Per-component indirection (inline var() fallbacks to the shared brand tokens, so unset
       rendering is byte-for-byte unchanged) -- mirrors the active-bg indirection above and
       lr-segmented's/lr-tab-group' selected-state tokens -- so a consumer can retheme just the
       selected row without hijacking --lr-color-brand library-wide. */
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
