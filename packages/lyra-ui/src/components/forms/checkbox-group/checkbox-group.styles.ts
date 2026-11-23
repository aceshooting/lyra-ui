import { css } from 'lit';
import { formControlLabelPlacement } from '../../../internal/form-control/chrome.styles.js';
import { formControlLabelDisplay, formControlLabelTypography, formControlRequiredMarker, formControlSupportingTone } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    /* The group's chrome rides the shared size ladder (internal/sizes.styles.ts). Both gaps are
       fractions of the tier's control height rather than fixed space tokens, so they stay in
       proportion to the options beside them. */
    --_lr-checkbox-group-row-gap: calc(var(--lr-form-control-height) * 0.1);
    --_lr-checkbox-group-option-gap: calc(var(--lr-form-control-height) * 0.2);
    display: block;
  }
  fieldset {
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    padding: 0;
  }
  [part="form-control"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-checkbox-group-row-gap, var(--_lr-checkbox-group-row-gap));
  }
  /* The rendered legend's real part is "form-control-label" (checkbox-group.class.ts's render()),
     not "label" -- this must match it exactly or the rule is dead code. */
  [part~="form-control-label"] {
    ${formControlLabelTypography({ size: css`var(--lr-form-control-font-size)`, color: css`var(--lr-color-text)` })}
    /* The rendered legend sits outside the flex gap, so the label gap is its whole margin. */
    margin-block-end: var(--lr-form-control-label-gap, 0);
  }
  ${formControlLabelDisplay}
  ${formControlRequiredMarker}
  [part~='options'] {
    display: flex;
    flex-direction: column;
    --_lr-checkbox-group-gap: var(
      --gap,
      var(--lr-checkbox-group-option-gap, var(--_lr-checkbox-group-option-gap))
    );
    row-gap: var(--lr-checkbox-group-option-row-gap, var(--_lr-checkbox-group-gap));
    column-gap: var(--lr-checkbox-group-option-column-gap, var(--_lr-checkbox-group-gap));
  }
  :host([orientation="horizontal"]) [part~="options"] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
  ${formControlSupportingTone}
  ${formControlLabelPlacement}
  /* label-placement="start": the toolbar leaves the label row and follows the options. (The label is
     a plain element in this mode; see render().) */
  :host([label-placement='start']) [part='toolbar'],
  :host([label-placement='start']) [part='form-control'] > [part~='hint'],
  :host([label-placement='start']) [part='form-control'] > [part='error'] { order: 2; }
  :host([label-placement='start']) [part='toolbar'] {
    order: 1;
    flex: 0 0 100%;
    box-sizing: border-box;
  }
  :host([label-placement='start']:not([label-display='hidden']))
    [part='form-control']:has(> [part~='form-control-label']:not([hidden]))
    > [part='toolbar'] {
    padding-inline-start: clamp(
      0px,
      (100% - var(--_lr-label-collapse)) * 9999,
      var(--_lr-label-column) + var(--_lr-label-gap)
    );
  }
  :host([data-invalid]) [part~="options"] {
    outline: var(--lr-border-width-thin) solid
      var(--lr-checkbox-group-invalid-border-color, var(--lr-form-control-invalid-border-color, var(--lr-color-danger)));
    border-radius: var(--lr-radius);
  }
  [part="form-control"],
  [part="form-control-label"],
  [part~="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: break-word;
  }
  /* :host(:disabled), never :host([disabled]) -- on a form-associated custom element the UA
     computes :disabled from the group's own disabled attribute OR an ancestor fieldset's cascade,
     exactly what effectiveDisabled already gates the options on; the attribute selector matched
     only the first. Dimming lands on the three chrome parts the GROUP renders itself, not the host:
     every owned <lr-checkbox> already dims itself, and a host-level opacity would multiply with
     that, pushing the options to a quarter of full contrast. */
  :host(:disabled) [part~="form-control-label"],
  :host(:disabled) [part~="hint"],
  :host(:disabled) [part="error"] {
    opacity: var(--lr-opacity-disabled);
  }
`;
