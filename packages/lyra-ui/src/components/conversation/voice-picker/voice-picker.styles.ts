import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';
import { overlaySurfaceFill } from '../../../internal/overlay-surface.styles.js';

export const styles = css`
  :host {
    position: relative;
    display: inline-block;
    inline-size: 100%;
    min-inline-size: 0;
    /* Same shipped 24rem ceiling lr-model-select carries, and published under the same contract:
       kept as the default so no existing layout moves, read as a var() fallback so a consumer can
       retune it or set none for a full-width row, and never declared on :host so an ancestor theme
       wrapper's value still reaches this control. */
    max-inline-size: var(--lr-voice-picker-max-inline-size, var(--lr-size-24rem));
    --_lr-voice-picker-gap-default: var(--lr-space-xs);
    --_lr-voice-picker-radius-default: var(--lr-form-control-radius);
    --_lr-voice-picker-trigger-min-height-default: var(--lr-form-control-height);
  }
  :host(:disabled) {
    cursor: not-allowed;
  }

  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='form-control-label'][hidden] {
    display: none;
  }
  /* required plus a visible label, marked like every other field; the [hidden] rule above keeps
     the marker from orphaning a stray glyph when no label is set. */
  ${formControlRequiredMarker}

  .control-row {
    display: flex;
    align-items: stretch;
    gap: var(--lr-voice-picker-gap, var(--_lr-voice-picker-gap-default));
  }

  [part='trigger'],
  [part='combobox'] {
    display: flex;
    align-items: center;
    gap: var(--lr-voice-picker-gap, var(--_lr-voice-picker-gap-default));
    flex: 1 1 auto;
    min-inline-size: 0;
    /* Neither public name is declared on :host: both are read only through these var() fallbacks,
       so a declared value (even auto) would dead-arm them. The shared ladder height is the floor;
       --lr-voice-picker-trigger-height pins an exact height, flooring and capping at once. */
    min-block-size: var(
      --lr-voice-picker-trigger-height,
      var(
        --lr-voice-picker-trigger-min-height,
        var(--_lr-voice-picker-trigger-min-height-default)
      )
    );
    block-size: var(--lr-voice-picker-trigger-height, auto);
    box-sizing: border-box;
    padding: var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline);
    /* Resting fill and edge, each an inline var() fallback rather than a :host declaration, so an
       ancestor or :root value still wins -- the same shape as lr-select's own trigger, which had
       the identical hardcoded pair before its own fix. */
    border: var(--lr-border-width-thin) solid
      var(--lr-voice-picker-trigger-border-color, var(--lr-color-border));
    border-radius: var(--lr-voice-picker-radius, var(--_lr-voice-picker-radius-default));
    background: var(--lr-voice-picker-trigger-fill, var(--lr-color-surface));
    color: inherit;
    font: inherit;
    font-size: var(--lr-form-control-font-size);
  }
  [part='trigger'] {
    cursor: pointer;
    text-align: start;
  }
  [part='combobox'] {
    cursor: text;
  }
  [part='trigger']:hover:not(:disabled) {
    border-color: var(--lr-color-brand);
  }
  /* Hover recolors the border; the press also fills the trigger, mixing its resting surface toward
     the text color, so it escalates hover rather than restating it. */
  [part='trigger']:active:not(:disabled) {
    border-color: var(--lr-color-brand);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='trigger']:focus-visible,
  [part='combobox']:focus-within {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lr-voice-picker-open-border-color, var(--lr-color-brand));
  }
  :host(:disabled) [part='trigger'],
  :host(:disabled) [part='combobox'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='provider-badge'] {
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

  [part='combobox-input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part='combobox-input']::placeholder {
    color: var(--lr-color-text-quiet);
  }

  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-form-control-height));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-form-control-height));
    line-height: var(--lr-line-height-none);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='preview-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: max(var(--lr-icon-button-size), var(--lr-form-control-height));
    /* The action sits beside the trigger in an align-items: stretch row, but stretch does not
       apply to an item with a definite cross size -- so a definite block-size here would stay at
       the ladder height while the field moved, leaving a short top-aligned square next to a taller
       field. It reads the SAME two-name chain the field reads, in the same order: raising only the
       floor moves the field exactly as pinning an exact height does, so an action that followed
       only -trigger-height would reproduce that defect for every consumer who set the floor. */
    block-size: var(
      --lr-voice-picker-trigger-height,
      var(
        --lr-voice-picker-trigger-min-height,
        max(var(--lr-icon-button-size), var(--lr-form-control-height))
      )
    );
    /* Compact picker chrome may be smaller than the WCAG interaction floor; the independent
       preview action never is -- the floor stays below the hook, so pinning a short field cannot
       shrink this hit area. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-voice-picker-radius, var(--_lr-voice-picker-radius-default));
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='preview-button']:hover:not(:disabled) {
    background: var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }
  [part='preview-button']:active:not(:disabled) {
    background: color-mix(
      in oklab,
      var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }
  [part='preview-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='preview-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='preview-button'][aria-pressed='true'] {
    border-color: var(--lr-voice-picker-preview-active-border, var(--lr-color-brand));
    color: var(--lr-voice-picker-preview-active-color, var(--lr-color-brand));
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    /* Clamped against internal/positioner.js's place()-published available-space properties, as in
       menu.styles.ts and combobox.styles.ts, so the popup can't overflow a short viewport. */
    max-block-size: min(var(--lr-size-18rem), var(--lr-positioner-available-block-size, var(--lr-size-18rem)));
    overflow-y: auto;
    /* Pinned explicitly: per spec, once one axis is forced non-'visible' the other computes to
       'auto' too, so sub-pixel rounding can raise a phantom horizontal scrollbar (the bug
       lr-tab-group's tablist was fixed for). inline-size is max-content below, so this axis never
       needs to scroll. */
    overflow-x: hidden;
    inline-size: max-content;
    min-inline-size: min(var(--lr-size-12rem), var(--lr-positioner-available-inline-size, var(--lr-size-12rem)));
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem), var(--lr-positioner-available-inline-size, 100vw));
    padding: var(--lr-space-xs);
    /* Fill and edge from the shared overlay-surface family
       (internal/overlay-surface.styles.ts). The radius arm stays this component's own hook, with
       the family only as its middle fallback, so a component-scoped override still wins. */
    ${overlaySurfaceFill}
    border-radius: var(
      --lr-voice-picker-radius,
      var(--lr-overlay-radius, var(--_lr-voice-picker-radius-default))
    );
    /* Anchored overlay: a positioner-placed listbox floating over page content, not a modal layer. */
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
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
    gap: var(--lr-voice-picker-gap, var(--_lr-voice-picker-gap-default));
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-voice-picker-radius, var(--_lr-voice-picker-radius-default));
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lr-voice-picker-option-selected-border, var(--lr-color-brand));
    color: var(--lr-voice-picker-option-selected-color, var(--lr-color-brand));
    background: var(--lr-voice-picker-option-selected-bg, transparent);
    font-weight: var(
      --lr-voice-picker-option-selected-font-weight,
      var(--lr-font-weight-semibold)
    );
  }
  /* The three row-state rules below must stay AFTER the [aria-selected='true'] rule above: all
     four are (0,2,0) on the same row element, so source order decides the selected row's
     background. Reversed, --lr-voice-picker-option-selected-bg (transparent by default) swallowed
     hover, press and the [data-active] aria-activedescendant highlight. The selected rule still
     paints border-color, color and font-weight, untouched here. */
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lr-voice-picker-option-active-bg, var(--lr-color-brand-quiet));
  }
  /* Mixes the SAME --lr-voice-picker-option-active-bg as the hover/active-descendant rule above,
     so retinting the highlight gets a matching pressed step. */
  [part='option']:active {
    background: color-mix(
      in oklab,
      var(--lr-voice-picker-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='option-label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  [part='option-label'] > :first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='option-meta'] {
    font-size: var(--lr-size-0-6875rem);
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='option']:hover [part='option-meta'],
  [part='option'][data-active] [part='option-meta'] {
    color: var(--lr-color-text);
  }
  [part='option'][data-synthetic] {
    border-style: var(--lr-voice-picker-option-synthetic-border-style, dashed);
    border-color: var(--lr-voice-picker-option-synthetic-border-color, var(--lr-color-border));
  }
  [part='option'][data-synthetic] [part='option-label'] {
    font-style: var(--lr-voice-picker-option-synthetic-font-style, italic);
  }
  [part='option-badge'] {
    flex: 0 0 auto;
    font-size: var(--lr-size-0-6875rem);
    font-style: normal;
    font-weight: var(--lr-font-weight-normal);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part='option-preview'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border-radius: var(--lr-voice-picker-radius, var(--_lr-voice-picker-radius-default));
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  [part='option-preview']:hover {
    background: var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }
  /* Mixes the SAME --lr-voice-picker-preview-hover-bg as the rule above, so retinting the hover
     fill gets a matching pressed step with no second property to keep in sync. */
  [part='option-preview']:active {
    background: color-mix(
      in oklab,
      var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }

  [part='empty'] {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }

  [part='hint'] {
    margin-block-start: var(--lr-space-xs);
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
