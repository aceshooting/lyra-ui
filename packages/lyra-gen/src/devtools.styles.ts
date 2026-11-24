import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    color: var(--lr-color-text);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius-container);
    font-size: var(--lr-font-size-sm);
  }
  /* Containment stays off the host so the fixed highlight resolves against the viewport. */
  [part='base'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-gen-devtools-intrinsic-inline-size, 20rem);
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part='title'] { margin: 0; font-size: var(--lr-font-size-m); font-weight: var(--lr-font-weight-semibold); flex: 1 1 auto; }
  [part='tabs'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs);
    padding-inline: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  button {
    font: inherit;
    color: inherit;
    background: transparent;
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius-button);
    min-block-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    padding-inline: var(--lr-space-s);
    cursor: pointer;
  }
  button:hover { background: var(--lr-color-surface-container-high); }
  button:focus-visible, [role='treeitem']:focus-visible, [part='panel']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='action'] { border-color: var(--lr-color-border); }
  [part~='tab'] { border-end-start-radius: 0; border-end-end-radius: 0; }
  [part~='tab-selected'] { border-block-end: var(--lr-border-width-thick) solid var(--lr-color-brand); font-weight: var(--lr-font-weight-semibold); }
  [part='panel'] { padding: var(--lr-space-m); min-inline-size: 0; overflow: auto; max-block-size: var(--lr-gen-devtools-panel-max-block-size, 28rem); }
  h3 { margin: 0 0 var(--lr-space-xs); font-size: var(--lr-font-size-sm); font-weight: var(--lr-font-weight-semibold); }
  section + section { margin-block-start: var(--lr-space-m); }
  p { margin: 0; }
  .quiet { color: var(--lr-color-text-quiet); }
  pre, code {
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-xs);
  }
  pre {
    margin: 0;
    padding: var(--lr-space-s);
    background: var(--lr-color-surface-container-low);
    border-radius: var(--lr-radius-xs);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  [role='tree'], [role='group'] { list-style: none; margin: 0; padding: 0; }
  [role='treeitem'] { outline: none; }
  [part~='tree-row'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-block-size: var(--lr-icon-button-size);
    padding-inline-start: calc(var(--_level, 0) * var(--lr-space-m));
    padding-inline-end: var(--lr-space-xs);
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
  }
  [part~='tree-row']:hover { background: var(--lr-color-surface-container-high); }
  [part~='tree-row-selected'] { background: var(--lr-color-brand-quiet); }
  [part~='tree-row-selected']:hover { background: color-mix(in srgb, var(--lr-color-brand-quiet), var(--lr-color-text) 8%); }
  [role='treeitem']:focus-visible > [part~='tree-row'] { outline: var(--lr-focus-ring); outline-offset: calc(-1 * var(--lr-focus-ring-width)); }
  [part='twisty'] { display: inline-flex; inline-size: 1em; justify-content: center; flex: none; }
  :host(:dir(rtl)) [part='twisty'][data-collapsed] { transform: scaleX(-1); }
  [part='node-type'] { color: var(--lr-color-text-quiet); }
  dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--lr-space-2xs) var(--lr-space-s); margin: 0; }
  dt { color: var(--lr-color-text-quiet); }
  dd { margin: 0; min-inline-size: 0; overflow-wrap: anywhere; }
  table { border-collapse: collapse; inline-size: 100%; }
  th, td { text-align: start; vertical-align: top; padding: var(--lr-space-2xs) var(--lr-space-xs); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle); }
  td pre { padding: 0; background: transparent; }
  [part='highlight'] {
    position: fixed;
    pointer-events: none;
    box-sizing: border-box;
    border: var(--lr-border-width-medium) solid var(--lr-color-brand);
    background: color-mix(in srgb, var(--lr-color-brand) 10%, transparent);
    border-radius: var(--lr-radius-xs);
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
  }
  @container (max-width: 24rem) {
    dl { grid-template-columns: minmax(0, 1fr); }
  }
`;
