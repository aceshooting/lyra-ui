import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  [part='base'] {
    overflow: auto;
    max-block-size: var(--lyra-table-max-height, none);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
  }
  [part='table'] {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  [part='header-cell'] {
    position: sticky;
    inset-block-start: 0;
    background: var(--lyra-color-surface);
    text-align: start;
    font-weight: 600;
    padding: var(--lyra-space-s);
    border-block-end: 1px solid var(--lyra-color-border);
    cursor: default;
    white-space: nowrap;
  }
  [part='header-cell'][aria-sort]:not([aria-sort='none']),
  [part='header-cell'][data-sortable] {
    cursor: pointer;
  }
  [part='header-cell'][data-sortable]:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='header-cell'][data-sortable]:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='header-cell'][data-align='end'] {
    text-align: end;
  }
  [part='sort-icon'] {
    display: inline-block;
    margin-inline-start: var(--lyra-space-xs);
    vertical-align: middle;
    transition: transform var(--lyra-transition-fast);
  }
  [part='sort-icon'] svg {
    display: block;
  }
  /* Rotate the wrapping part element, not the svg — internal/icons.ts's
     documented contract ("callers ... rotate the wrapping part element via
     CSS transform: rotate(...), not the svg"). Design-review finding on
     Task 3 (lyra-table sort indicator): this previously rotated the inner
     <svg> directly. */
  [part='sort-icon'][data-dir='asc'] {
    transform: rotate(-90deg);
  }
  [part='sort-icon'][data-dir='desc'] {
    transform: rotate(90deg);
  }
  [part='row']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='row'][aria-selected='true'] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='row']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='cell'] {
    padding: var(--lyra-space-s);
    border-block-end: 1px solid var(--lyra-color-border);
  }
  [part='cell'][data-align='end'] {
    text-align: end;
  }
  [part='more-button'] {
    display: block;
    inline-size: 100%;
    padding: var(--lyra-space-s);
    border: none;
    background: none;
    color: var(--lyra-color-brand);
    font: inherit;
    cursor: pointer;
    border-block-start: 1px solid var(--lyra-color-border);
  }
  [part='more-button']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='more-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
