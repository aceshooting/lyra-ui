import { activeFill, disabledControl, focusRingShorthand, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { dropzoneSizeLadder, dropzoneVerdictForcedColors } from '../../../internal/dropzone.styles.js';
import {
  formControlLabelTypography,
  formControlFocusHalo,
  formControlRequiredMarker,
  formControlSupportingColor,
} from '../../../internal/form-control.styles.js';

export const styles = css`
  ${dropzoneSizeLadder}
  :host {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    max-inline-size: 100%;
    --_lr-file-input-font-size: var(--lr-form-control-font-size);
    --_lr-file-input-detail-font-size: var(--lr-font-size-sm);
    --_lr-form-control-focus-shadow: var(--lr-form-control-focus-shadow, none);
  }
  :host([size="2xs"]),
  :host([size="xs"]) {
    --_lr-file-input-detail-font-size: var(--lr-font-size-2xs);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-file-input-detail-font-size: var(--lr-font-size-xs);
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-file-input-detail-font-size: var(--lr-font-size-md-sm);
  }
  :host([size="xl"]) {
    --_lr-file-input-detail-font-size: var(--lr-font-size-m);
  }
  [part="form-control"] {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Flex allocation preserves the intrinsic height in auto-sized grids and shares a definite
       host height with labels, selected files and feedback before growing the dropzone. */
  }
  [part~="form-control-label"] {
    ${formControlLabelTypography({ size: css`var(--lr-file-input-font-size, var(--_lr-file-input-font-size))` })}
    display: block;
    min-inline-size: 0;
    margin-block-end: var(--lr-space-xs);
    overflow-wrap: anywhere;
  }
  [part~="form-control-label"][hidden],
  [part="hint"][hidden],
  [part="error"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}
  .dropzone {
    position: relative;
    display: grid;
    flex: 1;
    min-inline-size: 0;
  }
  [part~="file-input"] {
    grid-area: 1 / 1;
    inline-size: 100%;
    ${iconHitTarget}
    box-sizing: border-box;
    font: inherit;
    cursor: pointer;
    appearance: none;
    padding: var(
      --lr-file-input-dropzone-padding,
      var(--_lr-dropzone-padding)
    );
    border: var(--lr-border-width-medium) dashed
      var(--lr-file-input-dropzone-border-color, var(--lr-color-border));
    border-radius: var(--lr-file-input-radius, var(--lr-radius));
    background: var(--lr-file-input-dropzone-fill, var(--lr-color-surface));
    color: var(--lr-color-text-quiet);
    font-size: var(
      --lr-file-input-dropzone-font-size,
      var(--_lr-dropzone-font-size)
    );
    transition: border-color var(--lr-transition-fast), background-color var(--lr-transition-fast);
  }
  .dropzone-content {
    grid-area: 1 / 1;
    z-index: var(--lr-layer-content);
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--lr-file-input-gap, var(--lr-space-xs));
    padding: var(
      --lr-file-input-dropzone-padding,
      var(--_lr-dropzone-padding)
    );
    color: var(--lr-color-text-quiet);
    text-align: center;
    font-size: var(
      --lr-file-input-dropzone-font-size,
      var(--_lr-dropzone-font-size)
    );
    overflow-wrap: anywhere;
    pointer-events: none;
  }
  [part="dropzone-icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(
      --lr-file-input-dropzone-icon-size,
      var(--_lr-dropzone-icon-size)
    );
  }
  [part="dropzone-text"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  ::slotted(*) {
    max-inline-size: 100%;
    min-inline-size: 0;
    pointer-events: auto;
  }
  :host(:is([size='s'], [size='small'])) [part~='file-input'],
  :host(:is([size='s'], [size='small'])) .dropzone-content {
    padding: var(--lr-file-input-compact-padding,
      var(--lr-file-input-dropzone-padding, var(--_lr-dropzone-padding)));
    font-size: var(--lr-file-input-compact-font-size,
      var(--lr-file-input-dropzone-font-size, var(--_lr-dropzone-font-size)));
  }
  :host(:is([size='s'], [size='small'])) .dropzone-content {
    gap: var(--lr-file-input-compact-gap, var(--lr-file-input-gap, var(--lr-space-xs)));
  }
  [part~="file-input"][data-drag-state="accept"] {
    border-color: var(
      --lr-file-input-accept-border-color,
      var(--lr-color-success)
    );
    background: var(
      --lr-file-input-accept-bg,
      color-mix(in srgb, var(--lr-color-success) 8%, transparent)
    );
  }
  [part~="file-input"][data-drag-state="reject"] {
    border-color: var(
      --lr-file-input-reject-border-color,
      var(--lr-color-danger)
    );
    background: var(
      --lr-file-input-reject-bg,
      color-mix(in srgb, var(--lr-color-danger) 8%, transparent)
    );
  }
  ${dropzoneVerdictForcedColors('[part~="file-input"]')}
  :host(:not(:disabled)) [part~="file-input"]:hover,
  :host(:not(:disabled)) .dropzone:hover [part~="file-input"] {
    border-color: var(--lr-file-input-dropzone-hover-border-color, var(--lr-color-brand));
  }
  :host(:not(:disabled)) [part~="file-input"]:active,
  :host(:not(:disabled)) .dropzone:active [part~="file-input"] {
    border-color: var(
      --lr-file-input-dropzone-active-border-color,
      var(--lr-file-input-dropzone-hover-border-color, var(--lr-color-brand))
    );
    background: var(
      --lr-file-input-dropzone-active-bg,
      ${activeFill('var(--lr-file-input-dropzone-fill, var(--lr-color-surface))')}
    );
  }
  [part~="file-input"]:focus-visible {
    ${focusRingShorthand}
  }
  /* The opt-in focus halo, on :focus rather than :focus-visible: the outline above is the
     accessibility answer to KEYBOARD focus and is untouched, while a halo a consumer deliberately
     configured should read on a pointer focus too. Unset it resolves to none. */
  [part~="file-input"]:focus {
    ${formControlFocusHalo}
  }
  :host(:disabled) [part~="file-input"] {
    ${disabledControl}
  }
  [part="rejection"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block: var(--lr-space-2xs) 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-file-input-detail-font-size, var(--_lr-file-input-detail-font-size));
    text-align: start;
    overflow-wrap: anywhere;
  }
  [part="rejection"] ul {
    margin: 0;
    padding-inline-start: var(--lr-space-m);
  }
  [part="file-list"] {
    display: grid;
    gap: var(--lr-space-xs);
    margin-block-start: var(--lr-space-xs);
  }
  [part="file-more"] {
    color: var(--lr-color-text-quiet);
    font-size: var(--_lr-file-input-detail-font-size);
  }
  [part="file"] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-file-input-file-border-color, var(--lr-color-border-subtle));
    border-radius: var(--lr-file-input-file-radius, var(--lr-radius));
    background: var(--lr-file-input-file-bg, var(--lr-color-surface-raised));
  }
  [part="file-thumbnail"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-file-input-thumbnail-size, var(--lr-icon-button-size));
    block-size: var(--lr-file-input-thumbnail-size, var(--lr-icon-button-size));
    overflow: hidden;
    border-radius: var(--lr-file-input-thumbnail-radius, var(--lr-radius-xs));
    color: var(--lr-color-text-quiet);
  }
  [part="file-image"] {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  [part="file-icon"] {
    display: inline-flex;
    font-size: var(--lr-font-size-xl);
  }
  [part="file-details"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part="file-name"] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lr-color-text);
    font-size: var(--lr-file-input-font-size, var(--_lr-file-input-font-size));
  }
  [part="file-size"] {
    color: var(--lr-color-text-quiet);
    font-size: var(
      --lr-file-input-detail-font-size,
      var(--_lr-file-input-detail-font-size)
    );
  }
  [part="remove-button"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    ${iconHitTarget}
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part="remove-button"]:hover:where(:not(:disabled)) {
    background: var(--lr-file-input-remove-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-color-text);
  }
  [part="remove-button"]:active:where(:not(:disabled)) {
    background: var(--lr-file-input-remove-active-bg, ${activeFill('var(--lr-file-input-remove-hover-bg, var(--lr-color-brand-quiet))')});
  }
  [part="remove-button"]:focus-visible {
    ${focusRingShorthand}
  }
  [part="remove-button"]:disabled {
    ${disabledControl}
  }
  ${formControlSupportingColor}
  [part="hint"] {
    min-inline-size: 0;
    margin-block-start: var(--lr-space-xs);
    font-size: var(
      --lr-file-input-detail-font-size,
      var(--_lr-file-input-detail-font-size)
    );
    overflow-wrap: anywhere;
  }
  [part="error"] {
    min-inline-size: 0;
    margin-block-start: var(--lr-space-xs);
    font-size: var(
      --lr-file-input-detail-font-size,
      var(--_lr-file-input-detail-font-size)
    );
    overflow-wrap: anywhere;
  }
`;
