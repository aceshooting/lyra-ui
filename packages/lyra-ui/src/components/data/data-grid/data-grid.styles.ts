import { css } from 'lit';

export const styles = css`
  :host {
    --_lr-data-grid-accent-color: var(--lr-color-brand);
    --_lr-data-grid-background-color: var(--lr-color-surface);
    --_lr-data-grid-border-color: var(--lr-color-border);
    --_lr-data-grid-border-radius: var(--lr-radius);
    --_lr-data-grid-border-width: var(--lr-border-width-thin);
    --_lr-data-grid-cell-padding: var(--lr-space-m);
    --_lr-data-grid-focus-ring: var(--lr-focus-ring-width) solid
      var(--lr-focus-ring-color);
    --_lr-data-grid-header-background: var(--lr-color-surface-raised);
    --_lr-data-grid-header-row-height: var(--lr-size-3-5rem);
    --_lr-data-grid-header-text-color: var(--lr-color-text);
    --_lr-data-grid-indent-size: var(--lr-size-1-25rem);
    --_lr-data-grid-max-height: var(--lr-size-30rem);
    --_lr-data-grid-row-height: var(--lr-size-3-5rem);
    --_lr-data-grid-row-hover-background: color-mix(
      in srgb,
      var(--accent-color, var(--_lr-data-grid-accent-color))
        var(--lr-color-mix-hover),
      transparent
    );
    --_lr-data-grid-selected-background: var(--lr-color-brand-quiet);
    --_lr-data-grid-stripe-background: var(--lr-color-surface-raised);
    --_lr-data-grid-text-color: var(--lr-color-text);
    --_lr-data-grid-transition-duration: var(--lr-duration-fast);
    display: block;
    min-inline-size: 0;
    color: var(--text-color, var(--_lr-data-grid-text-color));
  }

  /* Wires the size density ladder into the values above; "m" is the :host block's own default and
     intentionally absent, so these rules override only the non-default tiers.

     Deliberately NOT the shared sizes stylesheet's --lr-form-control-height and
     --lr-form-control-padding-* tokens: tuned for single-line form controls, its "m" (2.5rem) sits
     BELOW this component's own "m" row-height (3.5rem), so borrowing it would make "l" (3rem)
     render shorter than the default row, inverting the ladder. Each tier below scales this
     component's own row-height/cell-padding baseline. */
  :host([size="xs"]) {
    --_lr-data-grid-cell-padding: var(--lr-space-xs);
    --_lr-data-grid-header-row-height: var(--lr-size-2rem);
    --_lr-data-grid-row-height: var(--lr-size-2rem);
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-data-grid-cell-padding: var(--lr-space-s);
    --_lr-data-grid-header-row-height: var(--lr-size-2-5rem);
    --_lr-data-grid-row-height: var(--lr-size-2-5rem);
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-data-grid-cell-padding: var(--lr-space-l);
    --_lr-data-grid-header-row-height: var(--lr-size-4rem);
    --_lr-data-grid-row-height: var(--lr-size-4rem);
  }
  :host([size="xl"]) {
    --_lr-data-grid-cell-padding: var(--lr-space-2xl);
    --_lr-data-grid-header-row-height: var(--lr-size-5rem);
    --_lr-data-grid-row-height: var(--lr-size-5rem);
  }

  [part="data-grid"] {
    position: relative;
    isolation: isolate;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    overflow: hidden;
    border: var(--border-width, var(--_lr-data-grid-border-width)) solid
      var(--border-color, var(--_lr-data-grid-border-color));
    border-radius: var(--border-radius, var(--_lr-data-grid-border-radius));
    background: var(--background-color, var(--_lr-data-grid-background-color));
  }

  :host([appearance="plain"]) [part="data-grid"] {
    border-color: transparent;
    border-radius: 0;
  }

  [part="toolbar"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    border-block-end: var(--border-width, var(--_lr-data-grid-border-width))
      solid var(--border-color, var(--_lr-data-grid-border-color));
  }

  [part="tree-limit"] {
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-start: var(--border-width, var(--_lr-data-grid-border-width))
      solid var(--border-color, var(--_lr-data-grid-border-color));
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part="search"] {
    box-sizing: border-box;
    min-block-size: var(--lr-icon-button-size);
    min-inline-size: min(var(--lr-size-20rem), 100%);
    flex: 1 1 var(--lr-size-12rem);
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--border-width, var(--_lr-data-grid-border-width)) solid
      var(--border-color, var(--_lr-data-grid-border-color));
    border-radius: var(--border-radius, var(--_lr-data-grid-border-radius));
    background: var(--background-color, var(--_lr-data-grid-background-color));
    color: var(--text-color, var(--_lr-data-grid-text-color));
    font: inherit;
  }

  [part="search"]::placeholder {
    color: var(--lr-color-text-quiet);
  }

  /* Search decorations are WebKit native chrome; reset unconditionally in both entry points so the
     component owns the control palette on Safari as well as Chromium. */
  [part="search"]::-webkit-search-cancel-button,
  [part="search"]::-webkit-search-decoration,
  [part="filter-panel"] input[type="search"]::-webkit-search-cancel-button,
  [part="filter-panel"] input[type="search"]::-webkit-search-decoration {
    appearance: none;
    -webkit-appearance: none;
    display: none;
  }

  [part="search"]:hover {
    border-color: var(--accent-color, var(--_lr-data-grid-accent-color));
  }

  [part="search"]:active {
    border-color: var(--accent-color, var(--_lr-data-grid-accent-color));
  }

  [part="search"]:focus-visible,
  button:focus-visible,
  [part="resize-handle"]:focus-visible,
  [role="gridcell"]:focus-visible,
  [role="columnheader"]:focus-visible {
    outline: var(--focus-ring, var(--_lr-data-grid-focus-ring));
    outline-offset: var(--lr-focus-ring-offset);
  }

  button {
    box-sizing: border-box;
    min-block-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    padding: var(--lr-space-s);
    border: var(--border-width, var(--_lr-data-grid-border-width)) solid
      var(--border-color, var(--_lr-data-grid-border-color));
    border-radius: var(--border-radius, var(--_lr-data-grid-border-radius));
    background: var(--background-color, var(--_lr-data-grid-background-color));
    color: var(--text-color, var(--_lr-data-grid-text-color));
    font: inherit;
    cursor: pointer;
    transition: background-color
        var(--transition-duration, var(--_lr-data-grid-transition-duration))
        var(--lr-easing-standard),
      border-color
        var(--transition-duration, var(--_lr-data-grid-transition-duration))
        var(--lr-easing-standard);
  }

  button:hover:not(:disabled) {
    border-color: var(--accent-color, var(--_lr-data-grid-accent-color));
    background: var(
      --row-hover-background,
      var(--_lr-data-grid-row-hover-background)
    );
  }

  button:active:not(:disabled) {
    border-color: var(--accent-color, var(--_lr-data-grid-accent-color));
    background: color-mix(
      in srgb,
      var(--accent-color, var(--_lr-data-grid-accent-color))
        var(--lr-color-mix-active),
      transparent
    );
  }

  button:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part="columns-menu"],
  [part="column-menu"],
  [part="filter-panel"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }

  [part~="column-menu-button"],
  [part~="filter-button"],
  [part~="pager-button"] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  [part="table"] {
    display: block;
    min-inline-size: 100%;
  }

  [part="header"] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-dropdown);
    display: grid;
    grid-template-columns: var(--data-grid-columns);
    min-inline-size: max-content;
    min-block-size: var(
      --header-row-height,
      var(--_lr-data-grid-header-row-height)
    );
    border-block-end: var(--border-width, var(--_lr-data-grid-border-width))
      solid var(--border-color, var(--_lr-data-grid-border-color));
    background: var(
      --header-background,
      var(--_lr-data-grid-header-background)
    );
    color: var(--header-text-color, var(--_lr-data-grid-header-text-color));
  }

  [part~="header-cell"],
  [part~="cell"],
  [part~="footer-cell"] {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    min-inline-size: 0;
    padding: var(--cell-padding, var(--_lr-data-grid-cell-padding));
    border-inline-end: var(--border-width, var(--_lr-data-grid-border-width))
      solid var(--border-color, var(--_lr-data-grid-border-color));
    overflow: hidden;
    text-align: start;
  }

  [part~="header-cell"] {
    position: relative;
    gap: var(--lr-space-xs);
    min-block-size: var(
      --header-row-height,
      var(--_lr-data-grid-header-row-height)
    );
    font-weight: var(--lr-font-weight-semibold);
    cursor: default;
    user-select: none;
  }

  [part~="header-cell"][data-sortable] {
    cursor: pointer;
  }

  [part~="header-cell"][data-sortable]:hover {
    background: var(
      --row-hover-background,
      var(--_lr-data-grid-row-hover-background)
    );
  }

  [part~="header-cell"][data-sortable]:active {
    background: color-mix(
      in srgb,
      var(--accent-color, var(--_lr-data-grid-accent-color))
        var(--lr-color-mix-active),
      transparent
    );
  }

  [part="body"] {
    position: relative;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-block-size: var(--max-height, var(--_lr-data-grid-max-height));
    overflow: auto;
    overscroll-behavior: contain;
  }

  [part~="row"],
  [part="group-row"],
  [part="footer-row"] {
    display: grid;
    grid-template-columns: var(--data-grid-columns);
    min-inline-size: max-content;
    min-block-size: var(--row-height, var(--_lr-data-grid-row-height));
    border-block-end: var(--border-width, var(--_lr-data-grid-border-width))
      solid var(--border-color, var(--_lr-data-grid-border-color));
    background: var(--background-color, var(--_lr-data-grid-background-color));
    transition: background-color
      var(--transition-duration, var(--_lr-data-grid-transition-duration))
      var(--lr-easing-standard);
  }

  :host([striped]) [part~="row"]:nth-of-type(even) {
    background: var(
      --stripe-background,
      var(--_lr-data-grid-stripe-background)
    );
  }

  [part~="row"][aria-selected="true"] {
    background: var(
      --selected-background,
      var(--_lr-data-grid-selected-background)
    );
  }

  /* MUST stay after the selected-row rule above: both are (0,2,0), so source order alone decides.
     The selected row is the one a user is most likely to hover next, so placing this first would
     leave the commonest hover in a selectable grid with no feedback. */
  [part~="row"]:hover {
    background: var(
      --row-hover-background,
      var(--_lr-data-grid-row-hover-background)
    );
  }

  /* MUST stay after the selected-row rule above: both are (0,2,0), so source order alone decides.
     The selected row is the one a user presses to DEselect, so placing this first would leave the
     commonest press in a selectable grid with no feedback. */
  [part~="row"]:active {
    background: color-mix(
      in srgb,
      var(--accent-color, var(--_lr-data-grid-accent-color))
        var(--lr-color-mix-active),
      transparent
    );
  }

  [part~="cell"] {
    min-block-size: var(--row-height, var(--_lr-data-grid-row-height));
  }

  [part~="cell"][data-align="center"],
  [part~="header-cell"][data-align="center"] {
    justify-content: center;
    text-align: center;
  }

  [part~="cell"][data-align="right"],
  [part~="header-cell"][data-align="right"],
  [part~="cell"][data-align="end"],
  [part~="header-cell"][data-align="end"] {
    justify-content: flex-end;
    text-align: end;
  }

  [data-pin="left"] {
    position: sticky;
    inset-inline-start: var(--pin-offset, 0);
    z-index: var(--lr-layer-content);
    background: inherit;
  }

  [data-pin="right"] {
    position: sticky;
    inset-inline-end: var(--pin-offset, 0);
    z-index: var(--lr-layer-content);
    background: inherit;
  }

  [part="pin-indicator"] {
    position: absolute;
    inset-block: 0;
    inline-size: var(--border-width, var(--_lr-data-grid-border-width));
    background: var(--accent-color, var(--_lr-data-grid-accent-color));
    pointer-events: none;
  }

  [data-pin="left"] [part="pin-indicator"] {
    inset-inline-end: 0;
  }

  [data-pin="right"] [part="pin-indicator"] {
    inset-inline-start: 0;
  }

  [part="resize-handle"] {
    position: absolute;
    inset-block: 0;
    inset-inline-end: calc(var(--lr-space-xs) * -1);
    inline-size: var(--lr-space-l);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: col-resize;
    touch-action: none;
  }

  [part="resize-handle"]:hover {
    background: color-mix(
      in srgb,
      var(--accent-color, var(--_lr-data-grid-accent-color))
        var(--lr-color-mix-hover),
      transparent
    );
  }

  [part="resize-handle"]:active {
    background: color-mix(
      in srgb,
      var(--accent-color, var(--_lr-data-grid-accent-color))
        var(--lr-color-mix-active),
      transparent
    );
  }

  [part="sort-indicator"],
  [part="sort-number"],
  [part="ellipsis"],
  [part="group-count"] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part="sort-indicator"] {
    display: inline-flex;
    transition: transform
      var(--transition-duration, var(--_lr-data-grid-transition-duration))
      var(--lr-easing-standard);
  }

  [part="sort-indicator"][data-direction="ascending"] {
    transform: rotate(-90deg);
  }

  [part="sort-indicator"][data-direction="descending"] {
    transform: rotate(90deg);
  }

  [part="expand-button"] {
    margin-inline-start: calc(
      var(--depth, 0) * var(--indent-size, var(--_lr-data-grid-indent-size))
    );
  }

  [part="expand-button"] > span {
    display: inline-flex;
    transform: rotate(0deg);
    transition: transform
      var(--transition-duration, var(--_lr-data-grid-transition-duration))
      var(--lr-easing-standard);
  }

  [part="expand-button"] > span[data-expanded="true"] {
    transform: rotate(90deg);
  }

  :host(:dir(rtl)) [part="expand-button"] > span {
    transform: rotate(180deg);
  }

  :host(:dir(rtl)) [part="expand-button"] > span[data-expanded="true"] {
    transform: rotate(90deg);
  }

  [part="row-detail"] {
    padding: var(--cell-padding, var(--_lr-data-grid-cell-padding));
    border-block-end: var(--border-width, var(--_lr-data-grid-border-width))
      solid var(--border-color, var(--_lr-data-grid-border-color));
    background: var(--lr-color-surface-raised);
  }

  [part="group-row"] {
    font-weight: var(--lr-font-weight-semibold);
  }

  [part="group-value"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    grid-column: 1 / -1;
    padding: var(--cell-padding, var(--_lr-data-grid-cell-padding));
  }

  [part="footer"] {
    position: sticky;
    inset-block-end: 0;
    z-index: var(--lr-layer-dropdown);
    background: var(
      --header-background,
      var(--_lr-data-grid-header-background)
    );
  }

  [part="footer-row"] {
    border-block-start: var(--border-width, var(--_lr-data-grid-border-width))
      solid var(--border-color, var(--_lr-data-grid-border-color));
    border-block-end: 0;
    font-weight: var(--lr-font-weight-semibold);
  }

  [part="empty"],
  [part="no-results"] {
    padding: var(--lr-space-2xl);
    text-align: center;
    color: var(--lr-color-text-quiet);
  }

  [part="loading-overlay"] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-popover);
    display: grid;
    place-items: center;
    min-block-size: var(--row-height, var(--_lr-data-grid-row-height));
    padding: var(--lr-space-l);
    background: var(--background-color, var(--_lr-data-grid-background-color));
    opacity: var(--lr-opacity-muted);
  }

  [part="pager"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
    border-block-start: var(--border-width, var(--_lr-data-grid-border-width))
      solid var(--border-color, var(--_lr-data-grid-border-color));
  }

  .page-size-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  [part="page-size"] {
    min-block-size: var(--lr-icon-button-size);
    padding-inline: var(--lr-space-s) var(--lr-space-l);
    border: var(--border-width, var(--_lr-data-grid-border-width)) solid
      var(--border-color, var(--_lr-data-grid-border-color));
    border-radius: var(--border-radius, var(--_lr-data-grid-border-radius));
    background: var(--background-color, var(--_lr-data-grid-background-color));
    color: var(--text-color, var(--_lr-data-grid-text-color));
    font: inherit;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
  }

  [part="page-size"] option {
    background: var(--background-color, var(--_lr-data-grid-background-color));
    color: var(--text-color, var(--_lr-data-grid-text-color));
  }

  [part="page-size"]:hover {
    border-color: var(--accent-color, var(--_lr-data-grid-accent-color));
  }

  [part="page-size"]:active {
    border-color: var(--accent-color, var(--_lr-data-grid-accent-color));
    background: var(
      --row-hover-background,
      var(--_lr-data-grid-row-hover-background)
    );
  }

  [part="page-size"]:focus-visible {
    outline: var(--focus-ring, var(--_lr-data-grid-focus-ring));
    outline-offset: var(--lr-focus-ring-offset);
  }

  .page-size-chevron {
    position: absolute;
    inset-inline-end: var(--lr-space-xs);
    display: inline-flex;
    color: var(--lr-color-text-quiet);
    line-height: var(--lr-line-height-none);
    pointer-events: none;
  }

  .page-size-chevron svg {
    transform: rotate(90deg);
  }

  [part="page-current"] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    text-align: center;
  }

  [part="first-icon"],
  [part="previous-icon"],
  [part="next-icon"],
  [part="last-icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: var(--lr-line-height-none);
  }

  /* The two chevrons of an edge button overlap slightly so they read as one doubled glyph rather
     than two separate arrows -- matches lr-pagination's identical first/last treatment. */
  [part="first-icon"] svg + svg,
  [part="last-icon"] svg + svg {
    margin-inline-start: var(--lr-size-neg-4px);
  }

  /* chevronIcon() points right by default, so 'next'/'last' render unrotated and 'first'/'previous'
     rotate to point left -- both pairs then flip under RTL, exactly like lr-pagination's
     first/previous/next/last icons. */
  [part="first-icon"],
  [part="previous-icon"] {
    transform: rotate(180deg);
  }

  [part="next-icon"],
  [part="last-icon"] {
    transform: rotate(0deg);
  }

  :host(:dir(rtl)) [part="first-icon"],
  :host(:dir(rtl)) [part="previous-icon"] {
    transform: rotate(0deg);
  }

  :host(:dir(rtl)) [part="next-icon"],
  :host(:dir(rtl)) [part="last-icon"] {
    transform: rotate(180deg);
  }

  [part="drag-ghost"] {
    position: fixed;
    z-index: var(--lr-layer-toast);
    pointer-events: none;
    padding: var(--lr-space-s);
    border: var(--border-width, var(--_lr-data-grid-border-width)) solid
      var(--accent-color, var(--_lr-data-grid-accent-color));
    border-radius: var(--border-radius, var(--_lr-data-grid-border-radius));
    background: var(--background-color, var(--_lr-data-grid-background-color));
  }

  @container (max-inline-size: 20rem) {
    [part="toolbar"] {
      align-items: stretch;
      flex-direction: column;
    }

    [part="search"] {
      inline-size: 100%;
      min-inline-size: 0;
      flex: 0 1 auto;
    }

    [part="pager"] {
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button,
    [part~="row"],
    [part="sort-indicator"],
    [part="expand-button"] > span {
      transition: none !important;
    }
  }
`;
