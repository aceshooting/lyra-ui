import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-combobox-trigger-padding: var(--lr-space-xs) var(--lr-space-s);
    --lr-combobox-trigger-min-height: var(--lr-size-2-5rem);
    --lr-combobox-font-size: var(--lr-font-size-md);
    --lr-combobox-tag-padding: var(--lr-size-0-1rem) var(--lr-size-0-4rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-sm);
    --lr-combobox-expand-size: var(--lr-size-1-75rem);
    /* --lr-combobox-trigger-height is intentionally NOT declared here. It is a consumer-facing
       escape hatch consumed only through the two var() fallbacks on [part='combobox'] below;
       declaring any value for it (even 'auto') would make those fallback arms unreachable and
       silently turn --lr-combobox-trigger-min-height into dead code. Left undeclared, both arms
       stay live: the per-tier floor falls out of the fallback with no extra specificity rules, and
       setting the property from anywhere (inline style, an ancestor, an outer-tree rule) pins an
       exact height. */
  }
  :host([size='xs']) {
    --lr-combobox-trigger-padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    --lr-combobox-trigger-min-height: var(--lr-size-1-5rem);
    --lr-combobox-font-size: var(--lr-font-size-xs);
    --lr-combobox-tag-padding: 0 var(--lr-size-0-25rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-2xs);
    --lr-combobox-expand-size: var(--lr-size-1rem);
  }
  :host([size='s']) {
    --lr-combobox-trigger-padding: var(--lr-space-xs) var(--lr-space-xs);
    --lr-combobox-trigger-min-height: var(--lr-size-1-875rem);
    --lr-combobox-font-size: var(--lr-font-size-sm);
    --lr-combobox-tag-padding: var(--lr-size-0-05rem) var(--lr-size-0-3125rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-xs);
    --lr-combobox-expand-size: var(--lr-size-1-25rem);
  }
  :host([size='l']) {
    --lr-combobox-trigger-padding: var(--lr-space-s) var(--lr-space-m);
    --lr-combobox-trigger-min-height: var(--lr-size-3rem);
    --lr-combobox-font-size: var(--lr-font-size-lg);
    --lr-combobox-tag-padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-md-sm);
  }
  :host([size='xl']) {
    --lr-combobox-trigger-padding: var(--lr-space-m) var(--lr-space-l);
    --lr-combobox-trigger-min-height: var(--lr-size-3-5rem);
    --lr-combobox-font-size: var(--lr-font-size-xl);
    --lr-combobox-tag-padding: var(--lr-size-0-25rem) var(--lr-size-0-625rem);
    --lr-combobox-tag-font-size: var(--lr-font-size-md);
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

  [part='combobox'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    min-block-size: var(--lr-combobox-trigger-height, var(--lr-combobox-trigger-min-height));
    box-sizing: border-box;
    /* Pinned only when --lr-combobox-trigger-height is set; 'auto' otherwise, so the row keeps
       growing to fit its own content (and, in multiple mode, a wrapping tag row). */
    block-size: var(--lr-combobox-trigger-height, auto);
    padding: var(--lr-combobox-trigger-padding);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
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
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-combobox-tag-padding);
    font-size: var(--lr-combobox-tag-font-size);
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-text);
    border-radius: var(--lr-radius);
  }
  /* Same compact-chip-remove pattern as lr-chip's [part='remove-button']: the interactive hit
     target meets the shared --lr-icon-button-size floor, while the visible glyph stays a
     compact 1rem close icon (font-size: var(--lr-font-size-md), independent of the tag's own
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
    font-size: var(--lr-font-size-md);
  }

  [part='combobox-input'] {
    flex: 1 1 var(--lr-size-6ch);
    min-inline-size: var(--lr-size-4ch);
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
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
    inline-size: max-content;
    min-inline-size: min(var(--lr-size-12rem), var(--lr-positioner-available-inline-size, var(--lr-size-12rem)));
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem), var(--lr-positioner-available-inline-size, 100vw));
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
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
    background: var(--lr-color-brand-quiet);
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
    font-weight: var(--lr-font-weight-semibold);
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
    color: var(--lr-color-text-quiet);
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
`;
