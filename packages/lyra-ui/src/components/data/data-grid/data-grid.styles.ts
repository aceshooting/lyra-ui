import { css } from 'lit';

export const styles = css`
  :host {
    --accent-color: var(--lr-color-brand);
    --background-color: var(--lr-color-surface);
    --border-color: var(--lr-color-border);
    --border-radius: var(--lr-radius);
    --border-width: var(--lr-border-width-thin);
    --cell-padding: var(--lr-space-m);
    --focus-ring: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    --header-background: var(--lr-color-surface-raised);
    --header-row-height: var(--lr-size-3-5rem);
    --header-text-color: var(--lr-color-text);
    --indent-size: var(--lr-size-1-25rem);
    --max-height: var(--lr-size-30rem);
    --row-height: var(--lr-size-3-5rem);
    --row-hover-background: color-mix(in srgb, var(--accent-color) var(--lr-color-mix-hover), transparent);
    --selected-background: var(--lr-color-brand-quiet);
    --stripe-background: var(--lr-color-surface-raised);
    --text-color: var(--lr-color-text);
    --transition-duration: var(--lr-duration-fast);
    display: block;
    min-inline-size: 0;
    color: var(--text-color);
  }

  [part='data-grid'] {
    position: relative;
    isolation: isolate;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    overflow: hidden;
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--background-color);
  }

  :host([appearance='plain']) [part='data-grid'] {
    border-color: transparent;
    border-radius: 0;
  }

  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    border-block-end: var(--border-width) solid var(--border-color);
  }

  [part='search'] {
    box-sizing: border-box;
    min-block-size: var(--lr-icon-button-size);
    min-inline-size: min(var(--lr-size-20rem), 100%);
    flex: 1 1 var(--lr-size-12rem);
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--background-color);
    color: var(--text-color);
    font: inherit;
  }

  [part='search']:hover {
    border-color: var(--accent-color);
  }

  [part='search']:active {
    border-color: var(--accent-color);
  }

  [part='search']:focus-visible,
  button:focus-visible,
  [role='gridcell']:focus-visible,
  [role='columnheader']:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }

  button {
    box-sizing: border-box;
    min-block-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    padding: var(--lr-space-s);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--background-color);
    color: var(--text-color);
    font: inherit;
    cursor: pointer;
    transition:
      background-color var(--transition-duration) var(--lr-easing-standard),
      border-color var(--transition-duration) var(--lr-easing-standard);
  }

  button:hover:not(:disabled) {
    border-color: var(--accent-color);
    background: var(--row-hover-background);
  }

  button:active:not(:disabled) {
    border-color: var(--accent-color);
    background: color-mix(in srgb, var(--accent-color) var(--lr-color-mix-active), transparent);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part='columns-menu'],
  [part='column-menu'],
  [part='filter-panel'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }

  [part~='column-menu-button'],
  [part~='filter-button'],
  [part~='pager-button'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  [part='table'] {
    display: block;
    min-inline-size: 100%;
  }

  [part='header'] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-dropdown);
    display: grid;
    grid-template-columns: var(--data-grid-columns);
    min-inline-size: max-content;
    min-block-size: var(--header-row-height);
    border-block-end: var(--border-width) solid var(--border-color);
    background: var(--header-background);
    color: var(--header-text-color);
  }

  [part~='header-cell'],
  [part~='cell'],
  [part~='footer-cell'] {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    min-inline-size: 0;
    padding: var(--cell-padding);
    border-inline-end: var(--border-width) solid var(--border-color);
    overflow: hidden;
    text-align: start;
  }

  [part~='header-cell'] {
    position: relative;
    gap: var(--lr-space-xs);
    min-block-size: var(--header-row-height);
    font-weight: var(--lr-font-weight-semibold);
    cursor: default;
    user-select: none;
  }

  [part~='header-cell'][data-sortable] {
    cursor: pointer;
  }

  [part~='header-cell'][data-sortable]:hover {
    background: var(--row-hover-background);
  }

  [part~='header-cell'][data-sortable]:active {
    background: color-mix(in srgb, var(--accent-color) var(--lr-color-mix-active), transparent);
  }

  [part='body'] {
    position: relative;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-block-size: var(--max-height);
    overflow: auto;
    overscroll-behavior: contain;
  }

  [part~='row'],
  [part='group-row'],
  [part='footer-row'] {
    display: grid;
    grid-template-columns: var(--data-grid-columns);
    min-inline-size: max-content;
    min-block-size: var(--row-height);
    border-block-end: var(--border-width) solid var(--border-color);
    background: var(--background-color);
    transition: background-color var(--transition-duration) var(--lr-easing-standard);
  }

  :host([striped]) [part~='row']:nth-of-type(even) {
    background: var(--stripe-background);
  }

  [part~='row']:hover {
    background: var(--row-hover-background);
  }

  [part~='row']:active {
    background: color-mix(in srgb, var(--accent-color) var(--lr-color-mix-active), transparent);
  }

  [part~='row'][aria-selected='true'] {
    background: var(--selected-background);
  }

  [part~='cell'] {
    min-block-size: var(--row-height);
  }

  [part~='cell'][data-align='center'],
  [part~='header-cell'][data-align='center'] {
    justify-content: center;
    text-align: center;
  }

  [part~='cell'][data-align='right'],
  [part~='header-cell'][data-align='right'],
  [part~='cell'][data-align='end'],
  [part~='header-cell'][data-align='end'] {
    justify-content: flex-end;
    text-align: end;
  }

  [data-pin='left'] {
    position: sticky;
    inset-inline-start: var(--pin-offset, 0);
    z-index: var(--lr-layer-content);
    background: inherit;
  }

  [data-pin='right'] {
    position: sticky;
    inset-inline-end: var(--pin-offset, 0);
    z-index: var(--lr-layer-content);
    background: inherit;
  }

  [part='pin-indicator'] {
    position: absolute;
    inset-block: 0;
    inline-size: var(--border-width);
    background: var(--accent-color);
    pointer-events: none;
  }

  [data-pin='left'] [part='pin-indicator'] {
    inset-inline-end: 0;
  }

  [data-pin='right'] [part='pin-indicator'] {
    inset-inline-start: 0;
  }

  [part='resize-handle'] {
    position: absolute;
    inset-block: 0;
    inset-inline-end: calc(var(--lr-space-xs) * -1);
    inline-size: var(--lr-space-l);
    cursor: col-resize;
    touch-action: none;
  }

  [part='resize-handle']:hover {
    background: color-mix(in srgb, var(--accent-color) var(--lr-color-mix-hover), transparent);
  }

  [part='resize-handle']:active {
    background: color-mix(in srgb, var(--accent-color) var(--lr-color-mix-active), transparent);
  }

  [part='sort-indicator'],
  [part='sort-number'],
  [part='ellipsis'],
  [part='group-count'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='sort-indicator'] {
    display: inline-flex;
    transition: transform var(--transition-duration) var(--lr-easing-standard);
  }

  [part='sort-indicator'][data-direction='ascending'] {
    transform: rotate(-90deg);
  }

  [part='sort-indicator'][data-direction='descending'] {
    transform: rotate(90deg);
  }

  [part='expand-button'] {
    margin-inline-start: calc(var(--depth, 0) * var(--indent-size));
  }

  [part='expand-button'] > span {
    display: inline-flex;
    transform: rotate(0deg);
    transition: transform var(--transition-duration) var(--lr-easing-standard);
  }

  [part='expand-button'] > span[data-expanded='true'] {
    transform: rotate(90deg);
  }

  :host(:dir(rtl)) [part='expand-button'] > span {
    transform: rotate(180deg);
  }

  :host(:dir(rtl)) [part='expand-button'] > span[data-expanded='true'] {
    transform: rotate(90deg);
  }

  [part='row-detail'] {
    padding: var(--cell-padding);
    border-block-end: var(--border-width) solid var(--border-color);
    background: var(--lr-color-surface-raised);
  }

  [part='group-row'] {
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='group-value'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    grid-column: 1 / -1;
    padding: var(--cell-padding);
  }

  [part='footer'] {
    position: sticky;
    inset-block-end: 0;
    z-index: var(--lr-layer-dropdown);
    background: var(--header-background);
  }

  [part='footer-row'] {
    border-block-start: var(--border-width) solid var(--border-color);
    border-block-end: 0;
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='empty'],
  [part='no-results'] {
    padding: var(--lr-space-2xl);
    text-align: center;
    color: var(--lr-color-text-quiet);
  }

  [part='loading-overlay'] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-popover);
    display: grid;
    place-items: center;
    min-block-size: var(--row-height);
    padding: var(--lr-space-l);
    background: var(--background-color);
    opacity: var(--lr-opacity-muted);
  }

  [part='pager'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
    border-block-start: var(--border-width) solid var(--border-color);
  }

  [part='page-size'] {
    min-block-size: var(--lr-icon-button-size);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--background-color);
    color: var(--text-color);
    font: inherit;
  }

  [part='page-current'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    text-align: center;
  }

  [part='drag-ghost'] {
    position: fixed;
    z-index: var(--lr-layer-toast);
    pointer-events: none;
    padding: var(--lr-space-s);
    border: var(--border-width) solid var(--accent-color);
    border-radius: var(--border-radius);
    background: var(--background-color);
  }

  @container (max-width: 20rem) {
    [part='toolbar'] {
      align-items: stretch;
      flex-direction: column;
    }

    [part='search'] {
      inline-size: 100%;
      min-inline-size: 0;
    }

    [part='pager'] {
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button,
    [part~='row'],
    [part='sort-indicator'],
    [part='expand-button'] > span {
      transition: none !important;
    }
  }
`;
