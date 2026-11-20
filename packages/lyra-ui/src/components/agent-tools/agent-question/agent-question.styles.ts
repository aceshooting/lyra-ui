import { css } from 'lit';
import { focusRing } from '../../../internal/interactive-control.styles.js';
import { blockHost } from '../../../internal/layout-fragments.styles.js';
export const styles = css`
  :host { ${blockHost} }
  [part='base'] { display: grid; gap: var(--lr-space-m); min-inline-size: 0; }
  [part='heading'] { margin: 0; font-size: var(--lr-font-size-lg); font-weight: var(--lr-font-weight-bold); overflow-wrap: anywhere; }
  [part='message'], [part='requester'], [part='status'], [part='error'] { margin: 0; overflow-wrap: anywhere; }
  [part='status'], [part='requester'] { color: var(--lr-color-text-quiet); }
  /* no-hover-state: the read-only status only receives focus programmatically. */
  [part='status']:focus-visible { ${focusRing} }
  [part='error'] { color: var(--lr-color-danger); }
  [part='actions'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); }
`;
