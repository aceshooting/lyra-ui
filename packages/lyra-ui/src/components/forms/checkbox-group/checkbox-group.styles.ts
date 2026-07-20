import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='form-control'] { display: grid; gap: var(--lr-space-xs); }
  /* The rendered legend's real part is "form-control-label" (see checkbox-group.class.ts's
     render()), not "label" -- this must match it exactly or the rule is dead code. */
  [part='form-control-label'] { font-weight: var(--lr-font-weight-semibold); color: var(--lr-color-text); }
  /* Deliberately NOT re-targeted to [part='form-control-label'] alongside the rule above: the
     required marker is already rendered as a real DOM child (the template's own aria-hidden
     asterisk span, appended after the label content only when required), so making this ::after
     match too would render a second, always-visible asterisk stacked right after it regardless of
     required. Left inert on purpose -- remove entirely if the manual span is ever replaced with
     this content-based marker instead. */
  [part='label']::after { content: '*'; margin-inline-start: var(--lr-space-2xs); color: var(--lr-color-danger); }
  [part='options'] { display: grid; gap: var(--lr-space-s); }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part='options'] { padding: var(--lr-space-xs); border: var(--lr-border-width-thin) solid var(--lr-color-danger); border-radius: var(--lr-radius); }
`;
