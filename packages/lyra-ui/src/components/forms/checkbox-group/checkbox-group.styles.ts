import { css } from 'lit';

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
  [part='form-control-label'] { font-weight: var(--lr-font-weight-semibold); color: var(--lr-color-text); font-size: var(--lr-form-control-font-size); }
  /* Deliberately NOT re-targeted to [part='form-control-label'] alongside the rule above: the
     required marker is already rendered as a real DOM child (the template's own aria-hidden
     asterisk span, appended after the label content only when required), so making this ::after
     match too would render a second, always-visible asterisk stacked right after it regardless of
     required. Left inert on purpose -- remove entirely if the manual span is ever replaced with
     this content-based marker instead. */
  [part='label']::after { content: '*'; margin-inline-start: var(--lr-space-2xs); color: var(--lr-color-danger); }
  [part='options'] { display: grid; gap: var(--lr-checkbox-group-option-gap); }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part='options'] { padding: var(--lr-space-xs); border: var(--lr-border-width-thin) solid var(--lr-color-danger); border-radius: var(--lr-radius); }
  [part='form-control'],
  [part='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
