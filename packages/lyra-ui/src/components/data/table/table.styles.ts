import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    --lr-table-heat-tint-lo: var(--lr-color-brand-quiet);
    --lr-table-heat-tint-hi: var(--lr-color-brand);
    --lr-table-resize-min-width: var(--lr-size-3rem);
    --lr-table-resize-handle-opacity: 0.12;
  }
  [part='base'] {
    overflow: auto;
    max-block-size: var(--lr-table-max-height, none);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Makes [part='base'] a query container so the @container rules below can
       react to the table's own available width instead of the viewport's. */
    container-type: inline-size;
  }
  [part='filter-label'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  [part='filter'] {
    min-inline-size: 0;
    flex: 1;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='filter']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='filter']::placeholder {
    color: var(--lr-color-text-quiet);
    opacity: 1;
  }
  /* Matches lr-input's own unconditional reset (input.styles.ts) -- without it Chrome/Safari paint
     their raw gray cancel-x glyph once the field has text, visually inconsistent with the rest of
     this fully themed field (border, background, placeholder color). */
  [part='filter'][type='search']::-webkit-search-cancel-button,
  [part='filter'][type='search']::-webkit-search-decoration {
    appearance: none;
  }
  /* The visible spinner block. Scoped away from the skeleton-appearance status node, which reuses
     [part='loading'] but is visually hidden (.sr-only) — the placeholder rows are its visible
     affordance, so it must not also lay out an 8rem centered block. */
  [part='loading']:not(.sr-only) {
    display: grid;
    place-items: center;
    min-block-size: var(--lr-size-8rem);
    padding: var(--lr-space-l);
  }
  [part='pagination'] {
    display: block;
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
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
  @container (max-inline-size: 899.98px) {
    [part='base']:not([data-force-visible]) [data-priority='low'] {
      display: none;
    }
  }
  @container (max-inline-size: 639.98px) {
    [part='base']:not([data-force-visible]) [data-priority='medium'] {
      display: none;
    }
  }
  [part='table'] {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--lr-font-size-md-sm);
  }
  /* Resolved in table.class.ts as a floor: 'fixed' whenever the layout property asks for it, or
     any column carries a declared/resized width, or a resize gesture is in flight. Kept off
     [data-has-column-widths], which additionally means "<colgroup> carries real widths". */
  [part='table'][data-layout='fixed'] {
    table-layout: fixed;
  }
  [part='header-cell'] {
    position: sticky;
    inset-block-start: 0;
    background: var(--lr-color-surface);
    text-align: start;
    font-weight: var(--lr-font-weight-semibold);
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    cursor: default;
    white-space: nowrap;
  }
  [part='header-cell'][data-resizable] {
    padding-inline-end: calc(var(--lr-space-s) + var(--lr-size-0-5rem));
  }
  [part='resize-handle'] {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: var(--lr-size-0-5rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: col-resize;
    touch-action: none;
  }
  [part='resize-handle']:hover,
  [part='resize-handle']:focus-visible {
    background: var(--lr-color-brand);
    opacity: var(--lr-table-resize-handle-opacity);
  }
  [part='resize-handle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* :where() zeroes the attribute qualifiers' specificity so this drops to (0,1,0), matching the
     :hover rule below -- otherwise a consumer's own ::part(header-cell) { cursor: ... } override
     ((0,1,1)) would lose to this rule's (0,3,0) without !important, the same defect the :hover
     remediation one rule down was written to fix. */
  :where([part='header-cell'][aria-sort]:not([aria-sort='none'])),
  :where([part='header-cell'][data-sortable]) {
    cursor: pointer;
  }
  /* Inline var() fallbacks rather than :host declarations -- same rationale as the selected-row
     rule below: a :host-declared custom property shadows any ancestor value, defeating the override
     hook, and Shadow Parts forbids an attribute selector after ::part() so
     ::part(header-cell)[aria-sort] is invalid CSS. These let a consumer recolor just the
     currently-sorted header without hijacking a library-wide token. */
  [part='header-cell']:where([aria-sort]:not([aria-sort='none'])) {
    background: var(--lr-table-header-sorted-bg, transparent);
    color: var(--lr-table-header-sorted-color, inherit);
  }
  /* :where() zeroes the wrapped attribute selectors' specificity contribution, leaving only :hover
     itself -- (0,1,0) total, functionally identical selection to
     [part='header-cell'][data-sortable]:hover ((0,3,0)) but now losing (on the pseudo-element
     tiebreak) to a consumer's own ::part(header-cell):hover override ((0,1,1)) without that
     consumer needing !important. Matches attachment-trigger.styles.ts's remediation pattern. */
  :where([part='header-cell'][data-sortable]):hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Not scoped to [data-sortable] — the roving-tabindex header stop (see
     table.ts's focusedColKey()) can land on any column, sortable or not, so
     every header cell needs its own visible focus indicator. */
  [part='header-cell']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='header-cell'][data-align='end'] {
    text-align: end;
  }
  [part='sort-icon'] {
    display: inline-block;
    margin-inline-start: var(--lr-space-xs);
    vertical-align: middle;
    transition: transform var(--lr-transition-fast);
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
    background: var(--lr-color-brand-quiet);
  }
  /* Inline var() fallback rather than a :host declaration -- a :host-declared custom property is
     re-declared on every instance and shadows any ancestor value, which would defeat the whole
     point of the override hook. Needed because Shadow Parts forbids an attribute selector after
     ::part(), so ::part(row)[aria-selected] is invalid CSS and a consumer would otherwise have to
     hijack the library-wide --lr-color-brand-quiet token to recolor the selected row. */
  [part='row'][aria-selected='true'] {
    background: var(--lr-table-row-selected-bg, var(--lr-color-brand-quiet));
  }
  [part='group-cell'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text-quiet);
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
  }
  [part='row']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='cell'] {
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='cell-editor'] {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-brand);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='cell-editor']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* editType: 'number' cells render a native type="number" editor; without this reset the
     browser's default up/down spinner buttons show in raw, unstyled UA chrome inside an otherwise
     fully re-themed field (custom border/background/focus ring) -- matches lr-input's/
     lr-pagination's own identical reset. */
  [part='cell-editor'][type='number'] {
    appearance: textfield;
  }
  [part='cell-editor'][type='number']::-webkit-inner-spin-button,
  [part='cell-editor'][type='number']::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
  [part='cell'][data-align='end'] {
    text-align: end;
  }
  [part='row-total-cell'] {
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    font-weight: var(--lr-font-weight-semibold);
    text-align: end;
  }
  [part='cell'][data-heat] {
    background: color-mix(in srgb, var(--lr-table-heat-tint-hi) var(--lr-table-heat-t), var(--lr-table-heat-tint-lo));
  }
  [part='expand-toggle-cell'] {
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    text-align: center;
  }
  [part='row-expand-toggle'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    padding: var(--lr-space-xs);
    cursor: pointer;
    color: inherit;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='row-expand-toggle']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='row-expand-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='row-expand-icon'] {
    display: inline-block;
    transition: transform var(--lr-transition-fast);
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
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
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
    inset-inline-start: var(--lr-table-sticky-offset, 0);
    z-index: var(--lr-layer-content);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-size-1px) 0 0 0 var(--lr-color-border);
  }
  [part='header-cell'][data-sticky='end'],
  [part='cell'][data-sticky='end'] {
    /* Mirror image of the 'start' rule above: pinned to the inline-end edge
       instead, with the seam shadow flipped to the opposite physical side
       since content now scrolls underneath from the other direction. */
    inset-inline-start: auto;
    inset-inline-end: var(--lr-table-sticky-offset, 0);
    box-shadow: calc(-1 * var(--lr-size-1px)) 0 0 0 var(--lr-color-border);
  }
  /* box-shadow's X offset is a physical (not logical) value, so it must flip explicitly under RTL:
     a 'start'-pinned column sits on the *right* edge in RTL with content scrolling underneath from
     the left, so its seam belongs on the left (negative X) -- the mirror image of each rule above. */
  :host(:dir(rtl)) [part='header-cell'][data-sticky],
  :host(:dir(rtl)) [part='cell'][data-sticky] {
    box-shadow: calc(-1 * var(--lr-size-1px)) 0 0 0 var(--lr-color-border);
  }
  :host(:dir(rtl)) [part='header-cell'][data-sticky='end'],
  :host(:dir(rtl)) [part='cell'][data-sticky='end'] {
    box-shadow: var(--lr-size-1px) 0 0 0 var(--lr-color-border);
  }
  [part='foot'] {
    position: sticky;
    inset-block-end: 0;
    background: var(--lr-color-surface);
  }
  [part='footer-cell'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
  }
  [part='footer-cell'][data-align='end'] {
    text-align: end;
  }
  [part='more-button'],
  [part='reveal-columns-button'] {
    display: block;
    inline-size: 100%;
    padding: var(--lr-space-s);
    border: none;
    background: none;
    color: var(--lr-color-brand);
    font: inherit;
    cursor: pointer;
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='more-button']:hover,
  [part='reveal-columns-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='more-button']:focus-visible,
  [part='reveal-columns-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
