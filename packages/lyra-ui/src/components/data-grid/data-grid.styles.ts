import { css } from 'lit';
export const styles = css`
  :host { display: block; min-inline-size: 0; }
  [part='viewport'] { overflow: auto; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); }
  table { border-collapse: separate; border-spacing: 0; inline-size: max-content; min-inline-size: 100%; color: var(--lyra-color-text); }
  th, td { box-sizing: border-box; padding: var(--lyra-space-s); border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); text-align: start; vertical-align: top; }
  th { position: sticky; inset-block-start: 0; z-index: var(--lyra-layer-content); background: var(--lyra-color-surface); font-weight: var(--lyra-font-weight-semibold); }
  th button { border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  tr[data-selected='true'] td { background: var(--lyra-color-brand-quiet); }
  [role='gridcell']:focus-visible, th:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: calc(var(--lyra-focus-ring-offset) * -1); }
  [part='empty'] { padding: var(--lyra-space-l); color: var(--lyra-color-text-quiet); text-align: center; }
`;
