import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-combobox-trigger-padding: var(--lyra-space-xs) var(--lyra-space-s);
    --lyra-combobox-trigger-min-height: var(--lyra-size-2-5rem);
    --lyra-combobox-font-size: var(--lyra-font-size-md);
    --lyra-combobox-tag-padding: var(--lyra-size-0-1rem) var(--lyra-size-0-4rem);
    --lyra-combobox-tag-font-size: var(--lyra-font-size-sm);
  }
  :host([size='xs']) {
    --lyra-combobox-trigger-padding: var(--lyra-size-0-125rem) var(--lyra-space-xs);
    --lyra-combobox-trigger-min-height: var(--lyra-size-1-5rem);
    --lyra-combobox-font-size: var(--lyra-font-size-xs);
    --lyra-combobox-tag-padding: 0 var(--lyra-size-0-25rem);
    --lyra-combobox-tag-font-size: var(--lyra-font-size-2xs);
  }
  :host([size='s']) {
    --lyra-combobox-trigger-padding: var(--lyra-space-xs) var(--lyra-space-xs);
    --lyra-combobox-trigger-min-height: var(--lyra-size-1-875rem);
    --lyra-combobox-font-size: var(--lyra-font-size-sm);
    --lyra-combobox-tag-padding: var(--lyra-size-0-05rem) var(--lyra-size-0-3125rem);
    --lyra-combobox-tag-font-size: var(--lyra-font-size-xs);
  }
  :host([size='l']) {
    --lyra-combobox-trigger-padding: var(--lyra-space-s) var(--lyra-space-m);
    --lyra-combobox-trigger-min-height: var(--lyra-size-3rem);
    --lyra-combobox-font-size: var(--lyra-font-size-lg);
    --lyra-combobox-tag-padding: var(--lyra-size-0-15rem) var(--lyra-size-0-5rem);
    --lyra-combobox-tag-font-size: var(--lyra-font-size-md-sm);
  }
  :host([size='xl']) {
    --lyra-combobox-trigger-padding: var(--lyra-space-m) var(--lyra-space-l);
    --lyra-combobox-trigger-min-height: var(--lyra-size-3-5rem);
    --lyra-combobox-font-size: var(--lyra-font-size-xl);
    --lyra-combobox-tag-padding: var(--lyra-size-0-25rem) var(--lyra-size-0-625rem);
    --lyra-combobox-tag-font-size: var(--lyra-font-size-md);
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
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
    color: var(--lyra-color-danger);
  }

  [part='combobox'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    min-block-size: var(--lyra-combobox-trigger-min-height);
    padding: var(--lyra-combobox-trigger-padding);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    font-size: var(--lyra-combobox-font-size);
    cursor: text;
  }
  [part='combobox']:focus-within {
    border-color: var(--lyra-color-brand);
    outline: var(--lyra-border-width-medium) solid transparent;
  }
  :host(:disabled) [part='combobox'] {
    /* was a literal 0.5; now the shared library-wide disabled-state token
       (still 0.5 by default fallback, so no visual change here). */
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }

  [part='tags'] {
    display: contents;
  }
  [part='tag'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-combobox-tag-padding);
    font-size: var(--lyra-combobox-tag-font-size);
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-text);
    border-radius: var(--lyra-radius);
  }
  /* Same compact-chip-remove pattern as lyra-chip's [part='remove-button']: the interactive hit
     target meets the shared --lyra-icon-button-size floor, while the visible glyph stays a
     compact 1rem close icon (font-size: var(--lyra-font-size-md), independent of the tag's own
     --lyra-combobox-tag-font-size, which shrinks well below that at size="xs"/"s") -- a selected
     tag is a small inline pill, so growing its whole box to 40px would visually balloon the tags
     row. The negative margin pulls the enlarged hit area back in so the *visible* tag footprint
     is unchanged; it overlaps into the tag's own padding/background rather than expanding the
     row's layout box. */
  [part='tag__remove-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    margin: calc((var(--lyra-icon-button-size) - var(--lyra-size-1rem)) / -2);
    border: none;
    background: none;
    cursor: pointer;
    color: inherit;
    padding: 0;
    line-height: var(--lyra-line-height-none);
    font-size: var(--lyra-font-size-md);
  }

  [part='combobox-input'] {
    flex: 1 1 var(--lyra-size-6ch);
    min-inline-size: var(--lyra-size-4ch);
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
    color: var(--lyra-color-text-quiet);
    padding: var(--lyra-space-xs);
    line-height: var(--lyra-line-height-none);
  }
  /* [part='expand-icon'] is a decorative aria-hidden dropdown indicator, not an independently
     clickable target of its own -- the whole [part='combobox'] row opens the listbox via
     onComboMouseDown, so this keeps its existing compact box rather than the interactive floor
     below (which would force every size variant's trigger row taller just to fit a glyph nobody
     taps directly). */
  [part='expand-icon'] {
    min-inline-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    min-block-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
  }
  /* Unlike [part='expand-icon'], [part='clear-button'] is a real, independently-focusable
     <button> (see combobox.class.ts's @click) -- it gets the full shared icon-button hit-area
     floor instead of the capped box above. */
  [part='clear-button'] {
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }
  [part='clear-button']:focus-visible,
  [part='tag__remove-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lyra-layer-dropdown);
    box-sizing: border-box;
    max-block-size: min(var(--lyra-size-18rem), var(--lyra-positioner-available-block-size, var(--lyra-size-18rem)));
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: min(var(--lyra-size-12rem), var(--lyra-positioner-available-inline-size, var(--lyra-size-12rem)));
    max-inline-size: min(92vw, var(--lyra-size-28rem), var(--lyra-positioner-available-inline-size, 100vw));
    padding: var(--lyra-space-xs);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    /* Closed state: invisible + slightly raised. visibility (not
       display:none) so opacity/transform can actually transition; hit-testing
       and a11y exposure stay off since this part is already position:fixed. */
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lyra-size-neg-0-25rem));
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast),
      visibility var(--lyra-transition-fast);
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
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid transparent;
    border-radius: var(--lyra-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='option'][aria-disabled='true'] {
    /* was a literal 0.4; unified with the rest of the library's single
       disabled-state opacity token (intentionally changes 0.4 -> 0.5). */
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='option-dot'] {
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: 50%;
    flex: 0 0 auto;
  }
  [part='option-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
  }
  [part='option-label'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='option-sub'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  [part='option-badge'] {
    flex: 0 0 auto;
    padding: 0 var(--lyra-space-xs);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
  }
  [part='option-overflow'],
  .loading {
    padding: var(--lyra-space-s) var(--lyra-space-m);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }

  .group-label {
    padding: var(--lyra-space-xs) var(--lyra-space-s) 0;
    font-size: var(--lyra-size-0-6875rem);
    font-weight: var(--lyra-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lyra-size-0-04em);
    color: var(--lyra-color-text-quiet);
  }
  .empty {
    padding: var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
  }
  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  /* :empty never matches here -- the part always contains a literal
     slot child element regardless of assigned/text content -- so real
     emptiness is tracked in JS (hasHintSlot/hasErrorSlot) and reflected via
     the hidden attribute instead (same fix as lyra-stat's icon/caption). */
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
