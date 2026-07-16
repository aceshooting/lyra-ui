import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  [part='base'] {
    overflow: auto;
    max-block-size: var(--lyra-table-max-height, none);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    /* Makes [part='base'] a query container so the @container rules below can
       react to the table's own available width instead of the viewport's. */
    container-type: inline-size;
  }
  [part='filter-label'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
  }
  [part='filter'] {
    min-inline-size: 0;
    flex: 1;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
  }
  [part='filter']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='loading'] {
    display: grid;
    place-items: center;
    min-block-size: var(--lyra-size-8rem);
    padding: var(--lyra-space-l);
  }
  [part='pagination'] {
    display: block;
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
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
    font-size: var(--lyra-font-size-md-sm);
  }
  [part='table'][data-has-column-widths] {
    table-layout: fixed;
  }
  [part='header-cell'] {
    position: sticky;
    inset-block-start: 0;
    background: var(--lyra-color-surface);
    text-align: start;
    font-weight: var(--lyra-font-weight-semibold);
    padding: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
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
  [part='group-cell'] {
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface-raised);
    color: var(--lyra-color-text-quiet);
    font-weight: var(--lyra-font-weight-semibold);
    text-align: start;
  }
  [part='row']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='cell'] {
    padding: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='cell-editor'] {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-brand);
    border-radius: var(--lyra-radius-xs);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
  }
  [part='cell-editor']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='cell'][data-align='end'] {
    text-align: end;
  }
  [part='expand-toggle-cell'] {
    padding: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    text-align: center;
  }
  [part='row-expand-toggle'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    padding: var(--lyra-space-xs);
    cursor: pointer;
    color: inherit;
  }
  [part='row-expand-toggle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='row-expand-icon'] {
    display: inline-block;
    transition: transform var(--lyra-transition-fast);
  }
  [part='row-expand-icon'] svg {
    display: block;
  }
  [part='row-expand-toggle'][aria-expanded='true'] [part='row-expand-icon'] {
    transform: rotate(90deg);
  }
  :host(:dir(rtl)) [part='row-expand-icon'] {
    transform: rotate(180deg);
  }
  :host(:dir(rtl)) [part='row-expand-toggle'][aria-expanded='true'] [part='row-expand-icon'] {
    transform: rotate(90deg);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='row-expand-icon'] {
      transition: none !important;
    }
  }
  [part='expanded-row'] [part='expanded-cell'] {
    padding: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
  }
  /* columns[].sticky pins a column's header/cells to the inline-start edge
     while the table scrolls horizontally — mirrors [part='header-cell']'s
     existing inset-block-start vertical-scroll sticky pattern above, just on
     the other axis. The box-shadow is the seam that separates it from
     content scrolled underneath it. */
  [part='header-cell'][data-sticky],
  [part='cell'][data-sticky] {
    position: sticky;
    /* Set per-column by table.ts's stickyOffsets()/updated(), which measures
       each earlier sticky column's rendered width so multiple sticky columns
       stack left-to-right instead of all pinning to the same edge and
       overlapping. Falls back to 0 for the first sticky column (or before
       the first measurement pass has run). */
    inset-inline-start: var(--lyra-table-sticky-offset, 0);
    z-index: var(--lyra-layer-content);
    background: var(--lyra-color-surface);
    box-shadow: var(--lyra-size-1px) 0 0 0 var(--lyra-color-border);
  }
  [part='header-cell'][data-sticky='end'],
  [part='cell'][data-sticky='end'] {
    /* Mirror image of the 'start' rule above: pinned to the inline-end edge
       instead, with the seam shadow flipped to the opposite physical side
       since content now scrolls underneath from the other direction. */
    inset-inline-start: auto;
    inset-inline-end: var(--lyra-table-sticky-offset, 0);
    box-shadow: calc(-1 * var(--lyra-size-1px)) 0 0 0 var(--lyra-color-border);
  }
  /* box-shadow's X offset is a physical (not logical) value, so it must flip explicitly under RTL:
     a 'start'-pinned column sits on the *right* edge in RTL with content scrolling underneath from
     the left, so its seam belongs on the left (negative X) -- the mirror image of each rule above. */
  :host(:dir(rtl)) [part='header-cell'][data-sticky],
  :host(:dir(rtl)) [part='cell'][data-sticky] {
    box-shadow: calc(-1 * var(--lyra-size-1px)) 0 0 0 var(--lyra-color-border);
  }
  :host(:dir(rtl)) [part='header-cell'][data-sticky='end'],
  :host(:dir(rtl)) [part='cell'][data-sticky='end'] {
    box-shadow: var(--lyra-size-1px) 0 0 0 var(--lyra-color-border);
  }
  [part='foot'] {
    position: sticky;
    inset-block-end: 0;
    background: var(--lyra-color-surface);
  }
  [part='footer-cell'] {
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    font-weight: var(--lyra-font-weight-semibold);
    text-align: start;
  }
  [part='footer-cell'][data-align='end'] {
    text-align: end;
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
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
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
