import { css } from 'lit';
export const styles = css`
  :host { display: block; min-inline-size: 0; max-inline-size: 100%; }
  [part='base'] { display: grid; gap: var(--lr-space-m); min-inline-size: 0; }
  [part='heading'] { margin: 0; font-size: var(--lr-font-size-lg); overflow-wrap: anywhere; }
  [part='message'], [part='requester'], [part='status'], [part='error'] { margin: 0; overflow-wrap: anywhere; }
  [part='status'], [part='requester'] { color: var(--lr-color-text-quiet); }
  [part='error'] { color: var(--lr-color-danger); }
  [part='actions'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); }
  [part='action'] { max-inline-size: 100%; overflow-wrap: anywhere; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); padding: var(--lr-space-xs) var(--lr-space-m); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius-button); background: var(--lr-color-surface); color: var(--lr-color-text); font: inherit; cursor: pointer; }
  [part='action']:where(:not(:disabled)):hover { background: var(--lr-color-surface-raised); }
  [part='action']:where(:not(:disabled)):active { background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active)); }
  [part='action']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='action']:disabled { cursor: not-allowed; opacity: var(--lr-opacity-disabled); }
  [part='action'] { transition: background-color var(--lr-transition-fast), border-color var(--lr-transition-fast); }
  @media (prefers-reduced-motion: reduce) { [part='action'] { transition: none; } }
`;
