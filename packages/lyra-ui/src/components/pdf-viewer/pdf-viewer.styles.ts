import { css } from 'lit';

export const styles = css`
  :host { display: block; --lyra-pdf-viewer-height: var(--lyra-size-24rem); }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); overflow: hidden; }
  [part='toolbar'] { display: flex; align-items: center; gap: var(--lyra-space-s); padding: var(--lyra-space-xs) var(--lyra-space-s); border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); background: var(--lyra-color-brand-quiet); font-size: var(--lyra-font-size-sm); flex-wrap: wrap; }
  [part='toolbar'] button { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lyra-icon-button-size); min-block-size: var(--lyra-icon-button-size); border: none; border-radius: var(--lyra-radius); background: transparent; color: var(--lyra-color-text); cursor: pointer; }
  [part='toolbar'] button:disabled { opacity: var(--lyra-opacity-disabled); cursor: default; }
  [part='toolbar'] button:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: var(--lyra-focus-ring-offset); }
  [part='page-indicator'], [part='zoom-indicator'] { color: var(--lyra-color-text); white-space: nowrap; }
  [part='pages'] { --lyra-virtual-list-height: var(--lyra-pdf-viewer-height); }
  [part='page'] { position: relative; display: flex; justify-content: center; padding-block: var(--lyra-space-m); min-inline-size: 0; }
  [part='page'] canvas { box-shadow: 0 0 0 var(--lyra-border-width-thin) var(--lyra-color-border); }
  [part='text-layer'] { position: absolute; inset-block-start: var(--lyra-space-m); inset-inline-start: 50%; overflow: hidden; line-height: 1; opacity: 1; pointer-events: none; }
  [part='text-layer'] ::selection { background: var(--lyra-color-brand-quiet); }
  .empty-note, [part='error'] { margin: 0; padding: var(--lyra-space-l); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); text-align: center; }
  [part='error'] { color: var(--lyra-color-danger); }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
