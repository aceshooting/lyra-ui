import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    outline: none; /* the host is the focusable treeitem; the visible ring lives on [part=row] */
  }
  :host(:focus-visible) [part='row'] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='row'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    /* Depth-based indent is capped at --lr-size-8rem (8rem) so a deeply-nested
       item can't push its content off-screen with no way back; [part=label]
       below truncates the remaining overflow and tree.styles.ts's [part=base]
       adds an overflow-x:auto fallback for whatever's left. */
    padding-inline-start: calc(
      var(--lr-space-s) + min(var(--lr-tree-depth, 0) * var(--lr-space-l), var(--lr-size-8rem))
    );
    cursor: pointer;
    border-radius: var(--lr-radius);
  }
  [part='row']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='toggle'] {
    /* Keep the chevron glyph compact (the row itself stays a --lr-size-1-75rem-ish
       visual rhythm) while giving the interactive box the shared minimum tappable
       size -- same "small glyph, padded hit box" pattern as lr-code-block's/
       lr-json-viewer's/lr-trace-tree's own [part='toggle']. min-inline-size/
       min-block-size always win over a smaller explicit size, so the *visible*
       icon stays put via its own 1em SVG sizing while the clickable box floors
       out at 40px. */
    inline-size: var(--lr-size-1-75rem);
    block-size: var(--lr-size-1-75rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    flex: 0 0 auto;
  }
  [part='toggle'][hidden] {
    /* visibility (not display) so the placeholder keeps its layout box --
       a leaf row still lines up with sibling rows that do have a chevron. */
    visibility: hidden;
  }
  :host([expanded]) [part='toggle'] {
    transform: rotate(90deg);
  }
  :host(:dir(rtl)) [part='toggle'] {
    transform: rotate(180deg);
  }
  :host([expanded]:dir(rtl)) [part='toggle'] {
    transform: rotate(90deg);
  }
  [part='label'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
  }
  [part='content'] {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part='description'] {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-compact);
    overflow-wrap: anywhere;
  }
  [part='badge'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text);
    background: var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: 0 var(--lr-space-xs);
  }
  [part='badge'] + [part='badge'] {
    margin-inline-start: var(--lr-space-xs);
  }
  [part='badge'][data-tone='neutral'] {
    color: var(--lr-color-text-quiet);
    background: var(--lr-color-surface);
  }
  [part='badge'][data-tone='brand'] {
    color: var(--lr-color-brand);
    background: var(--lr-color-brand-quiet);
  }
  [part='badge'][data-tone='success'] {
    color: var(--lr-color-success);
    background: var(--lr-color-success-quiet);
  }
  [part='badge'][data-tone='warning'] {
    color: var(--lr-color-warning);
    background: var(--lr-color-warning-quiet);
  }
  [part='badge'][data-tone='danger'] {
    color: var(--lr-color-danger);
    background: var(--lr-color-danger-quiet);
  }
`;
