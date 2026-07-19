import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='form-control'] { display: grid; gap: var(--lr-space-xs); }
  [part='label'] { font-weight: var(--lr-font-weight-semibold); color: var(--lr-color-text); }
  [part='label']::after { content: '*'; margin-inline-start: var(--lr-space-2xs); color: var(--lr-color-danger); }
  [part='options'] { display: grid; gap: var(--lr-space-s); }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part='options'] { padding: var(--lr-space-xs); border: var(--lr-border-width-thin) solid var(--lr-color-danger); border-radius: var(--lr-radius); }
`;
