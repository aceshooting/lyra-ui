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
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    /* Opt-in theme-level scrollbar hooks -- each reads --lr-theme-scrollbar-* directly, with this
       scrollport's own previous literal ('auto') as the fallback, so a consumer who never sets the
       --lr-theme-* input on an ancestor sees no change. */
    scrollbar-width: var(--lr-theme-scrollbar-width, auto);
    scrollbar-gutter: var(--lr-theme-scrollbar-gutter, auto);
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
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
  /* Replaces the native ::-webkit-search-cancel-button suppressed above -- same "opt-out chrome
     needs a rendered replacement" contract lr-input's own [part='clear-button'] documents. */
  [part='filter-clear'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: 0;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part='filter-clear']:hover {
    color: var(--lr-color-text);
  }
  [part='filter-clear']:active {
    color: var(--lr-color-text);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='filter-clear']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
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
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  /* columns[].priority hides [data-priority='low'] and ['medium'] header/cells once table.class.ts's
     ResizeObserver-driven measurement (recomputeHiddenPriorityColumns(), shared with
     syncAutoScrollMode()'s overflow check) finds the table's content actually overflows [part='base']
     -- not at any fixed container width. That measurement writes data-hide-priority-low/-medium onto
     [part='base'] itself, one tier at a time (low first). priorityColumnsVisible (from
     [part='reveal-columns-button']) must override the hide regardless of which tiers are marked, so it
     surfaces as data-force-visible on [part='base'], which both rules' :not() excludes. Deliberately
     plain attribute selectors, not a @container query: a @container query can only ever read ancestor
     inline-size, never a measured overflow amount or component state, and per the responsive-priority
     decision behind this mechanism the two thresholds may not become themeable custom properties
     either (a @container query cannot read one). */
  [part='base'][data-hide-priority-low]:not([data-force-visible]) [data-priority='low'] {
    display: none;
  }
  [part='base'][data-hide-priority-medium]:not([data-force-visible]) [data-priority='medium'] {
    display: none;
  }
  [part='table'] {
    inline-size: 100%;
    border-collapse: collapse;
    font: inherit;
    /* Longhand after the shorthand above so it overrides only the size, keeping family/weight/etc.
       inherited. Default 'inherit' matches the pre-existing behavior exactly -- this only gives a
       consumer a hook to resize the table's type without touching its ancestor's own font-size. */
    font-size: var(--lr-table-font-size, inherit);
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
    /* --_lr-table-header-bg is set only by the sorted-header rule below (mirroring the
       --_lr-table-row-bg/[part='row'] pattern for body rows) -- reading it here, instead of a plain
       background: var(--lr-color-surface), lets the sorted fill still reach a header cell even when
       the sticky-header rule further below is the one that wins the cascade for 'background'. */
    background: var(--_lr-table-header-bg, var(--lr-color-surface));
    text-align: start;
    font-weight: var(--lr-font-weight-semibold);
    padding: var(--lr-table-cell-padding, var(--lr-space-s));
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
     consumer recolor just the sorted header without hijacking a library-wide token.
     Writes the private --_lr-table-header-bg property (read back by the base [part='header-cell']
     rule above and by the sticky header-cell rule below) instead of only declaring 'background'
     directly -- a sticky sortable column's <th> carries both [data-sticky] and [aria-sort] at once,
     and the sticky rule's own opaque 'background' declaration is (0,2,0) versus this rule's
     (0,1,0), so it would otherwise always out-specify and paint over the sorted fill regardless of
     source order. */
  [part='header-cell']:where([aria-sort]:not([aria-sort='none'])) {
    /* Surface fill, not transparent: the cell is position: sticky, so a transparent default lets
       body rows scroll visibly through the sorted column's header in a height-capped table. The
       sticky-column rules below keep it for the same reason. */
    --_lr-table-header-bg: var(--lr-table-header-sorted-bg, var(--lr-color-surface));
    background: var(--_lr-table-header-bg);
    color: var(--lr-table-header-sorted-color, inherit);
  }
  /* Both attribute selectors stay unwrapped at (0,3,0): they must out-rank the
     [part='header-cell'][data-sticky] rule below ((0,2,0)), which necessarily declares an opaque
     background. columns[].sticky and columns[].sortable compose, and while these arms were
     :where()-zeroed to (0,1,0) a column using both had no hover and no press. */
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
  [part~='sort-icon'] {
    display: inline-block;
    margin-inline-start: var(--lr-space-xs);
    vertical-align: middle;
    transition: transform var(--lr-transition-fast);
  }
  [part~='sort-icon-inactive'] {
    color: var(--lr-color-text-quiet);
  }
  @media (forced-colors: active) {
    [part~='sort-icon-inactive'] {
      color: CanvasText !important;
    }
  }
  [part~='sort-icon'] svg {
    display: block;
  }
  /* Rotate the wrapping part element, not the svg -- internal/icons.ts's documented contract. This
     previously rotated the inner <svg> directly. */
  [part~='sort-icon'][data-dir='asc'] {
    transform: rotate(-90deg);
  }
  [part~='sort-icon'][data-dir='desc'] {
    transform: rotate(90deg);
  }
  @media (prefers-reduced-motion: reduce) {
    [part~='sort-icon'] {
      transition: none !important;
    }
  }
  /* Each row-state rule below also writes the row's effective fill to a private custom property,
     not just the visible background declaration -- [part='header-cell'][data-sticky] and
     [part='cell'][data-sticky] read it back to paint a sticky column with the same striped/
     selected/hovered/active fill as the rest of its row, instead of a flat opaque surface that
     hides the state. Custom properties inherit from [part='row'] down into its own <td>
     descendants, so no JS wiring is required; a header cell never sits inside [part='row'], so it
     is unaffected and keeps its existing plain-surface default. */
  [part='row'][data-stripe] {
    background: var(--lr-table-row-stripe-bg, transparent);
    /* Deliberately a different fallback than the background above: an unstriped row's own fill
       stays transparent by default, but its sticky cell must stay opaque (--lr-color-surface) to
       keep hiding content scrolled underneath -- so this reads the same public token with an
       opaque fallback instead of transparent. */
    --_lr-table-row-bg: var(--lr-table-row-stripe-bg, var(--lr-color-surface));
  }
  /* Inline var() fallback, not a :host declaration, which is re-declared per instance and shadows
     any ancestor value. Needed because Shadow Parts forbids an attribute selector after ::part():
     ::part(row)[aria-selected] is invalid, so recoloring the selected row would otherwise mean
     hijacking --lr-color-brand-quiet library-wide. */
  [part='row'][aria-selected='true'] {
    --_lr-table-row-bg: var(--lr-table-row-selected-bg, var(--lr-color-brand-quiet));
    background: var(--_lr-table-row-bg);
  }
  /* MUST stay after the selected-row rule above -- both are (0,2,0), so source order alone decides,
     and the selected row is the likeliest next hover. A distinct color-mix step rather than the
     plain brand-quiet fallback used elsewhere, because the selected row's resting fill already
     resolves to that token. */
  [part='row']:hover {
    --_lr-table-row-bg: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
    background: var(--_lr-table-row-bg);
  }
  /* MUST stay after the selected-row rule above -- both are (0,2,0), so source order alone decides,
     and the selected row is the one a user presses to DEselect. */
  [part='row']:active {
    --_lr-table-row-bg: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    background: var(--_lr-table-row-bg);
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
    /* A second, tighter hook than --lr-table-cell-padding -- group and footer cells share this
       shorthand's two-value (block/inline) shape today, and a single flattened hook would either
       lose that distinction or force every ordinary cell to adopt the tighter block spacing. */
    padding: var(--lr-table-cell-padding-compact, var(--lr-space-xs) var(--lr-space-s));
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
    padding: var(--lr-table-cell-padding, var(--lr-space-s));
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    color: var(--lr-table-cell-color, inherit);
  }
  /* [data-editable] marks an editTrigger: 'double-click' column's resting (not currently open)
     cell -- the one the table gives its own tabindex=-1 roving-focus stop, reachable via
     ArrowLeft/ArrowRight from the row (see onRowLateralKeyDown in table.class.ts) and opened with
     F2/Enter/double-click. Hover mirrors the focus ring below, matching every other interactive
     part in this stylesheet. */
  [part='cell'][data-editable] {
    transition: var(--lr-transition-interactive);
  }
  :where([part='cell'][data-editable]):hover {
    cursor: pointer;
    background: var(--lr-color-brand-quiet);
  }
  :where([part='cell'][data-editable]):active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='cell'][data-editable]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
  /* editType: 'select' renders a native select for cell-editor; reset its own UA chrome (the
     browser's default arrow/inset) and recolor its options explicitly, since an option list
     paints in a top-layer the shadow root's own color/background do not reach on every engine.
     The appearance reset removes the native disclosure arrow with no replacement, leaving the
     editor looking like a plain text field -- padding-inline-end reserves room for the themed one
     painted just below, on the enclosing cell, so the selected label never runs under it. */
  select[part='cell-editor'] {
    appearance: none;
    padding-inline-end: calc(var(--lr-space-s) + var(--lr-size-0-75rem));
    cursor: pointer;
  }
  select[part='cell-editor'] option {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  /* Painted on the cell, not the select: a <select> is a replaced form control, so it renders
     neither ::before/::after, nor could a mask apply directly to it without clipping its own
     text instead of merely decorating a corner of it. This reuses the mask + 'background:
     currentColor' technique already shipped (and forced-colors-verified) for the map
     attribution-toggle glyph in map.styles.ts, painting the same chevron shape lr-select draws
     as a literal SVG child of its own [part='expand-icon'] (internal/icons.ts's chevronIcon()) --
     rotated 90deg to point down exactly like that component's [part="expand-icon"] svg rule,
     since a bare select cannot host that child directly. :has() scopes the rule to exactly the
     cell currently rendering a select editor, so a resting cell or a text/number editor is
     untouched. inset-inline-end is a real logical property (unlike background-position, which
     this file's own row-expand-icon/sticky-cell rules mirror by hand under :host(:dir(rtl))), so
     the glyph tracks the inline-end edge under RTL with no extra rule. */
  [part='cell']:has(> select[part='cell-editor']) {
    position: relative;
  }
  [part='cell']:has(> select[part='cell-editor'])::after {
    content: '';
    position: absolute;
    inset-inline-end: var(--lr-space-s);
    inset-block-start: 50%;
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    color: var(--lr-color-text-quiet);
    background: currentColor;
    mask: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpolyline points="9 6 15 12 9 18"%3E%3C/polyline%3E%3C/svg%3E')
      center / contain no-repeat;
    transform: translateY(-50%) rotate(90deg);
    pointer-events: none;
  }
  @media (forced-colors: active) {
    [part='cell']:has(> select[part='cell-editor'])::after {
      forced-color-adjust: none;
      color: ButtonText;
    }
  }
  [part='cell'][data-align='end'] {
    text-align: end;
  }
  [part='row-total-cell'] {
    padding: var(--lr-table-cell-padding, var(--lr-space-s));
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    text-align: center;
  }
  [part='row-expand-toggle'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
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
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    background: var(--lr-color-surface);
  }
  /* columns[].sticky pins a column's header/cells to the inline-start edge during horizontal scroll
     -- the [part='header-cell'] inset-block-start pattern above, on the other axis. The box-shadow
     is the seam over content scrolled underneath. Structural rule shared by both element types;
     'background' is declared per element type just below, since a body cell and a header cell read
     different private properties for it. */
  [part='header-cell'][data-sticky],
  [part='cell'][data-sticky] {
    position: sticky;
    /* Set per-column by table.ts's stickyOffsets()/updated(), which measures each earlier sticky
       column's rendered width so several stack instead of all pinning to the same edge. Falls back
       to 0 for the first sticky column, and before the first measurement pass. */
    inset-inline-start: var(--lr-table-sticky-offset, 0);
    z-index: var(--lr-layer-content);
    box-shadow: var(--lr-size-1px) 0 0 0 var(--lr-color-border-subtle);
  }
  /* Reads --_lr-table-row-bg, written by the [part='row'] stripe/selected/hover/active rules above,
     so a sticky body cell shows the same fill as the rest of its row instead of painting a flat
     surface over the state. */
  [part='cell'][data-sticky] {
    background: var(--_lr-table-row-bg, var(--lr-color-surface));
  }
  /* Reads --_lr-table-header-bg, written only by the sorted-header rule above -- a sticky AND
     sorted column's <th> carries both [data-sticky] and [aria-sort] at once, so without this split
     this rule's opaque background (0,2,0) always out-specified and painted over the sorted rule's
     own 'background' declaration (0,1,0), regardless of source order. A sticky header cell that is
     not sorted still falls back to the plain surface color, unchanged from before. */
  [part='header-cell'][data-sticky] {
    background: var(--_lr-table-header-bg, var(--lr-color-surface));
  }
  [part='header-cell'][data-sticky='end'],
  [part='cell'][data-sticky='end'] {
    /* Mirror of the 'start' rule above: pinned to the inline-end edge, seam shadow flipped to the
       opposite physical side since content now scrolls underneath from the other direction. */
    inset-inline-start: auto;
    inset-inline-end: var(--lr-table-sticky-offset, 0);
    box-shadow: calc(-1 * var(--lr-size-1px)) 0 0 0 var(--lr-color-border-subtle);
  }
  /* box-shadow's X offset is physical, not logical, so it must flip explicitly under RTL: a
     'start'-pinned column sits on the right edge with content scrolling under from the left, so its
     seam belongs on the left (negative X). */
  :host(:dir(rtl)) [part='header-cell'][data-sticky],
  :host(:dir(rtl)) [part='cell'][data-sticky] {
    box-shadow: calc(-1 * var(--lr-size-1px)) 0 0 0 var(--lr-color-border-subtle);
  }
  :host(:dir(rtl)) [part='header-cell'][data-sticky='end'],
  :host(:dir(rtl)) [part='cell'][data-sticky='end'] {
    box-shadow: var(--lr-size-1px) 0 0 0 var(--lr-color-border-subtle);
  }
  [part='foot'] {
    position: sticky;
    inset-block-end: 0;
    background: var(--lr-color-surface);
  }
  [part='footer-cell'] {
    /* Same tighter hook as [part='group-cell'] -- see the comment there. */
    padding: var(--lr-table-cell-padding-compact, var(--lr-space-xs) var(--lr-space-s));
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
    /* The control tier, not --lr-color-border-subtle: this rule is the only edge the full-width
       button draws, and under a monochrome theme its brand-coloured label no longer sets it apart
       from the data rows above. */
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
  /* Structural full-width row, deliberately not [part='row'] -- like [part='group-row']/
     [part='expanded-row'], it is not a data row and must not pick up hover/selected/stripe
     background or the roving-tabindex focus ring those rules carry. */
  [part='error-row'] [part='error-cell'] {
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    background: var(--lr-color-surface);
  }
  [part='retry-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--lr-space-2xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: none;
    color: var(--lr-color-brand);
    font: inherit;
    cursor: pointer;
  }
  [part='retry-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='retry-button']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='retry-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
