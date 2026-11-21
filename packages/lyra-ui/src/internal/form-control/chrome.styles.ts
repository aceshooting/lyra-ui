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
 * The label aligns to the top of the field, centred on its first form-control-height line, so it
 * sits level with a single-line field and with the first line of a tall one (a textarea, a code
 * editor, a signature pad). A hidden or absent label leaves the hint and error unindented, under
 * the field that then spans the row.
 *
 * The wrapper's direct children are the label, the field, and full-width rows: `hint`, `error`
 * and any other status row a control renders beside them, marked `data-form-control-row` so it
 * wraps under the field like the hint instead of taking a column of its own.
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
    align-items: flex-start;
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
    padding-block-start: clamp(
      0px,
      (100% - var(--_lr-label-collapse)) * 9999,
      max(0px, (var(--lr-form-control-height, var(--lr-size-2-5rem)) - 1lh) / 2)
    );
  }
  :host([label-placement='start']) [part~='form-control'] > :is([part~='hint'], [part~='error'], [data-form-control-row]) {
    flex: 0 0 100%;
    box-sizing: border-box;
  }
  :host([label-placement='start']:not([label-display='hidden']))
    [part~='form-control']:has(> [part~='form-control-label']:not([hidden]))
    > :is([part~='hint'], [part~='error'], [data-form-control-row]) {
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
