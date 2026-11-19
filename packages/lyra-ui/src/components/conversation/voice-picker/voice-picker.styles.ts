import { iconHitTarget, focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { catalogPickerTriggerLabel } from '../catalog-picker-trigger.styles.js';
import { glassSurface } from '../../../internal/glass-surface.styles.js';
import { glassScrollLayerStyles } from '../../../internal/glass-scroll-layer.styles.js';
import { glassIndependentRootStyles } from '../../../internal/glass-independent-root.styles.js';
import { formControlFocusHalo, formControlRequiredMarker } from '../../../internal/form-control.styles.js';
import { formControlChrome } from '../../../internal/form-control/chrome.styles.js';
import {
  anchoredPopupOpen,
  anchoredPopupReveal,
  overlaySurfaceFill,
  overlaySurfaceControlEdge,
} from '../../../internal/overlay-surface.styles.js';

export const styles = css`
  [part='limit'] {
    margin: 0;
    padding: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  :host {
    position: relative;
    display: inline-block;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: var(--lr-voice-picker-max-inline-size, var(--lr-size-24rem));
    --_lr-voice-picker-gap-default: var(--lr-space-xs);
    --_lr-voice-picker-radius-default: var(--lr-form-control-radius);
    --_lr-voice-picker-trigger-min-height-default: var(--lr-form-control-height);
    --_lr-voice-picker-trigger-padding: var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline);
    --_lr-voice-picker-font-size: var(--lr-form-control-font-size);
    --_lr-voice-picker-expand-size: var(--lr-size-1-75rem);
    --_lr-form-control-focus-shadow: var(--lr-form-control-focus-shadow, none);
  }
  :host(:disabled) {
    cursor: not-allowed;
  }
  :host([size='2xs']),
  :host([size='xs']) { --_lr-voice-picker-expand-size: var(--lr-size-1rem); }
  :host([size='s']),
  :host([size='small']) { --_lr-voice-picker-expand-size: var(--lr-size-1-25rem); }

  ${formControlChrome}
  [part='form-control-label'] {
    overflow-wrap: anywhere;
  }

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
    /* Leave the height hook unset so the minimum can supply the default. */
    min-block-size: var(
      --lr-voice-picker-trigger-height,
      var(
        --lr-voice-picker-trigger-min-height,
        var(--_lr-voice-picker-trigger-min-height-default)
      )
    );
    block-size: var(--lr-voice-picker-trigger-height, auto);
    box-sizing: border-box;
    padding: var(--lr-voice-picker-trigger-padding, var(--_lr-voice-picker-trigger-padding));
    border: var(--lr-border-width-thin) solid
      var(--lr-voice-picker-trigger-border-color, var(--lr-color-border));
    border-radius: var(--lr-voice-picker-radius, var(--_lr-voice-picker-radius-default));
    background: var(--lr-voice-picker-trigger-fill, var(--lr-color-surface));
    color: inherit;
    font: inherit;
    font-size: var(--lr-voice-picker-font-size, var(--_lr-voice-picker-font-size));
  }
  [part='trigger'] {
    cursor: pointer;
    text-align: start;
  }
  [part='combobox'] {
    cursor: text;
  }
  :where([part='trigger']):hover:where(:not(:disabled)) {
    background: var(--lr-voice-picker-trigger-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-voice-picker-trigger-hover-border-color, var(--lr-voice-picker-trigger-border-color, var(--lr-color-border)));
  }
  :where([part='trigger']):active:where(:not(:disabled)) {
    background: var(--lr-voice-picker-trigger-active-bg,
      color-mix(in oklab, var(--lr-voice-picker-trigger-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  [part='trigger']:focus-visible,
  [part='combobox']:focus-within {
    ${focusRing}
  }
  /* An opted-in focus halo is also visible after a pointer click. */
  [part='trigger']:focus,
  [part='combobox']:focus-within {
    ${formControlFocusHalo}
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lr-voice-picker-open-border-color, var(--lr-color-brand));
  }
  :host(:disabled) [part='trigger'],
  :host(:disabled) [part='combobox'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  ${catalogPickerTriggerLabel}

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
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-voice-picker-expand-size, var(--_lr-voice-picker-expand-size)));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-voice-picker-expand-size, var(--_lr-voice-picker-expand-size)));
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
    /* Match either height override so the preview button tracks the trigger. */
    block-size: var(
      --lr-voice-picker-trigger-height,
      var(
        --lr-voice-picker-trigger-min-height,
        max(var(--lr-icon-button-size), var(--lr-form-control-height))
      )
    );
    ${iconHitTarget}
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
    ${focusRing}
  }
  [part='preview-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='preview-button'][data-playing] {
    border-color: var(--lr-voice-picker-preview-active-border, var(--lr-color-brand));
    color: var(--lr-voice-picker-preview-active-color, var(--lr-color-brand));
  }

  [part='listbox'][hidden] {
    display: none;
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-block-size: min(var(--lr-size-18rem), var(--lr-positioner-available-block-size, var(--lr-size-18rem)));
    overflow-y: auto;
    /* Prevent a horizontal scrollbar when rounding the popup width. */
    overflow-x: hidden;
    inline-size: max-content;
    min-inline-size: min(var(--lr-size-12rem), var(--lr-positioner-available-inline-size, var(--lr-size-12rem)));
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem), var(--lr-positioner-available-inline-size, 100vw));
    padding: var(--lr-space-xs);
    ${overlaySurfaceFill}
    ${overlaySurfaceControlEdge}
    border-radius: var(
      --lr-voice-picker-radius,
      var(--lr-overlay-radius, var(--_lr-voice-picker-radius-default))
    );
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
    ${anchoredPopupReveal}
  }
  :host([open]) [part='listbox'] {
    ${anchoredPopupOpen}
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
  /* Interaction backgrounds take priority over selection. */
  [part='option']:where(:not([aria-disabled='true'])):hover,
  [part='option'][data-active] {
    background: var(--lr-voice-picker-option-active-bg, var(--lr-color-brand-quiet));
  }
  [part='option']:where(:not([aria-disabled='true'])):active {
    background: color-mix(
      in oklab,
      var(--lr-voice-picker-option-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  /* A voice can still be previewed when selection is disabled. */
  [part='option'][aria-disabled='true'] {
    cursor: default;
    opacity: var(--lr-voice-picker-option-disabled-opacity, var(--lr-opacity-disabled));
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
  [part='option']:where(:not([aria-disabled='true'])):hover [part='option-meta'],
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
    ${iconHitTarget}
    border-radius: var(--lr-voice-picker-radius, var(--_lr-voice-picker-radius-default));
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  [part='option-preview']:hover {
    background: var(--lr-voice-picker-preview-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-voice-picker-preview-hover-color, var(--lr-color-brand));
  }
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
    overflow-wrap: anywhere;
  }

  [part='error'] {
    overflow-wrap: anywhere;
  }

  ${glassScrollLayerStyles}
  ${glassIndependentRootStyles}
  ${glassSurface('[part="listbox"]', css`var(--lr-overlay-surface, var(--_lr-overlay-surface, var(--lr-color-surface-container-high)))`, undefined, true)}
`;
