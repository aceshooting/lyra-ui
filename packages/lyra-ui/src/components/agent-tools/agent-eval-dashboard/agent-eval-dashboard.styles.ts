import { css } from 'lit';
export const styles = css`
  :host { display: block; container-type: inline-size; }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lr-space-m); }
  [part='heading'], [part='runs-heading'] { margin: 0; font-size: var(--lr-font-size-lg); font-weight: var(--lr-font-weight-semibold); }
  [part='metrics'] { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--lr-size-10rem), 1fr)); gap: var(--lr-space-s); }
  [part='metric'], [part='chart'] { min-inline-size: 0; }
  [part='runs'] { display: flex; flex-direction: column; gap: var(--lr-space-xs); }
  [part='run'] { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--lr-space-xs); align-items: center; padding-block: var(--lr-space-xs); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); inline-size: 100%; background: transparent; color: var(--lr-color-text); font: inherit; text-align: start; cursor: pointer; }
  [part='run']:hover { background: var(--lr-color-surface-raised); }
  [part='run']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='run-label'] { min-inline-size: 0; overflow-wrap: anywhere; }
  [part='run-meta'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-2xs); align-items: center; justify-content: flex-end; }
  [part='empty'] { color: var(--lr-color-text-quiet); }
  @container (max-inline-size: 319.98px) { [part='metrics'] { grid-template-columns: 1fr; } [part='run'] { grid-template-columns: 1fr; } [part='run-meta'] { justify-content: flex-start; } }
`;
