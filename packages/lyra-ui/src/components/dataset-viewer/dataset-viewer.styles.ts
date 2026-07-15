import { css } from 'lit';

export const styles = css`
  :host { display: block; --lyra-dataset-viewer-max-height: none; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); overflow: hidden; }
  [part='body'] { box-sizing: border-box; overflow: auto; max-block-size: var(--lyra-dataset-viewer-max-height); }
  [part='table'] { inline-size: 100%; border-collapse: collapse; font-size: var(--lyra-font-size-sm); }
  [part='table'] th, [part='table'] td { padding: var(--lyra-space-xs) var(--lyra-space-s); border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); text-align: start; white-space: nowrap; }
  [part='table'] th { position: sticky; inset-block-start: 0; background: var(--lyra-color-brand-quiet); color: var(--lyra-color-text); font-weight: var(--lyra-font-weight-semibold); }
  .empty-note, [part='error'] { margin: 0; padding: var(--lyra-space-m); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  [part='error'] { padding: var(--lyra-space-l); color: var(--lyra-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
