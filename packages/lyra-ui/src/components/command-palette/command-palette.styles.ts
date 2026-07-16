import { css } from 'lit';
export const styles = css`
  :host { display: contents; --lyra-command-palette-z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-modal)); --lyra-command-palette-max-inline-size: var(--lyra-size-48rem); --lyra-command-palette-max-block-size: 70vh; --lyra-command-palette-list-max-block-size: 50vh; --lyra-command-palette-offset-block-start: 12vh; }
  [part='backdrop'] { position: fixed; inset: 0; z-index: var(--lyra-command-palette-z-index); display: grid; place-items: start center; padding-block-start: var(--lyra-command-palette-offset-block-start); background: var(--lyra-color-overlay); }
  [part='dialog'] { inline-size: min(var(--lyra-command-palette-max-inline-size), calc(100vw - 2 * var(--lyra-space-l))); max-block-size: var(--lyra-command-palette-max-block-size); overflow: hidden; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); box-shadow: var(--lyra-shadow); color: var(--lyra-color-text); }
  [part='search'] { display: flex; align-items: center; gap: var(--lyra-space-s); padding: var(--lyra-space-m); border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); }
  [part='input'] { flex: 1; min-inline-size: 0; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; }
  [part='list'] { max-block-size: var(--lyra-command-palette-list-max-block-size); overflow: auto; padding: var(--lyra-space-xs); }
  [part='group'] { padding: var(--lyra-space-xs) var(--lyra-space-s); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); font-weight: 600; }
  [part='command'] { display: flex; align-items: center; gap: var(--lyra-space-s); inline-size: 100%; padding: var(--lyra-space-s); border: 0; border-radius: var(--lyra-radius); background: transparent; color: inherit; text-align: start; cursor: pointer; }
  [part='command'][data-active='true'] { background: var(--lyra-color-brand-quiet); }
  [part='command']:disabled { opacity: var(--lyra-opacity-disabled); cursor: not-allowed; }
  [part='description'] { flex: 1; color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); }
  [part='shortcut'] { color: var(--lyra-color-text-quiet); font-family: var(--lyra-font-mono); font-size: var(--lyra-font-size-sm); }
  [part='empty'] { padding: var(--lyra-space-l); color: var(--lyra-color-text-quiet); text-align: center; }
`;
