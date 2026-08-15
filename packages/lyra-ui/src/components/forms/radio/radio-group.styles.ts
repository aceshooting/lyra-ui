import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const groupStyles = css`
  :host {
    /* The group's own chrome rides the shared size ladder (internal/sizes.styles.ts): the row gap is
       a fraction of the tier's control height rather than a fixed space token, so it stays in
       proportion to the options beside it. At the default "m" tier it resolves to exactly the
       --lr-space-s the group shipped with before it had a size at all. */
    --_lr-radio-group-row-gap: calc(var(--lr-form-control-height) * 0.2);
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
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-form-control-font-size);
  }
  [part~="label"][hidden],
  [part~="hint"][hidden],
  [part="error"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}
  [part~='radios'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-radio-group-row-gap, var(--_lr-radio-group-row-gap));
  }
  :host([orientation="horizontal"]) [part~="radios"] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
  [part~="hint"],
  [part="error"] {
    font-size: var(--lr-font-size-sm);
  }
  [part~="hint"] {
    color: var(--lr-color-text-quiet);
  }
  [part="error"] {
    color: var(--lr-color-danger);
  }
  [part="base"],
  [part="form-control"],
  [part~="label"],
  [part~="radios"],
  [part~="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
