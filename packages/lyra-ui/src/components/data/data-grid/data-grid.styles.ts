import { css } from 'lit';
export const styles = css`
  :host { display: block; min-inline-size: 0; }
  [part='viewport'] { overflow: auto; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); }
  table { border-collapse: separate; border-spacing: 0; inline-size: max-content; min-inline-size: 100%; color: var(--lr-color-text); }
  th, td { box-sizing: border-box; padding: var(--lr-space-s); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); text-align: start; vertical-align: top; }
  th { position: sticky; inset-block-start: 0; z-index: var(--lr-layer-content); background: var(--lr-color-surface); font-weight: var(--lr-font-weight-semibold); }
  th button { border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  th button:hover { background: var(--lr-color-brand-quiet); }
  tr[data-selected='true'] td { background: var(--lr-data-grid-row-selected-bg, var(--lr-color-brand-quiet)); }
  [role='gridcell']:hover { background: var(--lr-color-brand-quiet); }
  [role='gridcell']:focus-visible, th button:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: calc(var(--lr-focus-ring-offset) * -1); }
  [part='empty'] { padding: var(--lr-space-l); color: var(--lr-color-text-quiet); text-align: center; }
`;
