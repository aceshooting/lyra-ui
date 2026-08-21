import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    /* Public hooks stay undeclared on the host so a theme wrapper's values inherit through. The
       private defaults are consumed only as fallbacks below, and by minimumResizeWidth(). */
    --_lr-table-heat-tint-lo-default: var(--lr-color-brand-quiet);
    --_lr-table-heat-tint-hi-default: var(--lr-color-brand);
    --_lr-table-resize-min-width-default: var(--lr-size-3rem);
    --_lr-table-resize-handle-opacity-default: 0.12;
  }
  [part='base'] {
    overflow: auto;
    max-block-size: var(--lr-table-max-height, none);
    /* Page flow below drops both; auto restores them only while inline content really overflows. */
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Makes [part='base'] a query container, so the @container rules below react to the table's own
       width, not the viewport's. */
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  /* A scroll container clips both axes, so overflow: auto makes [part='base'] the header's sticky
     containing block even when nothing scrolls -- with no --lr-table-max-height the header then
     scrolls away with the page. Opting into page scrolling makes the page the header's scrollport,
     so an uncapped table can still pin its header. */
  :host([scroll-mode='page']) [part='base'],
  :host([scroll-mode='auto']) [part='base']:not([data-scroll-overflow]) {
    overflow: visible;
    max-block-size: none;
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
  :where([part='filter']):hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Pressing a text field is how you focus it, so it gets the same acknowledgement as every other
     control here: one step past the hovered fill toward --lr-color-mix-partner, and back on
     release. */
  :where([part='filter']):active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='filter']::placeholder {
    color: var(--lr-color-text-quiet);
    opacity: 1;
  }
  /* Matches lr-input's unconditional reset (input.styles.ts) -- without it Chrome/Safari paint
     their raw gray cancel-x once the field has text, inconsistent with this fully themed field. */
  [part='filter'][type='search']::-webkit-search-cancel-button,
  [part='filter'][type='search']::-webkit-search-decoration {
    appearance: none;
  }
  /* The visible spinner block, scoped away from the skeleton-appearance status node, which reuses
     [part='loading'] but is sr-only: the placeholder rows are its affordance, so it must not also
     lay out an 8rem centered block. */
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
  /* columns[].priority hides [data-priority='low'] and ['medium'] header/cells as the container
     narrows. priorityColumnsVisible (from [part='reveal-columns-button']) must override that, but a
     @container query can only test ancestor inline-size, not component state -- so it surfaces as
     data-force-visible on [part='base'], which the hide rule's :not() excludes. */
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
  /* Resolved in table.class.ts as a floor: 'fixed' when the layout property asks, when a column
     carries a declared or resized width, or during a resize gesture. Kept off
     [data-has-column-widths], which also means the <colgroup> carries real widths. */
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
    background: var(--lr-table-resize-handle-hover-bg, var(--lr-color-brand));
    opacity: var(
      --lr-table-resize-handle-hover-opacity,
      var(--lr-table-resize-handle-opacity, var(--_lr-table-resize-handle-opacity-default))
    );
  }
  /* The handle is a drag grip, so its pressed state is its dragging state and stays applied for the
     whole gesture. The default doubles the hover opacity; the scoped active hook can decouple it.
     */
  [part='resize-handle']:active,
  [part='resize-handle'][data-resizing] {
    background: var(
      --lr-table-resize-handle-active-bg,
      var(--lr-table-resize-handle-hover-bg, var(--lr-color-brand))
    );
    opacity: var(
      --lr-table-resize-handle-active-opacity,
      calc(
        var(
            --lr-table-resize-handle-hover-opacity,
            var(--lr-table-resize-handle-opacity, var(--_lr-table-resize-handle-opacity-default))
          ) * 2
      )
    );
  }
  [part='resize-handle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* :where() zeroes the attribute qualifiers to (0,1,0), matching the :hover rule below -- at
     (0,3,0) a consumer's own ::part(header-cell) cursor override ((0,1,1)) would lose without
     !important. */
  :where([part='header-cell'][aria-sort]:not([aria-sort='none'])),
  :where([part='header-cell'][data-sortable]) {
    cursor: pointer;
  }
  /* Inline var() fallbacks, not :host declarations -- as in the selected-row rule below: a :host
     declaration shadows any ancestor value, defeating the hook, and Shadow Parts forbids an
     attribute selector after ::part(), so ::part(header-cell)[aria-sort] is invalid CSS. Lets a
     consumer recolor just the sorted header without hijacking a library-wide token. */
  [part='header-cell']:where([aria-sort]:not([aria-sort='none'])) {
    /* Surface fill, not transparent: the cell is position: sticky, so a transparent default lets
       body rows scroll visibly through the sorted column's header in a height-capped table. The
       sticky-column rules below keep it for the same reason. */
    background: var(--lr-table-header-sorted-bg, var(--lr-color-surface));
    color: var(--lr-table-header-sorted-color, inherit);
  }
  /* Both attribute selectors stay unwrapped at (0,3,0): they must out-rank the
     [part='header-cell'][data-sticky] rule below ((0,2,0)), which necessarily declares an opaque
     background: var(--lr-color-surface). columns[].sticky and columns[].sortable compose, and while
     these arms were :where()-zeroed to (0,1,0) a column using both had no hover and no press. */
  [part='header-cell'][data-sortable]:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Re-sorting a large table is the slowest thing this component does, so the press must read
     before the rows move. Same specificity as the :hover arm above and written after it, one step
     further toward --lr-color-mix-partner. */
  [part='header-cell'][data-sortable]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  /* Not scoped to [data-sortable]: the roving-tabindex header stop (table.ts's focusedColKey()) can
     land on any column, so every header cell needs its own focus indicator. */
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
  /* Rotate the wrapping part element, not the svg -- internal/icons.ts's documented contract. This
     previously rotated the inner <svg> directly. */
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
  [part='row'][data-stripe] {
    background: var(--lr-table-row-stripe-bg, transparent);
  }
  /* Inline var() fallback, not a :host declaration, which is re-declared per instance and shadows
     any ancestor value. Needed because Shadow Parts forbids an attribute selector after ::part():
     ::part(row)[aria-selected] is invalid, so recoloring the selected row would otherwise mean
     hijacking --lr-color-brand-quiet library-wide. */
  [part='row'][aria-selected='true'] {
    background: var(--lr-table-row-selected-bg, var(--lr-color-brand-quiet));
  }
  /* MUST stay after the selected-row rule above -- both are (0,2,0), so source order alone decides,
     and the selected row is the likeliest next hover. A distinct color-mix step rather than the
     plain brand-quiet fallback used elsewhere, because the selected row's resting fill already
     resolves to that token. */
  [part='row']:hover {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  /* MUST stay after the selected-row rule above -- both are (0,2,0), so source order alone decides,
     and the selected row is the one a user presses to DEselect. */
  [part='row']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  @media (forced-colors: active) {
    :where([part~='row'][aria-selected='true']) {
      outline: var(--lr-border-width-medium) solid Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
    :where([part~='row']:hover:not([aria-selected='true'])) {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-thin));
    }
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
    color: var(--lr-table-cell-color, inherit);
  }
  /* A column's cell(row) may return any TemplateResult, rendered in this shadow root -- unreachable
     from the page's stylesheet, and ::part() cannot select past its first compound selector, so a
     returned anchor would compute to the UA default link blue. :where() keeps specificity at zero
     so an inline style still wins; --lr-table-cell-link-color: revert restores the UA default. */
  [part='cell'] a:where(:any-link) {
    color: var(--lr-table-cell-link-color, var(--lr-color-brand));
  }
  [part='cell'] a:where(:any-link):hover,
  [part='cell'] a:where(:any-link):focus-visible,
  [part='cell'] a:where(:any-link):active {
    color: var(
      --lr-table-cell-link-hover-color,
      var(--lr-table-cell-link-color, var(--lr-color-brand))
    );
    text-decoration-thickness: var(--lr-border-width-medium);
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
  :where([part='cell-editor']):hover {
    background: var(--lr-color-brand-quiet);
  }
  :where([part='cell-editor']):active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  /* editType: 'number' renders a native type="number" editor; without this reset the browser's
     spinner buttons show as raw UA chrome in an otherwise fully re-themed field -- the same reset
     lr-input and lr-pagination apply. */
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
    background: color-mix(
      in srgb,
      var(--lr-table-heat-tint-hi, var(--_lr-table-heat-tint-hi-default)) var(--lr-table-heat-t),
      var(--lr-table-heat-tint-lo, var(--_lr-table-heat-tint-lo-default))
    );
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
  [part='row-expand-toggle']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
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
  /* columns[].sticky pins a column's header/cells to the inline-start edge during horizontal scroll
     -- the [part='header-cell'] inset-block-start pattern above, on the other axis. The box-shadow
     is the seam over content scrolled underneath. */
  [part='header-cell'][data-sticky],
  [part='cell'][data-sticky] {
    position: sticky;
    /* Set per-column by table.ts's stickyOffsets()/updated(), which measures each earlier sticky
       column's rendered width so several stack instead of all pinning to the same edge. Falls back
       to 0 for the first sticky column, and before the first measurement pass. */
    inset-inline-start: var(--lr-table-sticky-offset, 0);
    z-index: var(--lr-layer-content);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-size-1px) 0 0 0 var(--lr-color-border);
  }
  [part='header-cell'][data-sticky='end'],
  [part='cell'][data-sticky='end'] {
    /* Mirror of the 'start' rule above: pinned to the inline-end edge, seam shadow flipped to the
       opposite physical side since content now scrolls underneath from the other direction. */
    inset-inline-start: auto;
    inset-inline-end: var(--lr-table-sticky-offset, 0);
    box-shadow: calc(-1 * var(--lr-size-1px)) 0 0 0 var(--lr-color-border);
  }
  /* box-shadow's X offset is physical, not logical, so it must flip explicitly under RTL: a
     'start'-pinned column sits on the right edge with content scrolling under from the left, so its
     seam belongs on the left (negative X). */
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
  [part='more-button']:active,
  [part='reveal-columns-button']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='more-button']:focus-visible,
  [part='reveal-columns-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
