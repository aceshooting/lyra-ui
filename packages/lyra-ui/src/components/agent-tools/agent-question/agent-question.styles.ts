import { css } from 'lit';
export const styles = css`
  :host { display: block; min-inline-size: 0; max-inline-size: 100%; }
  [part='base'] { display: grid; gap: var(--lr-space-m); min-inline-size: 0; }
  [part='heading'] { margin: 0; font-size: var(--lr-font-size-lg); font-weight: var(--lr-font-weight-bold); overflow-wrap: anywhere; }
  [part='message'], [part='requester'], [part='status'], [part='error'] { margin: 0; overflow-wrap: anywhere; }
  [part='status'], [part='requester'] { color: var(--lr-color-text-quiet); }
  [part='error'] { color: var(--lr-color-danger); }
  [part='actions'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); }
`;
