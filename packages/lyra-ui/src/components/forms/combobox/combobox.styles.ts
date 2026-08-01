import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Two-value shorthand, block axis first. Only the INLINE half is this component's own per-tier
       geometry; the BLOCK half is the shared ladder's --lr-form-control-padding-block at every tier,
       because that axis is the one the trigger's height floor has to pay for -- see the
       [part='combobox'] comment below. */
    --lr-combobox-trigger-padding: var(--lr-form-control-padding-block) var(--lr-space-s);
    /* Height and text size come from the ONE shared form-control ladder (internal/sizes.styles.ts)
       rather than a sixth private copy of the same six values. The ladder matches both spellings of
       every tier in one selector list, so size="small" and size="s" resolve identically here with
       no per-component alias rules. */
    --lr-combobox-trigger-min-height: var(--lr-form-control-height);
    --lr-combobox-font-size: var(--lr-form-control-font-size);
    --lr-combobox-tag-padding: var(--lr-size-0-1rem) var(--lr-size-0-4rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-sm);
    --lr-combobox-expand-size: var(--lr-size-1-75rem);
    /* Gap and radius don't vary by size tier (unlike the knobs above), so each is declared once
       here rather than re-assigned per :host([size='…']) block -- mirrors lr-button's identical
       --lr-button-gap/--lr-button-radius. */
    --lr-combobox-gap: var(--lr-space-xs);
    --lr-combobox-radius: var(--lr-radius);
    /* --lr-combobox-trigger-height is intentionally NOT declared here. It is a consumer-facing
       escape hatch consumed only through the two var() fallbacks on [part='combobox'] below;
       declaring any value for it (even 'auto') would make those fallback arms unreachable and
       silently turn --lr-combobox-trigger-min-height into dead code. Left undeclared, both arms
       stay live: the per-tier floor falls out of the fallback with no extra specificity rules, and
       setting the property from anywhere (inline style, an ancestor, an outer-tree rule) pins an
       exact height. */
  }
  :host([pill]) {
    --lr-combobox-radius: var(--lr-radius-pill);
  }
  /* What remains per tier is this component's OWN geometry -- the selected-tag chip and the
     decorative expand glyph -- which is not a form-control height/text ladder and so is not part of
     the shared one. Each tier matches both spellings for the same reason sizes.styles.ts does: the
     shared ladder accepts size="small", and a control whose tags silently ignored it would be worse
     than one that never accepted it. */
  :host([size='2xs']) {
    --lr-combobox-trigger-padding: var(--lr-form-control-padding-block) var(--lr-space-2xs);
    --lr-combobox-tag-padding: 0 var(--lr-size-0-25rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-2xs);
    --lr-combobox-expand-size: var(--lr-size-1rem);
  }
  :host([size='xs']) {
    --lr-combobox-trigger-padding: var(--lr-form-control-padding-block) var(--lr-space-xs);
    --lr-combobox-tag-padding: 0 var(--lr-size-0-25rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-2xs);
    --lr-combobox-expand-size: var(--lr-size-1rem);
  }
  :host([size='s']),
  :host([size='small']) {
    --lr-combobox-trigger-padding: var(--lr-form-control-padding-block) var(--lr-space-xs);
    --lr-combobox-tag-padding: var(--lr-size-0-05rem) var(--lr-size-0-3125rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-xs);
    --lr-combobox-expand-size: var(--lr-size-1-25rem);
  }
  :host([size='l']),
  :host([size='large']) {
    --lr-combobox-trigger-padding: var(--lr-form-control-padding-block) var(--lr-space-m);
    --lr-combobox-tag-padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-md-sm);
  }
  :host([size='xl']) {
    --lr-combobox-trigger-padding: var(--lr-form-control-padding-block) var(--lr-space-l);
    --lr-combobox-tag-padding: var(--lr-size-0-25rem) var(--lr-size-0-625rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-m);
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches here -- the part always contains a literal slot
     child element regardless of assigned/text content -- so real emptiness
     is tracked in JS (hasLabelSlot) and reflected via the hidden attribute
     instead (same fix as [part='hint']/[part='error'] below). Without this,
     the required-asterisk ::after below (which attaches to this box)
     renders a stray ' *' with nothing before it whenever label is unset. */
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  /* min-block-size is a FLOOR on a border-box, so it only decides the rendered height while this
     row's own content stays under it -- and that content includes the search input, whose text box
     is line-height: normal, i.e. a metric of whatever font family the ambient stack resolves to. Two
     machines resolve system-ui to different fonts, so any tier whose content sits at or above the
     floor renders a different height on each of them. Keeping the block padding on the shared
     ladder (and zeroing the input's UA block padding below) is what holds the content under the
     floor at every tier, which is what makes this trigger line up with lr-input/lr-select/lr-button
     in a toolbar row -- the promise sizes.styles.ts makes. */
  [part='combobox'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-combobox-gap);
    inline-size: 100%;
    min-block-size: var(--lr-combobox-trigger-height, var(--lr-combobox-trigger-min-height));
    box-sizing: border-box;
    /* Pinned only when --lr-combobox-trigger-height is set; 'auto' otherwise, so the row keeps
       growing to fit its own content (and, in multiple mode, a wrapping tag row). */
    block-size: var(--lr-combobox-trigger-height, auto);
    padding: var(--lr-combobox-trigger-padding);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-combobox-radius);
    background: var(--lr-color-surface);
    font-size: var(--lr-combobox-font-size);
    cursor: text;
  }
  [part='combobox']:focus-within {
    border-color: var(--lr-color-brand);
    outline: var(--lr-border-width-medium) solid transparent;
  }
  :host(:disabled) [part='combobox'] {
    /* was a literal 0.5; now the shared library-wide disabled-state token
       (still 0.5 by default fallback, so no visual change here). */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='start'],
  [part='end'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    color: var(--lr-color-text-quiet);
  }
  [part='start'][hidden],
  [part='end'][hidden] {
    display: none;
  }

  [part='tags'] {
    display: contents;
  }
  [part='tag'] {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-combobox-tag-padding);
    font-size: var(--lr-combobox-tag-font-size);
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-text);
    border-radius: var(--lr-radius);
  }
  [part='tag-label'] {
    min-inline-size: 0;
    overflow: hidden;
    overflow-wrap: anywhere;
    text-overflow: ellipsis;
  }
  /* Same compact-chip-remove pattern as lr-chip's [part='remove-button']: the interactive hit
     target meets the shared --lr-icon-button-size floor, while the visible glyph stays a
     compact 1rem close icon (font-size: var(--lr-font-size-m), independent of the tag's own
     --lr-combobox-tag-font-size, which shrinks well below that at size="xs"/"s") -- a selected
     tag is a small inline pill, so growing its whole box to 40px would visually balloon the tags
     row. The negative margin pulls the enlarged hit area back in so the *visible* tag footprint
     is unchanged; it overlaps into the tag's own padding/background rather than expanding the
     row's layout box. */
  [part='tag__remove-button'] {
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

  [part='combobox-input'] {
    flex: 1 1 var(--lr-size-6ch);
    min-inline-size: var(--lr-size-4ch);
    /* 0, not the UA's own 1px default -- same neutralisation lr-input applies to its [part='input'].
       The trigger row above already owns this control's block padding; leaving the UA's on as well
       spent two more pixels of the height floor's budget at every tier, which is what used to push
       the dense tiers over their floor and hand the rendered height to the ambient font. */
    padding-block: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part='combobox-input']::placeholder {
    color: var(--lr-color-text-quiet);
  }

  [part='clear-button'],
  [part='expand-icon'] {
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
  /* [part='expand-icon'] is a decorative aria-hidden dropdown indicator, not an independently
     clickable target of its own -- the whole [part='combobox'] row opens the listbox via
     onComboMouseDown, so this keeps its existing compact box rather than the interactive floor
     below (which would force every size variant's trigger row taller just to fit a glyph nobody
     taps directly). */
  [part='expand-icon'] {
    box-sizing: border-box;
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-combobox-expand-size));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-combobox-expand-size));
    padding: 0;
  }
  /* Unlike [part='expand-icon'], [part='clear-button'] is a real, independently-focusable
     <button> (see combobox.class.ts's @click) -- it gets the full shared icon-button hit-area
     floor instead of the capped box above. */
  [part='clear-button'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }
  /* Mirrors <lr-input>'s own [part='clear-button']:hover -- darkens the same quiet-to-full text
     token step so mouse users get the same "this is interactive" feedback keyboard users already
     get from the focus ring below. */
  [part='clear-button']:hover {
    color: var(--lr-color-text);
  }
  /* Pressed adds what hover cannot: hover has already spent the colour step (quiet -> full text),
     so the press is a background pad mixed off the row's own surface. Stronger than hover by
     construction -- --lr-color-mix-active is the larger of the two shared knobs. */
  [part='clear-button']:active {
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    border-radius: var(--lr-radius);
  }
  /* Mirrors <lr-chip>'s own [part='remove-button']:hover -- a currentColor-derived tint rather
     than a fixed token, since this part's rest-state color is 'inherit' (the tag's own text
     color), not a dedicated quiet token to darken. */
  [part='tag__remove-button']:hover {
    background: color-mix(in srgb, currentColor 16%, transparent);
  }
  /* Same currentColor idiom as the hover above (this part's rest color is the tag's inherited text
     color, not a token), taken to the shared pressed strength -- 22% against the hover's 16%. */
  [part='tag__remove-button']:active {
    background: color-mix(in srgb, currentColor var(--lr-color-mix-active), transparent);
  }
  [part='clear-button']:focus-visible,
  [part='tag__remove-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-block-size: min(var(--lr-size-18rem), var(--lr-positioner-available-block-size, var(--lr-size-18rem)));
    overflow-y: auto;
    overflow-x: hidden;
    inline-size: max-content;
    min-inline-size: min(var(--lr-size-12rem), var(--lr-positioner-available-inline-size, var(--lr-size-12rem)));
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem), var(--lr-positioner-available-inline-size, 100vw));
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
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      visibility var(--lr-transition-fast);
  }
  [part='option'],
  .group-label,
  .loading,
  .empty,
  .source-error {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  :host([open]) [part='listbox'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='listbox'] {
      transition: none !important;
    }
  }

  [part='option'] {
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
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lr-combobox-option-active-bg, var(--lr-color-brand-quiet));
  }
  /* Mixing the hover tint itself (not the bare token) keeps a consumer who retinted
     --lr-combobox-option-active-bg in charge of both states: the pressed row is always their
     colour, one shared step further toward the text colour. */
  [part='option']:active {
    background: color-mix(
      in oklab,
      var(--lr-combobox-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='option'][aria-selected='true'] {
    /* Per-component indirection (inline var() fallbacks to the shared brand tokens, so unset
       rendering is byte-for-byte unchanged) -- so a consumer can retheme just the selected row
       without hijacking --lr-color-brand library-wide. */
    background: var(--lr-combobox-option-selected-bg, transparent);
    border-color: var(--lr-combobox-option-selected-border, var(--lr-color-brand));
    color: var(--lr-combobox-option-selected-color, var(--lr-color-brand));
    font-weight: var(--lr-combobox-option-selected-font-weight, var(--lr-font-weight-semibold));
  }
  [part='option'][aria-disabled='true'] {
    /* was a literal 0.4; unified with the rest of the library's single
       disabled-state opacity token (intentionally changes 0.4 -> 0.5). */
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='option-dot'] {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: 50%;
    flex: 0 0 auto;
  }
  [part='option-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
  }
  [part='option-label'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='option-sub'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='option-badge'] {
    flex: 0 0 auto;
    padding: 0 var(--lr-space-xs);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-brand-quiet);
    /* Full-strength text, not the quiet tone: quiet-on-quiet measured 4.25:1, under WCAG 1.4.3's
       4.5:1. The badge already reads as secondary from its size and its tinted pill; borrowing the
       muted text colour on top of a tinted fill was double de-emphasis that cost legibility. */
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
  }
  [part='option-overflow'],
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
  [part='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches here -- the part always contains a literal
     slot child element regardless of assigned/text content -- so real
     emptiness is tracked in JS (hasHintSlot/hasErrorSlot) and reflected via
     the hidden attribute instead (same fix as lr-stat's icon/caption). */
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
  [part='form-control'],
  [part='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
