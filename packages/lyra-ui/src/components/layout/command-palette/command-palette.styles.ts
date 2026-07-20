import { css } from 'lit';
export const styles = css`
  :host { display: contents; --lr-command-palette-z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal)); --lr-command-palette-max-inline-size: var(--lr-size-48rem); --lr-command-palette-max-block-size: 70vh; --lr-command-palette-list-max-block-size: 50vh; --lr-command-palette-offset-block-start: 12vh; }
  [part='backdrop'] { position: fixed; inset: 0; z-index: var(--lr-command-palette-z-index); display: grid; place-items: start center; padding-block-start: var(--lr-command-palette-offset-block-start); background: var(--lr-color-overlay); }
  [part='dialog'] { inline-size: min(var(--lr-command-palette-max-inline-size), calc(100vw - 2 * var(--lr-space-l))); max-block-size: var(--lr-command-palette-max-block-size); overflow: hidden; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); box-shadow: var(--lr-shadow); color: var(--lr-color-text); }
  [part='search'] { display: flex; align-items: center; gap: var(--lr-space-s); padding: var(--lr-space-m); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='input'] { flex: 1; min-inline-size: 0; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; }
  [part='list'] { max-block-size: var(--lr-command-palette-list-max-block-size); overflow: auto; padding: var(--lr-space-xs); }
  [part='group'] { padding: var(--lr-space-xs) var(--lr-space-s); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); font-weight: var(--lr-font-weight-semibold); }
  [part='command'] { display: flex; align-items: center; gap: var(--lr-space-s); inline-size: 100%; padding: var(--lr-space-s); border: 0; border-radius: var(--lr-radius); background: transparent; color: inherit; text-align: start; cursor: pointer; }
  /* Inline var() fallback rather than a :host-declared property, so a consumer can set it on any
     ancestor without a :host declaration shadowing that. ::part(command)[data-active='true'] is
     invalid CSS (an attribute selector cannot follow ::part), so highlighting the active row used to
     require hijacking the shared --lr-color-brand-quiet token, repainting everything else that reads
     it. Unset, it falls back to that token, so the rendering is unchanged. */
  [part='command'][data-active='true'] { background: var(--lr-command-palette-active-bg, var(--lr-color-brand-quiet)); }
  [part='command']:disabled { opacity: var(--lr-opacity-disabled); cursor: not-allowed; }
  [part='description'] { flex: 1; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='shortcut'] { color: var(--lr-color-text-quiet); font-family: var(--lr-font-mono); font-size: var(--lr-font-size-sm); }
  [part='empty'] { padding: var(--lr-space-l); color: var(--lr-color-text-quiet); text-align: center; }
`;
