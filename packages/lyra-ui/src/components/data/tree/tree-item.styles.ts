import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    outline: none; /* the host is the focusable treeitem; the visible ring lives on [part=row] */
  }
  [part~='item'] {
    display: contents;
  }
  :host(:focus-visible) [part='row'] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='row'] {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    /* Depth-based indent is capped at --lr-size-8rem (8rem) so a deeply-nested
       item can't push its content off-screen with no way back; [part=label]
       below truncates the remaining overflow and tree.styles.ts's [part=base]
       adds an overflow-x:auto fallback for whatever's left. */
    padding-inline-start: calc(
      var(--lr-space-s) + min(var(--lr-tree-depth, 0) * var(--indent-size, var(--lr-space-l)), var(--lr-size-8rem))
    );
    cursor: pointer;
    border-radius: var(--lr-radius);
  }
  [part='row']:hover {
    background: var(--lr-color-brand-quiet);
  }
  :host([aria-selected='true']) [part='row'] {
    color: var(--lr-tree-selected-color, var(--lr-color-brand));
    background: var(--lr-tree-selected-bg, var(--lr-color-brand-quiet));
  }
  /* MUST stay after the selected-row rule above, and the second arm exists so it can: a selected
     row is matched at (0,3,0) there, which a bare [part='row']:active ((0,2,0)) cannot reach, and
     the already-selected item is exactly the row a user presses next. Matching it through :host()
     lands both arms at the same specificity as that rule, so source order decides -- and the
     :where() keeps the state qualifier itself out of the count. */
  [part='row']:active,
  :host(:where([aria-selected='true'])) [part='row']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  :host([aria-disabled='true']) [part='row'] {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }
  :host([aria-disabled='true']) [part='row']:hover {
    background: transparent;
  }
  /* A disabled item must stay inert under the pointer for the press as well as the hover -- without
     this it would light up on mousedown and then do nothing. */
  :host([aria-disabled='true']) [part='row']:active {
    background: transparent;
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
  [part='expand-button'] {
    display: inline-flex;
    flex: 0 0 auto;
  }
  [part='indentation'] {
    position: absolute;
    inset-block: var(--indent-guide-offset, 0);
    inset-inline-start: 0;
    box-sizing: border-box;
    inline-size: min(
      calc(var(--lr-tree-depth, 0) * var(--indent-size, var(--lr-space-l))),
      var(--lr-size-8rem)
    );
    border-inline-end-width: var(--indent-guide-width, 0);
    border-inline-end-style: var(--indent-guide-style, solid);
    border-inline-end-color: var(--indent-guide-color, var(--lr-color-border));
  }
  [part='toggle']:disabled {
    cursor: default;
  }
  [part='toggle'][hidden] {
    /* visibility (not display) so the placeholder keeps its layout box --
       a leaf row still lines up with sibling rows that do have a chevron. */
    visibility: hidden;
  }
  [part='spinner'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  [part='spinner__base'] {
    box-sizing: border-box;
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
    border: var(--lr-border-width-medium) solid var(--lr-color-border);
    border-block-start-color: var(--lr-color-brand);
    border-radius: 50%;
    animation: lr-tree-spin var(--lr-duration-ambient) linear infinite;
  }
  [part='checkbox'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: pointer;
    flex: 0 0 auto;
  }
  [part='checkbox']:hover [part~='checkbox__control'] {
    border-color: var(--lr-color-brand);
  }
  [part='checkbox']:active [part~='checkbox__control'] {
    border-color: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  :host([aria-disabled='true']) [part='checkbox'] {
    cursor: default;
  }
  :host([aria-disabled='true']) [part='checkbox']:hover [part~='checkbox__control'] {
    border-color: var(--lr-color-border);
  }
  :host([aria-disabled='true']) [part='checkbox']:active [part~='checkbox__control'] {
    border-color: var(--lr-color-border);
  }
  [part='checkbox__base'] {
    display: inline-flex;
  }
  [part~='checkbox__control'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    color: var(--lr-color-on-brand);
    background: var(--lr-color-surface);
  }
  [part~='checkbox__control--checked'],
  [part~='checkbox__control--indeterminate'] {
    border-color: var(--lr-color-brand);
    background: var(--lr-color-brand);
  }
  [part='checkbox__checked-icon'],
  [part='checkbox__indeterminate-icon'] {
    display: none;
    line-height: var(--lr-line-height-compact);
  }
  [part~='checkbox__control--checked'] [part='checkbox__checked-icon'] {
    display: inline;
  }
  [part~='checkbox__control--indeterminate'] [part='checkbox__checked-icon'] {
    display: none;
  }
  [part~='checkbox__control--indeterminate'] [part='checkbox__indeterminate-icon'] {
    display: inline;
  }
  [part='checkbox__label'] {
    display: contents;
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
    color: var(--lr-tree-badge-neutral-color, var(--lr-color-text-quiet));
    background: var(--lr-tree-badge-neutral-bg, var(--lr-color-surface));
  }
  [part='badge'][data-tone='brand'] {
    color: var(--lr-tree-badge-brand-color, var(--lr-color-brand));
    background: var(--lr-tree-badge-brand-bg, var(--lr-color-brand-quiet));
  }
  [part='badge'][data-tone='success'] {
    color: var(--lr-tree-badge-success-color, var(--lr-color-success));
    background: var(--lr-tree-badge-success-bg, var(--lr-color-success-quiet));
  }
  [part='badge'][data-tone='warning'] {
    color: var(--lr-tree-badge-warning-color, var(--lr-color-warning));
    background: var(--lr-tree-badge-warning-bg, var(--lr-color-warning-quiet));
  }
  [part='badge'][data-tone='danger'] {
    color: var(--lr-tree-badge-danger-color, var(--lr-color-danger));
    background: var(--lr-tree-badge-danger-bg, var(--lr-color-danger-quiet));
  }
  [part='children'] {
    animation-duration: var(--show-duration, var(--lr-duration-base));
    animation-timing-function: var(--lr-easing-standard);
  }
  :host([expanded]) [part='children'] {
    animation-name: lr-tree-show;
  }

  @keyframes lr-tree-show {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes lr-tree-spin {
    to {
      transform: rotate(1turn);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='children'],
    [part='spinner__base'] {
      animation: none;
    }
  }
`;
