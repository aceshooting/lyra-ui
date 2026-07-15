import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); overflow: hidden; }
  [part='entry'] { display: flex; align-items: center; gap: var(--lyra-space-s); box-sizing: border-box; block-size: 100%; padding: var(--lyra-space-xs) var(--lyra-space-m); border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); font-size: var(--lyra-font-size-sm); }
  [part='entry-icon'] { display: inline-flex; flex: 0 0 auto; inline-size: var(--lyra-size-1em); block-size: var(--lyra-size-1em); color: var(--lyra-color-text-quiet); }
  [part='entry-name'] { flex: 1 1 auto; min-inline-size: 0; overflow: hidden; color: var(--lyra-color-text); text-overflow: ellipsis; white-space: nowrap; }
  [part='entry'][data-dir='true'] [part='entry-name'] { font-weight: var(--lyra-font-weight-semibold); }
  [part='entry-size'] { flex: 0 0 auto; color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  .empty-note { margin: 0; padding: var(--lyra-space-m); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  [part='error'] { margin: 0; padding: var(--lyra-space-l); color: var(--lyra-color-danger); font-size: var(--lyra-font-size-md-sm); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
