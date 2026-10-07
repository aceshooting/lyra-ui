import { css } from 'lit';
export const styles = css`
  :host { display: block; min-inline-size: 0; max-inline-size: 100%; }
  [part='base'] { display: grid; gap: var(--lr-space-m); min-inline-size: 0; }
  [part='heading'] { margin: 0; font-size: var(--lr-font-size-lg); font-weight: var(--lr-font-weight-bold); overflow-wrap: anywhere; }
  [part='file'] { min-inline-size: 0; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius-container); }
  [part='file-header'] { min-inline-size: var(--lr-icon-button-size); padding: var(--lr-space-s); min-block-size: var(--lr-icon-button-size); box-sizing: border-box; font-weight: var(--lr-font-weight-semibold); overflow-wrap: anywhere; cursor: pointer; }
  [part='file-header']:hover { background: var(--lr-color-surface-raised); }
  [part='file-header']:active { background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active)); }
  [part='file-header']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='previous-path'] { display: block; color: var(--lr-color-text-quiet); font-weight: var(--lr-font-weight-normal); }
  [part='hunk'] { min-inline-size: 0; padding: var(--lr-space-s); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='hunk-header'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-s); justify-content: space-between; overflow-wrap: anywhere; margin-block-end: var(--lr-space-s); }
  [part='status'], [part='empty'], [part='limit'] { color: var(--lr-color-text-quiet); }
  [part='actions'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); margin-block-start: var(--lr-space-s); }
  [part='file-header'] { transition: background-color var(--lr-transition-fast), border-color var(--lr-transition-fast); }
  @media (prefers-reduced-motion: reduce) { [part='file-header'] { transition: none; } }
`;
