import { css } from 'lit';
export const styles = css`
  :host { display: block; container-type: inline-size; }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lr-space-m); }
  [part='answer'] { min-inline-size: 0; }
  [part='citations'], [part='sources'] { display: flex; flex-direction: column; gap: var(--lr-space-xs); }
  [part='section-heading'] { margin: 0; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); font-weight: var(--lr-font-weight-semibold); }
  [part='citation-list'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-2xs); align-items: center; }
  [part='error'] { color: var(--lr-color-danger); }
  [part='retry'] { align-self: flex-start; }
  @container (max-inline-size: 319.98px) { [part='base'] { gap: var(--lr-space-s); } }
`;
