import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    /* The group's own chrome rides the shared size ladder (internal/sizes.styles.ts). Both gaps are
       fractions of the tier's control height rather than fixed space tokens, so they stay in
       proportion to the options beside them; at the default "m" tier they resolve to exactly the
       --lr-space-xs / --lr-space-s the group shipped with before it had a size at all. */
    --lr-checkbox-group-row-gap: calc(var(--lr-form-control-height) * 0.1);
    --lr-checkbox-group-option-gap: calc(var(--lr-form-control-height) * 0.2);
    display: block;
  }
  [part='form-control'] { display: grid; gap: var(--lr-checkbox-group-row-gap); }
  /* The rendered legend's real part is "form-control-label" (see checkbox-group.class.ts's
     render()), not "label" -- this must match it exactly or the rule is dead code. */
  [part~='form-control-label'] { font-weight: var(--lr-font-weight-semibold); color: var(--lr-color-text); font-size: var(--lr-form-control-font-size); }
  /* The required marker comes from the one shared sheet (internal/form-control.styles.ts) like
     every other labelled control's, so its glyph, colour and spacing are consumer-settable. The
     rule below suppresses this component's older hand-rolled glyph -- a literal <span> the legend
     template still renders -- so the two never double up; it is dead the moment that span is
     dropped from checkbox-group.class.ts's render(). */
  :host([required]) [part~='form-control-label'] > span[aria-hidden='true'] {
    display: none;
  }
  ${formControlRequiredMarker}
  [part~='options'] {
    display: flex;
    flex-direction: column;
    gap: var(--gap, var(--lr-checkbox-group-option-gap));
  }
  :host([orientation='horizontal']) [part~='options'] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part~='options'] { padding: var(--lr-space-xs); border: var(--lr-border-width-thin) solid var(--lr-checkbox-group-invalid-border, var(--lr-color-danger)); border-radius: var(--lr-radius); }
  [part='form-control'],
  [part='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
