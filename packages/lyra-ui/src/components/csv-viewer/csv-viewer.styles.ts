import { css } from 'lit';

export const styles = css`
  :host { display: block; min-inline-size: 0; }
  [part='base'], [part='sheet'] { display: flex; flex-direction: column; min-inline-size: 0; }
  [part='sheet'] { overflow-x: auto; }
  [part='header-row'], [part='data-row'] { display: grid; min-inline-size: max-content; align-items: center; }
  [part='header-row'] { position: sticky; inset-block-start: 0; z-index: var(--lyra-layer-content); background: var(--lyra-color-surface); color: var(--lyra-color-text); font-weight: var(--lyra-font-weight-semibold); border-block-end: var(--lyra-border-width-medium) solid var(--lyra-color-border); }
  [part='cell'] { padding: var(--lyra-space-2xs) var(--lyra-space-xs); border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--lyra-font-size-sm); color: var(--lyra-color-text); }
  [part='rows'] { --lyra-virtual-list-height: var(--lyra-size-20rem); min-inline-size: max-content; }
  .empty-note, [part='error'] { margin: 0; padding: var(--lyra-space-m); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  [part='error'] { color: var(--lyra-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
