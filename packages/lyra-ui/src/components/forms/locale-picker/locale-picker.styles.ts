import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    --_lr-locale-picker-trigger-padding-default: var(--lr-space-xs) var(--lr-space-s);
    /* Height and text size come from the ONE shared form-control ladder
       (internal/sizes.styles.ts), not a private copy. It matches both spellings of every tier, so
       size='small' and size='s' resolve identically with no per-component alias rules. */
    --_lr-locale-picker-trigger-min-height-default: var(--lr-form-control-height);
    --_lr-locale-picker-font-size-default: var(--lr-form-control-font-size);
    --_lr-locale-picker-expand-size-default: var(--lr-size-1-75rem);
    --_lr-locale-picker-gap-default: var(--lr-space-xs);
    --_lr-locale-picker-radius-default: var(--lr-form-control-radius);
    /* --lr-locale-picker-trigger-height is intentionally NOT declared here (as in lr-select): a
       consumer escape hatch read only through the var() fallback on [part='trigger'] below, and
       declaring it would deaden that fallback arm. */
  }
  /* What remains per tier is this component's OWN geometry -- trigger density and the decorative
     expand glyph -- not a form-control height/text ladder. Each tier matches both spellings
     because the shared ladder accepts size='small', and a trigger whose density ignored it would
     be worse than one that never accepted it. */
  :host([size='2xs']) {
    --_lr-locale-picker-trigger-padding-default: var(--lr-size-0-0625rem) var(--lr-space-2xs);
    --_lr-locale-picker-expand-size-default: var(--lr-size-1rem);
  }
  :host([size='xs']) {
    --_lr-locale-picker-trigger-padding-default: var(--lr-size-0-125rem) var(--lr-space-xs);
    --_lr-locale-picker-expand-size-default: var(--lr-size-1rem);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-locale-picker-trigger-padding-default: var(--lr-space-xs) var(--lr-space-xs);
    --_lr-locale-picker-expand-size-default: var(--lr-size-1-25rem);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-locale-picker-trigger-padding-default: var(--lr-space-s) var(--lr-space-m);
  }
  :host([size='xl']) {
    --_lr-locale-picker-trigger-padding-default: var(--lr-space-m) var(--lr-space-l);
  }

  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches -- the part always holds a literal <slot> child -- so emptiness is
     tracked via hasLabelSlot/label.length and reflected as the hidden attribute (as lr-select). */
  [part='form-control-label'][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}

  [part='trigger'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-locale-picker-gap, var(--_lr-locale-picker-gap-default));
    inline-size: 100%;
    min-block-size: var(--lr-locale-picker-trigger-height, var(--lr-locale-picker-trigger-min-height, var(--_lr-locale-picker-trigger-min-height-default)));
    box-sizing: border-box;
    block-size: var(--lr-locale-picker-trigger-height, auto);
    padding: var(--lr-locale-picker-trigger-padding, var(--_lr-locale-picker-trigger-padding-default));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-locale-picker-radius, var(--_lr-locale-picker-radius-default));
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(--lr-locale-picker-font-size, var(--_lr-locale-picker-font-size-default));
    text-align: start;
    cursor: pointer;
  }
  [part='trigger']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* :where() keeps this at (0,1,0), the same weight as the pressed rule below, which therefore
     wins on source order while the trigger is held. Matches lr-select and lr-model-select. */
  :where([part='trigger']):hover:where(:not(:disabled)) {
    background: var(--lr-locale-picker-trigger-hover-bg, var(--lr-color-brand-quiet));
  }
  /* The hover tint one shared step further toward the text colour, in the identical
     :where()/:not(:disabled) wrapping, so it ties with the hover rule above -- source order hands
     the press the win -- and never fires on a disabled trigger. */
  :where([part='trigger']):active:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-locale-picker-trigger-hover-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lr-locale-picker-open-border-color, var(--lr-color-brand));
  }
  :host(:disabled) [part='trigger'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='trigger-flag'] {
    flex: 0 0 auto;
  }

  .trigger-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-locale-picker-expand-size, var(--_lr-locale-picker-expand-size-default)));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-locale-picker-expand-size, var(--_lr-locale-picker-expand-size-default)));
    line-height: var(--lr-line-height-none);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-block-size: var(--lr-size-18rem);
    overflow-y: auto;
    overflow-x: hidden;
    inline-size: max-content;
    min-inline-size: var(--lr-size-12rem);
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem));
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-locale-picker-radius, var(--_lr-locale-picker-radius-default));
    /* Anchored overlay: a positioner-placed listbox floating over page content, not a modal layer. */
    box-shadow: var(--lr-shadow-m);
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
    gap: var(--lr-locale-picker-gap, var(--_lr-locale-picker-gap-default));
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-locale-picker-radius, var(--_lr-locale-picker-radius-default));
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='option']:hover {
    background: var(
      --lr-locale-picker-option-active-bg,
      var(--lr-color-brand-quiet)
    );
  }
  [part='option'][data-active] {
    background: var(--lr-locale-picker-option-active-bg, var(--lr-color-brand-quiet));
  }
  /* Mixing the hover tint itself (not the bare token) keeps a consumer who retinted
     --lr-locale-picker-option-active-bg in charge of both states. */
  [part='option']:active {
    background: color-mix(
      in oklab,
      var(--lr-locale-picker-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lr-locale-picker-option-selected-border-color, var(--lr-color-brand));
    color: var(--lr-locale-picker-option-selected-color, var(--lr-color-brand));
    font-weight: var(--lr-locale-picker-option-selected-font-weight, var(--lr-font-weight-semibold));
  }
  @media (forced-colors: active) {
    :where([part='trigger']):hover:where(:not(:disabled)) {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-thin));
    }
    :where([part="trigger"]):active:where(:not(:disabled)) {
      outline-style: double;
      outline-width: var(--lr-border-width-medium);
    }
    [part="option"][data-active] {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-thin));
    }
    [part="option"][aria-selected="true"] {
      border-color: Highlight;
      border-style: double;
    }
  }
  [part='option-flag'] {
    flex: 0 0 auto;
  }
  [part='option-label'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    overflow: hidden;
  }
  [part='option-label'] span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='option-tag'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  [part='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
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
