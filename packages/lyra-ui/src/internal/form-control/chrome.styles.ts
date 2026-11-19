import { css } from 'lit';
import { formControlLabelDisplay, formControlLabelTypography, formControlSupportingText } from '../form-control.styles.js';

/** Field label and supporting text; component-specific layout remains in the adopting sheet. */
export const formControlChrome = css`
  [part~='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    ${formControlLabelTypography()}
  }
  [part~='form-control-label'][hidden] { display: none; }
  ${formControlSupportingText}
  ${formControlLabelDisplay}
`;
