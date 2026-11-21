import { css } from 'lit';
import { formControlLabelDisplay, formControlLabelTypography, formControlSupportingText } from '../form-control.styles.js';

/**
 * The shared `label-placement="start"` layout: the label sits in an inline-start column of
 * `--lr-form-control-label-inline-size` (default `30%`), separated by `--lr-form-control-label-gap`,
 * and the hint and error stay aligned under the field. Once the control is narrower than
 * `--lr-form-control-label-collapse-inline-size` (default `20rem`) it falls back to the label above.
 *
 * The switch is pure arithmetic on the control's own width rather than a container query, so the
 * breakpoint is a themeable token and the host needs no size containment: `(collapse - 100%)`
 * scaled far past any real size is either negative (wide: clamp to the column) or huge (narrow:
 * clamp to the full row). Logical properties keep it correct under RTL.
 *
 * Interpolate it after `formControlChrome` only in a control that declares `labelPlacement`, so the
 * label-column tokens are advertised where they work.
 */
export const formControlLabelPlacement = css`
  :host([label-placement='start']) [part~='form-control'] {
    --_lr-label-column: var(--lr-form-control-label-inline-size, 30%);
    --_lr-label-gap: var(--lr-form-control-label-gap, var(--lr-space-m));
    --_lr-label-collapse: var(--lr-form-control-label-collapse-inline-size, var(--lr-size-20rem));
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--_lr-label-gap);
  }
  :host([label-placement='start']) [part~='form-control'] > :not([part~='form-control-label']) {
    flex: 1 1 0;
    min-inline-size: 0;
  }
  :host([label-placement='start']) [part~='form-control'] > [part~='form-control-label'] {
    flex: 0 0 clamp(var(--_lr-label-column), (var(--_lr-label-collapse) - 100%) * 9999, 100%);
    box-sizing: border-box;
    margin-block-end: clamp(0px, (var(--_lr-label-collapse) - 100%) * 9999, var(--lr-space-xs));
  }
  :host([label-placement='start']) [part~='form-control'] > :is([part~='hint'], [part~='error']) {
    flex: 0 0 100%;
    box-sizing: border-box;
    padding-inline-start: clamp(
      0px,
      (100% - var(--_lr-label-collapse)) * 9999,
      var(--_lr-label-column) + var(--_lr-label-gap)
    );
  }
`;

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
