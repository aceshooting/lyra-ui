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
  [part='header-cell'][data-align='end'] {
    text-align: end;
  }
  [part='row']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='row'][aria-selected='true'] {
    background: var(--lyra-color-brand-quiet);
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
`;
