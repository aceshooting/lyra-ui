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
    /* Makes [part='base'] a query container so the @container rules below can
       react to the table's own available width instead of the viewport's. */
    container-type: inline-size;
  }
  /*
   * Column priority (columns[].priority) hides [data-priority='low']/
   * ['medium'] header/cells as the container narrows. showAllColumns
   * (toggled by [part='reveal-columns-button']) needs to override this, but
   * a @container query can only condition on ancestor inline-size, not
   * component state — so it's surfaced instead as the data-force-visible
   * attribute on [part='base'] itself, and the hide rule's :not(...)
   * selector excludes it. Toggling the attribute flips every hidden column
   * back on without a second, state-aware container query.
   */
  @container (max-width: 899.98px) {
    [part='base']:not([data-force-visible]) [data-priority='low'] {
      display: none;
    }
  }
  @container (max-width: 639.98px) {
    [part='base']:not([data-force-visible]) [data-priority='medium'] {
      display: none;
    }
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
  /* Not scoped to [data-sortable] — the roving-tabindex header stop (see
     table.ts's focusedColKey()) can land on any column, sortable or not, so
     every header cell needs its own visible focus indicator. */
  [part='header-cell']:focus-visible {
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
     CSS transform: rotate(...), not the svg"). This previously rotated the
     inner <svg> directly. */
  [part='sort-icon'][data-dir='asc'] {
    transform: rotate(-90deg);
  }
  [part='sort-icon'][data-dir='desc'] {
    transform: rotate(90deg);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='sort-icon'] {
      transition: none !important;
    }
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
  /* columns[].sticky pins a column's header/cells to the inline-start edge
     while the table scrolls horizontally — mirrors [part='header-cell']'s
     existing inset-block-start vertical-scroll sticky pattern above, just on
     the other axis. The box-shadow is the seam that separates it from
     content scrolled underneath it. */
  [part='header-cell'][data-sticky],
  [part='cell'][data-sticky] {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    background: var(--lyra-color-surface);
    box-shadow: 1px 0 0 0 var(--lyra-color-border);
  }
  [part='more-button'],
  [part='reveal-columns-button'] {
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
  [part='more-button']:hover,
  [part='reveal-columns-button']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='more-button']:focus-visible,
  [part='reveal-columns-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
