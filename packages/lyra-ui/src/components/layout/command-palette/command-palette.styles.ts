import { css } from "lit";
export const styles = css`
  :host {
    display: contents;
    --lr-command-palette-z-index: var(
      --lr-overlay-stack-index,
      var(--lr-layer-modal)
    );
    --lr-command-palette-max-inline-size: var(--lr-size-48rem);
    --lr-command-palette-max-block-size: 70vh;
    --lr-command-palette-list-max-block-size: 50vh;
    --lr-command-palette-offset-block-start: 12vh;
    --lr-command-palette-row-height: var(--lr-size-3rem);
    --lr-command-palette-group-height: var(--lr-size-2rem);
  }
  [part="backdrop"] {
    position: fixed;
    inset: 0;
    z-index: var(--lr-command-palette-z-index);
    display: grid;
    place-items: start center;
    padding-block-start: var(--lr-command-palette-offset-block-start);
    background: var(--lr-color-overlay);
  }
  [part="dialog"] {
    inline-size: min(
      var(--lr-command-palette-max-inline-size),
      calc(100vw - 2 * var(--lr-space-l))
    );
    min-inline-size: 0;
    max-block-size: var(--lr-command-palette-max-block-size);
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow);
    color: var(--lr-color-text);
  }
  [part="search"] {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="input"] {
    flex: 1;
    min-inline-size: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  [part="input"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
    border-radius: var(--lr-radius-xs);
  }
  [part="input"]::placeholder {
    color: var(--lr-color-text-quiet);
    opacity: 1;
  }
  [part="input"]::-webkit-search-cancel-button,
  [part="input"]::-webkit-search-decoration {
    appearance: none;
  }
  [part="list"] {
    position: relative;
    max-block-size: var(--lr-command-palette-list-max-block-size);
    overflow-x: hidden;
    overflow-y: auto;
    padding: var(--lr-space-xs);
  }
  [part="list-spacer"] {
    position: relative;
    min-inline-size: 0;
  }
  [part="command-group"] {
    display: contents;
  }
  [part="group"] {
    position: absolute;
    inset-inline: 0;
    block-size: var(--lr-command-palette-group-height);
    box-sizing: border-box;
    overflow: hidden;
    padding: var(--lr-space-xs) var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="command"] {
    position: absolute;
    inset-inline: 0;
    display: flex;
    align-items: center;
    min-inline-size: 0;
    block-size: var(--lr-command-palette-row-height);
    box-sizing: border-box;
    gap: var(--lr-space-s);
    inline-size: 100%;
    overflow: hidden;
    padding: var(--lr-space-s);
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  :where([part="command"]):hover:where(:not(:disabled)) {
    background: var(
      --lr-command-palette-active-bg,
      var(--lr-color-brand-quiet)
    );
  }
  /* Inline var() fallback rather than a :host-declared property, so a consumer can set it on any
     ancestor without a :host declaration shadowing that. ::part(command)[data-active='true'] is
     invalid CSS (an attribute selector cannot follow ::part), so highlighting the active row used to
     require hijacking the shared --lr-color-brand-quiet token, repainting everything else that reads
     it. Unset, it falls back to that token, so the rendering is unchanged. */
  [part="command"][data-active="true"] {
    background: var(
      --lr-command-palette-active-bg,
      var(--lr-color-brand-quiet)
    );
  }
  [part="command"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="icon"] {
    display: inline-flex;
    align-items: center;
    flex: none;
    block-size: var(--lr-size-1em);
    max-inline-size: var(--lr-size-1-25rem);
  }
  [part="label"],
  [part="description"],
  [part="shortcut"] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="label"] {
    flex: 0 1 auto;
  }
  [part="description"] {
    flex: 1 1 auto;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part="shortcut"] {
    flex: 0 1 auto;
    max-inline-size: 40%;
    color: var(--lr-color-text-quiet);
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
  }
  [part="empty"] {
    padding: var(--lr-space-l);
    color: var(--lr-color-text-quiet);
    text-align: center;
  }
`;
