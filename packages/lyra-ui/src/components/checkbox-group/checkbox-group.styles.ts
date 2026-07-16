import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='form-control'] { display: grid; gap: var(--lyra-space-xs); }
  [part='label'] { font-weight: 600; color: var(--lyra-color-text); }
  [part='label']::after { content: '*'; margin-inline-start: var(--lyra-space-2xs); color: var(--lyra-color-danger); }
  [part='options'] { display: grid; gap: var(--lyra-space-s); }
  [part='hint'], [part='error'] { color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); }
  [part='error'] { color: var(--lyra-color-danger); }
  :host([data-invalid]) [part='options'] { padding: var(--lyra-space-xs); border: var(--lyra-border-width-thin) solid var(--lyra-color-danger); border-radius: var(--lyra-radius); }
`;
