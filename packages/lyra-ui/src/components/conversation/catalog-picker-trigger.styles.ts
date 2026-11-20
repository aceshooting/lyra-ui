import { activeFill, disabledControl, focusRing } from '../../internal/interactive-control.styles.js';
import { css, unsafeCSS, type CSSResult } from 'lit';
import { glassSurface } from '../../internal/glass-surface.styles.js';
import { glassScrollLayerStyles } from '../../internal/glass-scroll-layer.styles.js';
import { glassIndependentRootStyles } from '../../internal/glass-independent-root.styles.js';
import { formControlFocusHalo, formControlRequiredMarker } from '../../internal/form-control.styles.js';
import { formControlChrome } from '../../internal/form-control/chrome.styles.js';
import {
  anchoredPopupOpen,
  anchoredPopupReveal,
  overlaySurfaceFill,
  overlaySurfaceControlEdge,
} from '../../internal/overlay-surface.styles.js';

/** The provider badge and truncating label every catalog-picker trigger shares. */
const catalogPickerTriggerLabel = css`
  [part='provider-badge'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-inline-end: var(--lr-space-xs);
    margin-inline-end: var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
`;

/** Builds the common control and option rules with each picker's own token namespace. */
export function catalogPickerStyles(
  component: 'model-select' | 'voice-picker',
  triggerLayout: CSSResult,
  localStyles: CSSResult,
): CSSResult {
  // Public hooks are written with the picker's own `--lr-<component>-` prefix directly.
  const hook = unsafeCSS(`--lr-${component}-`);
  const styles = css`
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
      max-inline-size: var(${hook}max-inline-size, var(--lr-size-24rem));
      --_lr-picker-trigger-padding: var(--lr-form-control-padding-block)
        var(--lr-form-control-padding-inline);
      --_lr-picker-trigger-min-height: var(--lr-form-control-height);
      --_lr-picker-font-size: var(--lr-form-control-font-size);
      --_lr-picker-expand-size: var(--lr-size-1-75rem);
      --_lr-picker-gap-default: var(--lr-space-xs);
      --_lr-picker-radius-default: var(--lr-form-control-radius);
      --_lr-form-control-focus-shadow: var(--lr-form-control-focus-shadow, none);
    }
    :host(:disabled) {
      cursor: not-allowed;
    }
    :host([size="2xs"]),
    :host([size="xs"]) {
      --_lr-picker-expand-size: var(--lr-size-1rem);
    }
    :host([size="s"]),
    :host([size="small"]) {
      --_lr-picker-expand-size: var(--lr-size-1-25rem);
    }

    ${formControlChrome}

    ${formControlRequiredMarker}

    [part='trigger'],
    [part='combobox'] {
      display: flex;
      align-items: center;
      gap: var(${hook}gap, var(--_lr-picker-gap-default));
      ${triggerLayout}
      min-inline-size: 0;
      min-block-size: var(${hook}trigger-height, var(${hook}trigger-min-height, var(--_lr-picker-trigger-min-height)));
      block-size: var(${hook}trigger-height, auto);
      box-sizing: border-box;
      padding: var(${hook}trigger-padding, var(--_lr-picker-trigger-padding));
      border: var(--lr-border-width-thin) solid
        var(${hook}trigger-border-color, var(--lr-color-border));
      border-radius: var(${hook}radius, var(--_lr-picker-radius-default));
      background: var(${hook}trigger-fill, var(--lr-color-surface));
      color: inherit;
      font: inherit;
      font-size: var(${hook}font-size, var(--_lr-picker-font-size));
    }
    [part='trigger'] {
      cursor: pointer;
      text-align: start;
    }
    [part='combobox'] {
      cursor: text;
    }
    [part='trigger']:focus-visible,
    [part='combobox']:focus-within {
      ${focusRing}
    }
    [part='trigger']:focus,
    [part='combobox']:focus-within {
      ${formControlFocusHalo}
    }
    :where([part='trigger']):hover:where(:not(:disabled)) {
      background: var(${hook}trigger-hover-bg, var(--lr-color-brand-quiet));
      border-color: var(${hook}trigger-hover-border-color, var(${hook}trigger-border-color, var(--lr-color-border)));
    }
    :where([part='trigger']):active:where(:not(:disabled)) {
      background: var(${hook}trigger-active-bg,
        ${activeFill('var(${hook}trigger-hover-bg, var(--lr-color-brand-quiet))')});
    }
    :host([open]) [part='trigger'] {
      border-color: var(${hook}open-border-color, var(--lr-color-brand));
    }
    :host(:disabled) [part='trigger'],
    :host(:disabled) [part='combobox'] {
      ${disabledControl}
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
      min-inline-size: min(
        var(--lr-icon-button-size),
        var(${hook}expand-size, var(--_lr-picker-expand-size))
      );
      min-block-size: min(
        var(--lr-icon-button-size),
        var(${hook}expand-size, var(--_lr-picker-expand-size))
      );
      line-height: var(--lr-line-height-none);
    }
    [part='expand-icon'] svg {
      transform: rotate(90deg);
    }

    [part='listbox'][hidden] {
      display: none;
    }

    [part='listbox'] {
      position: fixed;
      z-index: var(--lr-overlay-stack-index, var(--lr-layer-dropdown));
      box-sizing: border-box;
      max-block-size: min(var(--lr-size-18rem), var(--lr-positioner-available-block-size, var(--lr-size-18rem)));
      overflow-y: auto;
      overflow-x: hidden;
      inline-size: max-content;
      min-inline-size: min(var(--lr-size-12rem), var(--lr-positioner-available-inline-size, var(--lr-size-12rem)));
      max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem), var(--lr-positioner-available-inline-size, 100vw));
      padding: var(--lr-space-xs);
      ${overlaySurfaceFill}
      ${overlaySurfaceControlEdge}
      border-radius: var(${hook}radius, var(--lr-overlay-radius, var(--_lr-picker-radius-default)));
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
      gap: var(${hook}gap, var(--_lr-picker-gap-default));
      inline-size: 100%;
      box-sizing: border-box;
      padding: var(--lr-space-xs) var(--lr-space-s);
      border: var(--lr-border-width-thin) solid transparent;
      border-radius: var(${hook}radius, var(--_lr-picker-radius-default));
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    [part='option'][aria-selected="true"] {
      background: var(${hook}option-selected-bg, transparent);
      border-color: var(${hook}option-selected-border, var(--lr-color-brand));
      color: var(${hook}option-selected-color, var(--lr-color-brand));
      font-weight: var(${hook}option-selected-font-weight, var(--lr-font-weight-semibold));
    }
    /* The selected option also needs the hover and keyboard-active background. */
    [part='option']:where(:not([aria-disabled='true'])):hover,
    [part='option'][data-active] {
      background: var(${hook}option-active-bg, var(--lr-color-brand-quiet));
    }
    [part='option']:where(:not([aria-disabled='true'])):active {
      background: ${activeFill('var(${hook}option-active-bg, var(--lr-color-brand-quiet))')};
    }
    [part='option'][aria-disabled='true'] {
      cursor: default;
      opacity: var(${hook}option-disabled-opacity, var(--lr-opacity-disabled));
    }
    [part='option'][data-synthetic] {
      border-style: var(${hook}option-synthetic-border-style, dashed);
      border-color: var(${hook}option-synthetic-border-color, var(--lr-color-border));
    }
    [part='option'][data-synthetic] [part='option-label'] {
      font-style: var(${hook}option-synthetic-font-style, italic);
    }
    [part='option-badge'] {
      flex: 0 0 auto;
      font-size: var(--lr-size-0-6875rem);
      font-style: normal;
      font-weight: var(--lr-font-weight-normal);
      color: var(--lr-color-text-quiet);
      white-space: nowrap;
    }

    [part='empty'] {
      padding: var(--lr-space-m);
      color: var(--lr-color-text-quiet);
      font-size: var(--lr-font-size-md-sm);
    }

    ${localStyles}

    ${glassScrollLayerStyles}
    ${glassIndependentRootStyles}
    ${glassSurface("[part='listbox']", css`var(--lr-overlay-surface, var(--_lr-overlay-surface, var(--lr-color-surface-container-high)))`, undefined, true)}
  `;
  const minimumHeight = component === 'voice-picker' ? 'trigger-min-height-default' : 'trigger-min-height';
  // Replace only the shared template's private placeholder namespace, leaving local hooks intact.
  return unsafeCSS(styles.cssText
    .replaceAll('--_lr-picker-trigger-min-height', `--_lr-${component}-${minimumHeight}`)
    .replaceAll('--_lr-picker-', `--_lr-${component}-`));
}
