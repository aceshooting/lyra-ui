import { css } from 'lit';
import { formControlLabelPlacement } from '../../../internal/form-control/chrome.styles.js';
import { formControlLabelDisplay, formControlLabelTypography, formControlRequiredMarker, formControlSupportingTone } from '../../../internal/form-control.styles.js';

export const groupStyles = css`
  :host {
    /* The group's own chrome rides the shared size ladder (internal/sizes.styles.ts): the row gap
       and the option gap are fractions of the tier's control height, not fixed space tokens, so
       they stay in proportion to the options beside them (same split as the checkbox group). */
    --_lr-radio-group-row-gap: calc(var(--lr-form-control-height) * 0.1);
    --_lr-radio-group-option-gap: calc(var(--lr-form-control-height) * 0.2);
    display: block;
  }
  [part="base"] {
    display: block;
  }
  [part="form-control"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-radio-group-row-gap, var(--_lr-radio-group-row-gap));
  }
  [part~="label"] {
    ${formControlLabelTypography({ size: css`var(--lr-form-control-font-size)`, color: css`var(--lr-color-text)` })}
    /* --lr-form-control-label-gap replaces the row gap under the label; unset, the margin is zero. */
    margin-block-end: calc(
      var(--lr-form-control-label-gap, var(--lr-radio-group-row-gap, var(--_lr-radio-group-row-gap))) -
        var(--lr-radio-group-row-gap, var(--_lr-radio-group-row-gap))
    );
  }
  [part~="label"][hidden],
  [part~="hint"][hidden],
  [part="error"][hidden] {
    display: none;
  }
  ${formControlLabelDisplay}
  ${formControlRequiredMarker}
  [part~='radios'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-radio-group-option-gap, var(--_lr-radio-group-option-gap));
  }
  :host([orientation="horizontal"]) [part~="radios"] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
  ${formControlSupportingTone}
  ${formControlLabelPlacement}
  /* label-placement="start": the toolbar leaves the label row and follows the options. */
  :host([label-placement='start']) [part='toolbar'] {
    order: 1;
    flex: 0 0 100%;
    box-sizing: border-box;
  }
  :host([label-placement='start']) [part='form-control'] > :is([part~='hint'], [part='error']) { order: 2; }
  :host([label-placement='start']:not([label-display='hidden']))
    [part='form-control']:has(> [part~='label']:not([hidden]))
    > [part='toolbar'] {
    padding-inline-start: clamp(
      0px,
      (100% - var(--_lr-label-collapse)) * 9999,
      var(--_lr-label-column) + var(--_lr-label-gap)
    );
  }
  :host(:state(user-invalid)) [part~="radios"] {
    outline: var(--lr-border-width-thin) solid
      var(--lr-radio-group-invalid-border-color, var(--lr-form-control-invalid-border-color, var(--lr-color-danger)));
    border-radius: var(--lr-radius);
  }
  :host(:disabled) [part~="label"],
  :host(:disabled) [part~="hint"],
  :host(:disabled) [part="error"] {
    opacity: var(--lr-opacity-disabled);
  }
  [part="base"],
  [part="form-control"],
  [part~="label"],
  [part~="radios"],
  [part~="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: break-word;
  }
`;
