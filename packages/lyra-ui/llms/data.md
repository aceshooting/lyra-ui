## `lr-sparkline`

Zero-dependency inline SVG trend chart (mirrors `<wa-sparkline>`).

**Properties:**
- `values: number[] = []`
- `type: 'line' | 'bar' | 'area' = 'line'`
- `min?: number` (defaults to data minimum)
- `max?: number` (defaults to data maximum)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the localized
  generated summary on the internal SVG

**Events:** none.

**Slots:** none.

**CSS parts:** `line`, `area`, `bar`

**Themeable custom properties:** `--lr-color-brand` (pure CSS cascade, no JS/`getComputedStyle`
bridging needed), `--lr-sparkline-stroke-width` (default `1.5` — stroke width of the line/area
path), and `--lr-sparkline-area-opacity` (default `0.15` — fill opacity of the area under the
line, `type="area"` only).

**Optional peer deps:** none.

```html
<lr-sparkline type="area"></lr-sparkline>
<script>
  document.querySelector('lr-sparkline').values = [3, 5, 4, 8, 6, 9, 7];
</script>
```

**Known gotchas:**
- The semantic `role="img"` and accessible name live on the SVG that owns the graphic. The generated
  summary is localized, formats the last value with `effectiveLocale`, and can be replaced through
  `accessibleLabel`/host `aria-label`. It remains a concise summary rather than a tabular fallback.
- flat data (every value equal, so the auto-computed range spans zero) now renders a centered
  midline/mid-height bars instead of collapsing every point to the bottom edge, and a single-value
  series renders a visible flat line (a zero-length path was previously invisible). **Every** `type`
  (`line`/`area`/`bar`) decimates a `values` array past 500 points down to at most 500 plotted
  samples — evenly sampled by index, always keeping the first and last value exactly, not
  aggregated/averaged. `type="bar"` caps at 500 rendered `<rect>`s directly; `line`/`area` cap the
  point count baked into the single `<path>`'s `d` string instead (an uncapped path string also
  grows unbounded, even though the element count stays at one `<path>`). Auto `min`/`max` is still
  scanned from the *full* pre-decimation `values` array, so a real extreme value that decimation
  happens to drop can't silently narrow the rendered scale.

---

## `lr-stat`

KPI/stat card — value + unit + label + optional icon/trend/caption.

**Properties:**
- `label: string = ''`
- `value: string = ''`
- `unit: string = ''`
- `href?: string` — when it resolves to a safe URL, the root is a real whole-stat `<a>`; unsafe
  URL schemes keep the stat non-interactive
- `target?: string` / `rel?: string` — forwarded to the anchor while `href` is active
- `variant: 'neutral'|'success'|'warning'|'danger' = 'neutral'` (reflected)
- `trend: number = NaN` (a `NaN` sentinel hides the trend pill entirely — set an actual number to
  show it)
- `caption: string = ''`
- `goodDirection: 'up'|'down' = 'up'` (attribute `good-direction`) — which trend direction counts
  as "good"; inverts arrow/color polarity for cost/latency/error-rate-style metrics where a
  *decrease* is the win.
- `rows: StatRow[] = []` (attribute: false) — `StatRow { label: string; value: string; exactValue?:
  string }`; rendered as a simple label/value breakdown list (`[part="rows"]`/`[part="row"]`/
  `[part="row-label"]`/`[part="row-value"]`) beneath the caption, hidden entirely when empty. A row's
  optional `exactValue` mirrors the headline `exactValue`/`exact-value` pattern: rendered as a `title`
  tooltip on that row's `[part="row-value"]` and gives it `tabindex="0"`, independently per row —
  unset rows are unaffected.
- `emphasis: boolean = false` (reflected) — visual emphasis (e.g. for a "headline" stat in a group):
  a brand-colored accent edge, orthogonal to the status `variant`; status semantics still win over
  it — `emphasis` only additionally tints `[part="value"]` brand-colored when `variant` is still
  `'neutral'`, never overriding an actual `success`/`warning`/`danger` value color
- `exactValue: string = ''` (attribute `exact-value`) — rendered as a `title` attribute on
  `[part="value"]` for a hover tooltip (e.g. `value="$1.2K" exact-value="$1,204.37"`); also gives
  `[part="value"]` `tabindex="0"` (only when set) so the tooltip is reachable by keyboard focus, not
  just hover
- `sub: string = ''` — a secondary line distinct from `caption`, e.g. a comparison-period label,
  rendered as `[part="sub"]` between the trend pill and the caption; hidden entirely when unset
- `prose: boolean = false` (reflected) — CSS-only variant that shrinks/lightens `[part="value"]` and
  hides `[part="unit"]`, for rendering a loading/status message in place of a numeric value
- `compact: boolean = false` (reflected) — tighter card padding; same convention as `lr-empty`'s and
  `lr-widget`'s `compact`
- `appearance: 'card'|'plain' = 'card'` (reflected) — visual chrome, mirroring `lr-card`'s
  `appearance` vocabulary. `'card'` keeps the bordered, filled, padded box that stretches to fill its
  parent; `'plain'` removes the border, background, padding, corner radius **and** the
  `block-size: 100%` stretch, so the stat can sit inline in prose, a toolbar, or a table cell.
  `plain` wins over `compact` when both are set (there is no padding left to tighten), and it drops
  `emphasis`'s accent edge — that edge is card chrome — while `emphasis`'s brand value tint still
  applies. A `plain` stat with a safe `href` swaps the card's border-color/lift hover affordance
  (invisible with no border) for an underline on `[part="value"]`; the `:focus-visible` ring is
  unchanged
- `orientation: 'vertical'|'horizontal' = 'vertical'` (reflected) — layout axis. `'vertical'` stacks
  label, value, trend, sub and caption. `'horizontal'` lays label, value+unit, trend, sub and caption
  out on a single wrapping baseline row; `[part="spark"]` and `[part="rows"]` have no sensible place
  on a text baseline and stay stacked on their own full-width line beneath that row

**Events:** none.

**Slots:** default (leading icon), `caption` (rich caption content — overrides the `caption`
attribute when slotted content is provided), `spark` (a sparkline, e.g. `<lr-sparkline
slot="spark">`, or other compact trend visual — `lr-stat` only reserves the slot and doesn't
render one itself), `sub` (rich sub-line content — overrides the `sub` attribute when slotted content
is provided)

**CSS parts:** `base` (a `<div>`, or an `<a>` for a safe `href`), `icon`, `label` (carries `hidden`,
and is collapsed, whenever `label` is empty — a label-less stat leaves no blank line above the
value), `value-row`, `value`, `unit`, `trend`, `sub`, `spark`,
`caption`, `rows`, `row`, `row-label`, `row-value` — `[part="value"]` gets `aria-labelledby` pairing
it with `[part="label"]`'s generated id whenever `label` is non-empty (so tabbing straight to the
`exactValue`-focusable value still announces e.g. "Revenue $1.2K", not just the bare value); each
`[part="row-value"]` is paired the same way with its own row's `[part="row-label"]`.

**Themeable custom properties:** shared tokens only (`--lr-color-success/-warning/-danger` drive
the `variant`-colored value text and up/down trend pill; `--lr-color-brand` drives `emphasis`'s
accent edge and value tint).

**Optional peer deps:** none.

```html
<lr-stat label="Active users" value="1,204" trend="4.2" variant="success">
  <svg slot="">...</svg>
</lr-stat>
<lr-stat label="Memories" value="128" href="/memories"></lr-stat>
```

**Known gotchas:**
- When `href` makes the whole stat a link, exact-value spans keep their hover tooltips but omit
  their own `tabindex` to avoid nesting focus targets inside the anchor.
- no `aria-live` region wraps `value`/`trend` — an in-place update after first render still isn't
  proactively announced to screen readers. The trend pill's direction/polarity is no longer
  conveyed by icon rotation/color alone, though: a visually-hidden span now spells it out in plain
  language (e.g. "increased 4.2%, good" / "decreased 2%, bad" / "unchanged"), so a screen reader
  landing on the pill (rather than being live-notified of a change) gets the full meaning, not just
  an `aria-hidden` arrow glyph.

---

## `lr-table`

Sort/select-aware data table. Sorting remains consumer-controlled; optional filtering, pagination,
and loading chrome are built in while remaining controlled at the public API boundary. A
`columns[].heatValue`-opted-in heat-tint mode paints a shared, normalized color-mix background across
every tinted cell (auto-derived domain, or overridden via `heatTintScale`); `rowTotal`/`grandTotal`
add a trailing totals column mirroring `expandedContent`'s leading one — `rowTotal(row)` renders
per-row, `grandTotal(rows)` renders at its intersection with the footer row — both sharing `footer`'s
own "consumer computes/renders" contract rather than assuming addition.

**Properties:**
- `columns: TableColumn<T>[] = []` (attribute: false) — `{ key, label, headerCell?, width?,
  minWidth?, maxWidth?, resizable?, sortable?, align?: 'start'|'end', priority?: 'medium'|'low', sticky?: boolean |
  'start' | 'end', footer?, cellStyle?, heatValue?, cell: (row) => unknown }` —
  `priority` progressively hides that column via a `@container` query as `[part='base']` narrows
  (`'low'` hides first, under a ~900px container width; `'medium'` next, under ~640px; both
  breakpoints are fixed in `table.styles.ts`, not themeable tokens), reversible via
  `[part='reveal-columns-button']`; `sticky` pins that column's header/cells to the logical start
  (`true`/`'start'`) or end edge while the table scrolls horizontally — multiple sticky columns stack
  in logical order (each measures every earlier sticky column's rendered width via
  `--lr-table-sticky-offset`) instead of overlapping at the same edge; `footer` renders a
  sticky-bottom footer cell for that column, computed from every currently-rendered row (post-sort,
  pre-pagination) — e.g. a column total — omit it for a column with no footer value, and a
  `[part='foot']` (`<tfoot>`) only renders at all when at least one column defines `footer`;
  `heatValue(row) => number | null | undefined` opts a column into heat-tint mode: its presence on
  any column is the opt-in signal (no separate boolean), a `null`/`undefined` return excludes that
  cell from both the domain and the tint ("no data", not "zero"), and every `heatValue`-defining
  column shares one normalized `color-mix()` background scale (see `heatTintScale` below) painted
  via the retheme-able `--lr-table-heat-tint-lo`/`-hi` custom properties, matching `lr-heatmap`'s
  own ramp-token convention; `cellStyle` is applied directly to the generated `<td>` via `styleMap` — e.g. a computed heat-tint
  background a `cell()`-returned inner element can't paint into the cell's own padding — omit it for
  no per-cell style override (the default, unchanged output); `editable` enables double-click
  editing, `editValue` supplies the editor value, and `editType` selects `text` or `number`
  `cellTitle(row) => string | undefined` is the `title` analogue of `cellStyle`, applied directly to
  the generated `<td>` — e.g. the untruncated text behind an ellipsized cell, or a formatted
  timestamp behind a relative one;
  `resizable` adds a focusable separator `[part='resize-handle']` and emits `lr-column-resize` with
  the live width in CSS pixels. Drag it, or use logical ArrowLeft/ArrowRight for 10px steps (mirrored
  under RTL), Shift+Arrow for 50px steps, Home for the minimum, and End for an explicit pixel
  `maxWidth`; explicit pixel `minWidth`/`maxWidth` values bound both input paths. The separator
  exposes its current/minimum/bounded-maximum pixel width through ARIA value attributes.
- `columnsHidden: boolean = false` (attribute `columns-hidden`, reflected) — computed/read-only: true
  when a `priority` column is *actually* hidden right now by the `@container` breakpoints above, or
  `showAllColumns` force-visible mode is currently active. Measured via a `ResizeObserver` on
  `[part='base']` plus a post-render DOM check, so it settles one render cycle after a `columns`/
  `rows`/width change lands — poll for the settled value (e.g. `await el.updateComplete;` twice, or
  `waitUntil()`) rather than assuming a single `updateComplete` covers it. Setting it directly has no
  lasting effect; it's recomputed on the next render or resize. `[part='reveal-columns-button']` now
  renders exactly when `columnsHidden` is true — no longer whenever any column merely *declares* a
  `priority` regardless of whether anything is actually hidden
- `rows: T[] = []` (attribute: false)
- `layout: 'auto'|'fixed' = 'auto'` (reflected) — a **floor** on the `<table>`'s `table-layout`, not
  an override. `'fixed'` forces the fixed algorithm even when no column declares a `width`, so every
  column shares the available width evenly and long cell content is clipped/wrapped instead of
  stretching its column. The default `'auto'` still *resolves* to `fixed` whenever a column declares
  a `width`, a column has been drag-resized, or a resize gesture is in flight — column resizing does
  not work under `table-layout: auto`, so `'auto'` can never mean "never fixed". See the gotchas for
  the two consequences of the fixed algorithm worth knowing before opting in
- `sortKey: string = ''` (attribute `sort-key`)
- `sortDir: 'asc'|'desc' = 'asc'` (attribute `sort-dir`)
- `rowKey?: (row: T) => string | number` (attribute: false) — derives each row's stable identity for
  DOM-reconciliation and the delegated row click/keydown lookup; falls back to the row's array index
  when omitted, which is only safe while `rows` never reorders — set it whenever `rows` can be
  sorted/filtered/re-ordered across renders, or selection/click can silently attach to the wrong row
- `selectedKey: string | number | null = null` (attribute: false) — **single**-selection only
- `selectionMode: 'none'|'single'|'multiple' = 'none'` (attribute `selection-mode`, reflected) —
  opt-in self-managed row selection; the default remains presentational
- `selectedKeys: Set<string | number> = new Set()` (attribute: false) — the selected raw row keys
  used by multiple selection
- `filterable: boolean = false` (attribute `filterable`, reflected) — renders a localized search
  field above the grid
- `filterText: string = ''` (attribute `filter-text`) — controlled filter text
- `filter?: (row: T, text: string) => boolean` (attribute: false) — typed predicate used by the
  filter field; when omitted, rows are matched against their JSON representation
- `filterLabel: string = ''` (attribute `filter-label`) and `filterPlaceholder: string = ''`
  (attribute `filter-placeholder`) — optional localized-label overrides
- `spellcheck: boolean = true`, `autocapitalize: string = ''`, `autoCorrect: string = ''`
  (attribute `autocorrect`) — forwarded to the filter input and, for a `'text'` (the default)
  `editType`, the inline cell editor; no effect on a `'number'` cell editor. `spellcheck="false"`
  is parsed as `false` via a string-aware converter (Lit's default presence-based boolean
  converter would otherwise treat any attribute value, including the literal string `"false"`, as
  `true`).
- `loading: boolean = false` (attribute `loading`, reflected) and `loadingLabel: string = ''`
  (attribute `loading-label`) — renders busy chrome and suppresses the real rows while loading
- `loadingAppearance: 'spinner'|'skeleton' = 'spinner'` (attribute `loading-appearance`, reflected) —
  how `loading` renders. `'spinner'` replaces the whole grid with an indeterminate spinner.
  `'skeleton'` instead renders the real table — the same `<colgroup>` (declared *and* drag-resized
  widths included), the same `<thead>`, the filter field and the pagination footer — and fills
  `<tbody>` with placeholder rows, so a cold load sketches the grid's shape rather than collapsing to
  a spinner and reflowing when the rows land. Kept as a separate property rather than widening
  `loading` to a string union, so `?loading=${…}` bindings and `el.loading === true` checks keep
  working
- `skeletonRows: number = 0` (attribute `skeleton-rows`) — placeholder row count under
  `loadingAppearance="skeleton"`. `0` derives the count instead: the normalized `pageSize` when
  pagination is on (capped at 20, so a large page size can't emit thousands of placeholder cells),
  otherwise 3. Any positive value is used verbatim and is *not* capped. Ignored entirely under the
  default spinner appearance
- `pageSize: number = 0` (attribute `page-size`) — positive values enable controlled pagination;
  zero disables the pagination footer
- `page: number = 1` (attribute `page`, reflected) — controlled current page
- `totalItems: number = -1` (attribute `total-items`) — server-side total item count; `-1` derives
  the total from filtered rows
- `paginationMode: 'client'|'server' = 'client'` (attribute `pagination-mode`, reflected) — client
  mode slices rows; server mode renders the supplied page unchanged
- Editable columns emit `lr-cell-edit` on commit and never mutate the supplied row object.
- `groupBy?: (row: T) => string | number` (attribute: false) — inserts a non-focusable full-width
  group row before each group
- `groupLabel?: (key: string | number, rows: T[]) => unknown` (attribute: false) — custom group
  header content; without it, the group key is rendered as text
- `expandedContent?: (row: T) => unknown` (attribute: false) — enables a leading expand toggle and
  renders a full-width detail row beneath expanded records
- `canExpand?: (row: T) => boolean` (attribute: false) — optional per-row gate for expansion
- `expandedKeys: Set<string | number> = new Set()` (attribute: false) — consumer-controlled expanded
  state; update it in response to `lr-row-expand-toggle`
- `hasMore: boolean = false` (attribute `has-more`, reflected)
- `moreLabel: string = 'Load more'` (attribute `more-label`)
- `emptyHeading: string = 'No data'` (attribute `empty-heading`)
- `emptyDescription: string = ''` (attribute `empty-description`)
- `noColumnsHeading: string = 'No columns configured'` (attribute `no-columns-heading`)
- `noColumnsDescription: string = ''` (attribute `no-columns-description`)
- `emptyCompact?: boolean` (attribute `empty-compact`) — overrides the built-in `[part='empty']`
  state's `compact` rendering. Tri-state: leave it `undefined` (the default) to keep each empty
  branch's own built-in default — the two shadow-root-level branches (no columns, no rows) render
  spacious, while the filtered-to-zero branch, which sits inside `[part='base']` alongside the filter
  field, renders compact. `empty-compact="false"` forces the spacious rendering everywhere, and is
  parsed as `false` rather than as mere attribute presence. Has no effect once the `empty` slot is
  filled
- `revealColumnsLabel: string = 'Show all columns'` (attribute `reveal-columns-label` — the
  reveal-button's label while `priority`-hidden columns are hidden)
- `hideColumnsLabel: string = 'Show fewer columns'` (attribute `hide-columns-label` — the same
  button's label once they've been revealed)
- `showAllColumns: boolean = false` (attribute `show-all-columns`, reflected) — forces responsive
  priority columns visible and is updated by the built-in reveal button
- `heatTintScale?: { min?: number; max?: number }` (attribute: false) — overrides the auto-derived
  heat-tint domain (min/max of every `heatValue` result across every currently-rendered row —
  post-sort, pre-pagination, the same rows `footer(rows)` already sees). Unset (the default) computes
  the domain automatically from the data, spanning every `heatValue`-defining column together — a
  single shared scale across the whole grid, not one scale per column
- `rowTotal?: (row: T) => unknown` (attribute: false) — renders a trailing `<td>`
  (`[part='row-total-cell']`) on every body row holding this row's total. Same "consumer
  computes/renders, table only positions" contract as the existing per-column `footer(rows)` — does
  not assume addition, so a non-sum aggregate works identically. Omit for no trailing column at all
  (unchanged output)
- `grandTotal?: (rows: T[]) => unknown` (attribute: false) — renders the bottom-right cell (row-total
  column × footer row). Only rendered when both `rowTotal` is set **and** at least one column defines
  `footer` — otherwise there is no footer row for it to occupy, and this renders nothing

**Events:** `lr-sort` (`detail: { key }`, fired on sortable-header activation), `lr-row-click`
(`detail: { row }`), `lr-load-more` (fired on the "load more" button), `lr-columns-hidden-change`
(`detail: { hidden: boolean }`, fired only on a real `columnsHidden` transition),
`lr-columns-revealed` (`detail: { revealed: boolean }`), and `lr-row-expand-toggle`
(`detail: { row, key }`; the table does not mutate `expandedKeys`), and
`lr-selection-change` (`detail: { keys }`) when selection is enabled, `lr-filter-change`
(`detail: { text }`), and `lr-page-change` (`detail: { page }`) from the controlled
filter/pagination surfaces, and `lr-cell-edit` (`detail: { row, key, value }`) for editable
columns, and `lr-column-resize` (`detail: { key, width }`) on every pointer or keyboard resize step.
The internal filter/cell-editor native inputs' `focus` and `blur` are also re-dispatched from the
host as bubbling, composed events (the native ones are neither).

**Slots:** `empty` — replaces the built-in empty state on the two *data*-empty branches (no rows at
all, and filtered/paginated down to zero). Left unfilled, the built-in `[part='empty']` `<lr-empty>`
renders as this slot's fallback content. The no-columns branch is deliberately **not**
slot-replaceable: it reports a configuration problem (`noColumnsHeading`), not "this query returned
nothing", and one slot covering all three would collapse that distinction. Everything else comes
from `columns`/`rows`.

**CSS parts:** `base`, `table`, `head`, `header-cell`, `row`, `cell`, `more-button`, `sort-icon` (a
chevron indicator shown on the active sortable header, rotated per `sortDir`), `reveal-columns-button`
(shown only when `columnsHidden` is true), `foot` (the `<tfoot>`, only rendered when at least one
column defines `footer`), `footer-row`, `footer-cell`, `row-total-cell` (each body row's trailing
`<td>` holding `rowTotal(row)`, rendered only when `rowTotal` is set — the corresponding footer-row
cell, holding `grandTotal`, is a `footer-cell` instead, matching every other footer cell),
`expand-toggle-cell`, `row-expand-toggle`,
`row-expand-icon`, `expanded-row`, `expanded-cell`, `filter-label`, `filter`, `loading` (under
`loadingAppearance="spinner"` the visible block holding the spinner; under `"skeleton"` the
visually-hidden `role="status"` node, since the placeholder rows are the visible affordance),
`skeleton` (each `<lr-skeleton>` placeholder inside a skeleton-mode body cell — the placeholder rows
and cells reuse the ordinary `row`/`cell`/`row-total-cell` parts, which is exactly what keeps them
geometrically identical to real rows, so `skeleton` is the part to target for the placeholder's own
look: `::part(skeleton) { --lr-skeleton-h: 2em; }`), and
`pagination`, `cell-editor`, `group-row`, `group-cell`, and `resize-handle` (the focusable column
separator). The built-in empty state is addressable rather than fixed: `empty` is the `<lr-empty>`
host in all three empty states, and it re-exports that element's own inner parts as `empty-base`,
`empty-icon`, `empty-heading`, `empty-description` and `empty-actions`. Note that the no-columns and
no-rows states return the empty element as the shadow root's own root, with no `[part='base']`
wrapper around it — `::part(base)` does not apply in those two states, only in the filtered-to-zero
one — and that `empty` disappears entirely once the `empty` slot is filled.

**Themeable custom properties:** `--lr-table-max-height` (default `none`; controls the scrollable
body's `max-block-size`). `--lr-table-heat-tint-lo` (default `var(--lr-color-brand-quiet)`) and
`--lr-table-heat-tint-hi` (default `var(--lr-color-brand)`) — the `color-mix()` ramp endpoints
for heat-tint mode's per-cell background, consulted only on columns/rows that define `heatValue`;
`--lr-table-resize-min-width` (default `var(--lr-size-3rem)`) and
`--lr-table-resize-handle-opacity` (default `0.12`) control resizable-column behavior.
`--lr-table-row-selected-bg` (default `var(--lr-color-brand-quiet)`) — the background of a row whose
`aria-selected` is `true`. Like every state-scoped custom property in this library it is an inline
`var()` fallback at its point of use and is **not** declared on `:host`, so it can be set on the
element *or on any ancestor* and still reach the rule that reads it. It exists because Shadow Parts
forbids an attribute selector after `::part()` — `::part(row)[aria-selected='true']` is invalid CSS —
so the only prior lever for restyling the selected row was overriding the library-wide
`--lr-color-brand-quiet` token, which repaints everything else reading it.
`--lr-table-sticky-offset` (default `0`) is measured and written inline per column by the component
so multiple `sticky` columns stack instead of overlapping; it is a read-out, not a knob you set.
`--lr-table-heat-t` is likewise component-written (each `[data-heat]` cell's position on the ramp).

**Optional peer deps:** none.

```html
<lr-table id="t" sort-key="name" sort-dir="asc"></lr-table>
<script type="module">
  const t = document.getElementById('t');
  t.columns = [
    { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
    { key: 'value', label: 'Value', align: 'end', cell: (r) => r.value },
  ];
  t.rows = [{ name: 'Alpha', value: 1 }, { name: 'Beta', value: 2 }];
  t.rowKey = (r) => r.name;
  t.addEventListener('lr-sort', (e) => console.log('sort by', e.detail.key));
  t.addEventListener('lr-row-click', (e) => console.log('clicked', e.detail.row));
</script>
```

**Known gotchas:**
- only single-row selection is modeled (`selectedKey: string | number | null`);
  there's no bulk-select/checkbox-column API — you must hand-roll a checkbox column entirely inside
  a `cell()` callback if you need multi-select.
- no `caption`/`aria-label` *property* exists, but a plain `aria-label` HTML attribute set on the
  host **is** forwarded into the shadow-DOM `<table role="grid">` (read via
  `this.getAttribute('aria-label')` at render time — a plain global-attribute read, not a reactive
  Lit `@property`): `<lr-table aria-label="Scores">` gives the grid an accessible name; omit it and
  the shadow table simply has none.
- Full roving-tabindex grid keyboard pattern (one `tabindex="0"` stop among header cells, one among
  body rows) — Left/Right/Home/End move within the header row, Up/Down/Home/End move within the
  body, Down from the header enters the body's roving stop and Up from the body's first row returns
  to the header, Enter/Space still only sort/activate — a genuine strength versus most siblings in
  this family. A `priority`-hidden header/cell is skipped when computing the visible header stops,
  so arrow-key navigation never strands the roving stop on a hidden column.
- a `cell()` template can render its own interactive content without it being swallowed by
  row/column activation: clicks and Enter/Space landing on (or bubbling through) anything matching
  `button, a[href], input, select, textarea, [role="button"], [role="combobox"], [role="listbox"],
  [role="slider"]`, **or any custom element** (any tag name containing a hyphen — e.g. a
  `<lr-select>`/`<lr-combobox>` rendered inside a `cell()`), are left alone by the table's own
  delegated `click`/`keydown` handlers instead of triggering `lr-sort`/`lr-row-click`.
- `layout="fixed"` (and any `'auto'` that resolves to fixed) carries two consequences of the CSS
  fixed algorithm. With no declared widths the **first** row — the header row included — determines
  every column's width, so revealing a `priority`-hidden column via
  `[part='reveal-columns-button']` re-measures and changes *all* of them, not just the revealed one.
  And `columns[].minWidth`/`maxWidth` are silently ignored by `table-layout: fixed`; declare `width`
  instead when a specific column needs a specific size.
- skeleton mode keeps geometry stable only when the browser isn't sizing columns from cell content.
  Under the default `table-layout: auto`, placeholder cells have no intrinsic width, so the columns
  re-measure when real content arrives — exactly as they do between any two different data sets. For
  pixel-identical widths across the load, declare `columns[].width` or set `layout="fixed"`. Either
  loading appearance keeps exactly one `role="status"` live region announcing the state: every
  placeholder opts out of `<lr-skeleton>`'s own announcement, so a skeleton table never announces
  once per placeholder row.
- `columns[].cellTitle` returning an empty string **or** `undefined` omits the `title` attribute
  entirely rather than rendering `title=""` — an empty `title` would suppress an ancestor element's
  own tooltip. The attribute is also suppressed while that cell is in inline-edit mode, so the
  tooltip can't shadow the editor. Accessibility caveat: some screen readers announce a `<td title>`
  as the cell's accessible *name*, replacing the cell's content rather than supplementing it (the
  same caveat `lr-stat`'s `exactValue` carries). Use it for a longer form of what the cell already
  shows, never for information that exists nowhere else.

---

## `lr-pagination`

Controlled page navigation for server-side or client-side data sets: previous/next buttons, a
validated numeric page jump, a localized item-range summary, and a polite announcement after the
host applies a requested page. The component owns no data fetching and never mutates `page`.

**Properties and getters:**
- `page: number = 1` (reflected) — the currently applied page. Runtime values are presented within
  the valid `1..pageCount` range, but the public property itself remains controlled and is not
  rewritten by the component
- `pageSize: number = 20` (attribute `page-size`) — items per page; finite values are truncated to
  a non-negative integer for the derived calculations, and zero produces no pages
- `totalItems: number = 0` (attribute `total-items`) — total item count; finite values are truncated
  to a non-negative integer for display and page-count calculations
- `pageCount: number` (readonly getter) — `ceil(totalItems / pageSize)` after the normalization
  above, or `0` when either normalized input is zero
- `disabled: boolean = false` (reflected)
- `loading: boolean = false` (reflected) — disables all controls and sets `aria-busy="true"` on the
  internal navigation landmark
- `hideSummary: boolean = false` (attribute `hide-summary`, reflected) — omits the built-in range
  summary while retaining the controls
- `size: 'xs'|'s'|'m'|'l'|'xl' = 'm'` (reflected) — changes control height and type size
- `itemLabel: string = ''` (attribute `item-label`) — custom item noun used in the summary; empty
  selects the localized singular `item` or plural `items` key
- `accessibleLabel: string | null = null` (attribute `aria-label`) — host accessible-name override
  forwarded to the internal `<nav>` landmark; takes precedence over `label`
- `label: string = 'Pagination'` — fallback accessible name for the internal `<nav>` landmark
- `pageLabel: string = 'Page'` (attribute `page-label`) — accessible name for the page-jump input
- `previousLabel: string = 'Previous'` (attribute `previous-label`), `nextLabel: string = 'Next'`
  (attribute `next-label`) — accessible names for the icon-only directional buttons

Built-in property defaults resolve through the locale registry. A property value customized away
from its built-in default is treated as an explicit per-instance wording override.

**Events:** `lr-page-change` (`detail: { page: number }`, bubbles and composes, non-cancelable) —
emitted for a valid, different requested page. The host applies `event.detail.page` back to `page`
after routing, fetching, or any other policy decision.
The internal page input's `focus` and `blur` are also bridged as bubbling, composed host events.

**Methods:** `focus(options?)` and `blur()` forward to the numeric page input.

**Slots:** none.

**CSS parts:** `base`, `summary`, `controls`, `previous-button`, `previous-icon`, `page-field`,
`page-input`, `page-count`, `next-button`, `next-icon`, `live-region`.

**Themeable custom properties:** `--lr-pagination-control-size` and
`--lr-pagination-font-size` (both default from `size`), `--lr-pagination-control-padding` (default
`var(--lr-space-xs)`) — inner padding of the previous/next buttons and the page input, deliberately
uniform across every `size` tier because the control's outer footprint is already fixed by
`--lr-pagination-control-size`, so this only adjusts the icon/digit inset — plus shared color,
spacing, border, radius, disabled-opacity, and focus-ring tokens.

**Optional peer deps:** none.

```html
<lr-pagination total-items="237" page-size="20"></lr-pagination>
<script>
  const pagination = document.querySelector('lr-pagination');
  pagination.addEventListener('lr-page-change', async (event) => {
    await loadPage(event.detail.page);
    pagination.page = event.detail.page;
  });
</script>
```

**Known gotchas:**
- user activation only emits an intent. Until the host applies a new `page`, the numeric input
  returns to the currently controlled value; assigning the page triggers the localized
  `role="status"` announcement
- the jump input accepts only whole pages in `1..pageCount`; empty, fractional, and out-of-range
  drafts expose `aria-invalid="true"` and emit nothing
- zero items, zero page size, `disabled`, and `loading` all disable the navigation controls. The
  empty summary is still rendered via the localized `paginationEmptySummary` message
  (`'{total} {itemLabel}'`, producing `0 items` in the default locale) unless `hide-summary` is set
- below a 20rem container allocation the summary and controls stack; the breakpoint responds to
  the component's own inline size, not the viewport. Previous/next icons also mirror under RTL

---

## `lr-gauge`

Dependency-free SVG radial, full-circle ring, or linear meter (no charting library).

**Properties:**
- `value: number = 0`
- `min: number = 0`
- `max: number = 100`
- `type: 'radial'|'ring'|'linear' = 'radial'` (reflected — `radial` is a 270° sweep; `ring` is a
  full circle that begins at 12 o'clock)
- `label: string = ''`
- `valueLabel?: string` (attribute: false — overrides both the visible text and the host's
  `aria-valuetext`; an empty string is treated the same as unset and falls back to the numeric
  `value` while removing `aria-valuetext`)

**Events:** none.

**Slots:** none.

**CSS parts:** `base` (the `<svg>`), `track`, `fill`, `value`, `label`

**Themeable custom properties:** `--lr-gauge-fill` (fill stroke, falling back to the shared
`--lr-color-brand` token).

**Optional peer deps:** none.

```html
<lr-gauge value="72" min="0" max="100" label="CPU"></lr-gauge>
<lr-gauge type="ring" value="84" label="Coverage"
  style="--lr-gauge-fill: var(--lr-color-success)"></lr-gauge>
<lr-gauge type="linear" value="0.4" max="1"></lr-gauge>
<script type="module">
  document.querySelector('lr-gauge').valueLabel = '72°F'; // visible text and announced value
</script>
```

**Known gotchas:**
- setting `valueLabel` (e.g. `"72°F"`) now also sets `aria-valuetext` on the host (in addition to
  changing the visible SVG text), so a screen reader announces your formatted string instead of the
  raw `aria-valuenow` number; the SVG `<text part="value">`/`<text part="label">` elements are
  `aria-hidden="true"` so they're no longer separately exposed inside the same `role="meter"` host.
- no automatic color-threshold/variant logic is built in. Set `--lr-gauge-fill` per instance (or
  reactively from application state) when the value should select a success/warning/danger color.
- no documented component-specific sizing custom property; host size is fixed em values
  (`8em`/`12em` radial, `12em`/`1.5em` linear) — resize via plain CSS `width`/`height` on the
  element instead.
- Divide-by-zero guarded (`max - min || 1`), and radial/linear share one component via the `type`
  attribute.
- non-finite `value` text remains blank, while non-finite `min`/`max` use finite default domain
  bounds; no `NaN`/`Infinity` value leaks into the SVG geometry or ARIA attributes, and a finite
  value is clamped into the resolved domain before being announced.

---

## `lr-word-cloud`

Dependency-free SVG word/tag cloud. First-party invention (no Web Awesome equivalent). Lays words
out via an outward Archimedean-spiral search — heaviest word placed first, each word spiraling from
the center until it clears every word already placed. Unlike sibling `lr-sparkline`/`lr-heatmap`
(one `role="img"` glyph standing in for an aggregate value), the individual words here *are* the
meaningful interactive content — but with up to `MAX_WORDS` (150) of them, making every single one
its own tab stop would be a poor keyboard experience. Instead, like `lr-heatmap`'s cells, the whole
`[part="svg"]` is **one tab stop with roving arrow-key focus**: `ArrowRight`/`ArrowDown` move the
focus cursor to the next word in **declaration order** (not weight/placement order),
`ArrowLeft`/`ArrowUp` to the previous, `Home`/`End` to the first/last, and `Enter`/`Space` fires
`lr-word-click` for the currently-focused word. A `[part="focus-ring"]` `<rect>` is drawn around
the focused word (absent until a word has actually been focused via keyboard or click), and a
visually-hidden `[part="live-region"]` (`role="status" aria-live="polite"`) announces
`"${text}, ${weight}"` on every focus move.

**Properties:**
- `words: WordCloudWord[] = []` (attribute: false) — `{ text: string, weight: number, color?:
  string, group?: string }`; `weight` drives font size (a negative/non-finite `weight` is clamped to
  `0` for sizing purposes only — the original value is still echoed verbatim in `lr-word-click`'s
  `detail`), `color` overrides the palette for that word, `group` shares one palette color across
  every word with the same `group` value
- `minFontSize: number = 12` (attribute `min-font-size`) — px, applied to the lowest-weight word;
  layout clamps positive finite values to at most 512px and uses 1px for invalid/non-positive values
- `maxFontSize: number = 48` (attribute `max-font-size`) — px, applied to the highest-weight word;
  normalized by the same 1–512px layout bound (reversed min/max bounds are swapped)
- `scale: 'linear'|'sqrt' = 'linear'` — `sqrt` compresses the weight→font-size mapping so one heavy
  word doesn't dwarf the rest, matching `lr-heatmap`'s `scale` property
- `orientations: 'horizontal'|'mixed' = 'horizontal'` — `mixed` lets ~25% of words render rotated
  90° for denser packing
- `palette?: string[]` (attribute: false) — custom categorical colors, cycled by word index (or by
  `group`); defaults to the `--lr-word-cloud-color-1..8` tokens

**Methods:** `refreshTheme(): void` — forces a relayout so the `--lr-font` custom property is
re-read from computed style (font-family affects the canvas text measurement layout depends on);
call this from your own theme-toggle handler, since there's no global theme-change event to
subscribe to automatically (mirrors `lr-chart`'s `refreshTheme()`).

**Events:** `lr-word-click` (`detail: { text, weight, group }`, fires on click, or Enter/Space on
the currently-focused word — a no-op if nothing is focused yet)

**Slots:** none.

**CSS parts:** `base`, `svg`, `word` (each `<text>`), `focus-ring` (the rect around the roving-focus
cursor's word), `live-region` (visually-hidden `role="status" aria-live="polite"` announcement text),
`empty` (the no-data placeholder — hardcoded `"No data"` text, no property to customize it, unlike
`lr-empty`/`lr-table`)

**Themeable custom properties:** `--lr-word-cloud-color-1`, `--lr-word-cloud-color-2`,
`--lr-word-cloud-color-3`, `--lr-word-cloud-color-4`, `--lr-word-cloud-color-5`,
`--lr-word-cloud-color-6`, `--lr-word-cloud-color-7`, `--lr-word-cloud-color-8` (the default
categorical palette, cycled by word index or `group`; a data-driven literal exception like
`lr-heatmap`'s scale-ramp endpoints — exposed as retheme-able custom properties instead of
hardcoded), plus shared tokens (`--lr-font`,
`--lr-focus-ring-*`, `--lr-transition-fast`, `--lr-color-text-quiet`).

**Optional peer deps:** none.

```html
<lr-word-cloud id="cloud" style="height: 20rem"></lr-word-cloud>
<script type="module">
  document.getElementById('cloud').words = [
    { text: 'JavaScript', weight: 90 },
    { text: 'TypeScript', weight: 75 },
    { text: 'Lit', weight: 60, group: 'framework' },
  ];
  document.getElementById('cloud').addEventListener('lr-word-click', (e) => console.log(e.detail));
</script>
```

The host itself gets `role="group"` and an auto-computed `aria-label` (e.g. `"Word cloud of 12
words"` / `"Word cloud of 1 word"`, counting only words actually rendered — post `MAX_WORDS`-cap and
post-drop, not the raw `words.length`) **unless** the host already carried its own `role`/`aria-label`
attribute at first render. That opt-out check runs exactly once (the very first update) and is never
re-checked afterwards, so setting `role`/`aria-label` yourself *after* the component has already
rendered at least once only sticks until the next `words`-driven relayout, which overwrites it back
to the auto default — set it in the initial markup (or before first paint) to opt out permanently.

**Known gotchas:**
- capped at 150 words (`MAX_WORDS` in `word-cloud-layout.ts`, mirroring `lr-sparkline`'s
  `MAX_BARS` DOM-node-count guard) — over the cap, the **heaviest** 150 survive and the rest are
  dropped, regardless of where they fell in the input array (it is not simply "first 150 in, rest
  dropped"). A pathological input (e.g. one huge word repeated many times) can also exhaust the
  spiral search's radius bound and get dropped the same way; blank/whitespace-only `text` is dropped
  too. Every drop reason logs one deduplicated `console.warn` per distinct skipped-count (not one
  warning per word, and not repeated twice for the same count) — nothing throws.
- each word's spiral search tests at most 4,096 candidate positions. Together with the 150-word and
  512px font-size caps, this bounds placement work even for dense or adversarial layouts; a word
  that exhausts the search budget is reported through the same skipped-word path.
- text width is measured via a detached `<canvas>` 2D context (`ctx.measureText`) at a hardcoded
  `font-weight: 600` matching `[part='word']`'s own default CSS — close enough for
  collision-avoidance spacing, but not pixel-exact, and overriding `[part='word']`'s `font-weight` via
  `::part()` desyncs measurement from what's actually painted (looser/denser packing, not a crash).
- rotation (`orientations="mixed"`) is genuinely random per layout (`Math.random()`, not seeded), so
  which words render rotated changes on every re-layout (any `words`/`minFontSize`/`maxFontSize`/
  `scale`/`orientations` change) — don't rely on rotation being stable across renders.
- only one word is ever in the page's tab sequence at a time (the roving cursor on `[part="svg"]`) —
  there's no way to Tab directly to the Nth word; arrow-key/Home/End your way there, or click it.

---

## `lr-heatmap`

A Canvas-rendered heatmap with a DPR-aware, resize-aware redraw loop, in one of two `mode`s:
`"matrix"` (default — a `rowLabels` × `colLabels` grid of `values`) or `"calendar"` (a
GitHub-style Sunday–Saturday × week grid built from `days`, colored by quartile bucket rather than
the matrix mode's continuous ramp). Every cell is independently addressable despite being
canvas-drawn (no per-cell DOM node by default): a `pointermove` hit-test over the canvas shows `[part="tooltip"]`
with that cell's label + value; the canvas is `tabindex="0"` with arrow-key roving focus (a stroked
ring redrawn over the focused cell on every draw, plus `[part="live-region"]` announcing it); and a
  click, or Enter/Space on the focused cell, fires `lr-cell-click`.

Set `accessibleCells: true` (`accessible-cells`) to opt into a native-button overlay for each
interactive matrix/calendar cell. The overlay uses localized `aria-label`s, explicit
`aria-pressed="true"|"false"` from the controlled `selectedCell`, and roving tabindex/arrow-key
focus; it continues to emit `lr-cell-click` and leaves selection state consumer-controlled.

**Properties:**
- `rowLabels: string[] = []` (attribute: false — matrix mode only)
- `colLabels: string[] = []` (attribute: false — matrix mode only)
- `values: number[][] = []` (attribute: false — matrix mode only) — `-1` or any non-finite value is
  the "no data" sentinel; ragged/sparse rows are safe (`?? -1`)
- `cellSize: number = 22` (attribute `cell-size` — default `22` in matrix mode, `11` in calendar
  mode when left unset; explicitly setting it now governs both modes' per-cell size alike, and it's
  ignored in either mode when `fitToWidth` is set)
- `fitToWidth: boolean = false` (attribute `fit-to-width` — derives `cellSize` from the host's
  measured `clientWidth` on every draw/resize instead of the fixed `cell-size`, so the grid actually
  fills the available width; now applies to calendar mode as well as matrix mode — see gotchas for
  the default, non-`fit-to-width` behavior)
- `maxCellSize?: number` (attribute `max-cell-size`) — ceiling, in CSS px, on the cell size
  `fitToWidth` derives from the host width, in **both** modes. Exists because `fitToWidth` divides
  the *whole* host width across the grid, so a 5-week calendar or a 3-column matrix in a wide pane
  produces enormous blocks; capping them keeps a cell a cell
- `minCellSize?: number` (attribute `min-cell-size`) — the mirror floor, in CSS px, so a year-long
  calendar in a narrow pane keeps legible, hit-testable cells and overflows its host instead of
  collapsing to hairlines. It can only *raise* the built-in `4`px floor, never lower it: a value
  below `4` normalizes to `4`. When both clamps are set and `maxCellSize < minCellSize`, the ceiling
  wins. For both: a non-finite value, or an empty attribute, means unset rather than `0`, and unset
  (the default) reproduces the unclamped fit-to-width behavior exactly
- `valueLabel: string = 'value'` (attribute `value-label`)
- `scale: 'linear' | 'sqrt' = 'linear'` — governs both modes: in matrix mode, `'sqrt'` compresses the
  color ramp via `sqrtStep()` instead of mapping linearly; in calendar mode, the default `'linear'`
  still buckets by quartile (`quartileBucket()`, unchanged), while `'sqrt'` instead compresses via the
  same `sqrtStep()` magnitude compression as matrix mode, so one heavy day doesn't wash out the rest
- `mode: 'matrix' | 'calendar' = 'matrix'`
- `days: CalendarDay[] = []` (attribute: false — calendar mode only) — `CalendarDay { date:
  string /* ISO yyyy-mm-dd */; value: number }`; need not be sorted or contiguous, and an entry whose
  `date` doesn't parse is dropped rather than poisoning the whole grid
- `firstDayOfWeek: number = 0` (attribute `first-day-of-week` — calendar mode only, no-op in matrix
  mode) — anchors the calendar grid at a different weekday instead of always Sunday; `0`-`6`, same
  numbering as `CalendarCellPos.weekday` (`0` Sunday .. `6` Saturday)
- `bucketCount: number = 5` (attribute `bucket-count` — calendar mode only; non-finite values fall
  back to 5, while finite values are floored and clamped to 2–256 before the color-ramp allocation)
- `annotations: HeatmapAnnotation[] = []` (attribute: false) — `HeatmapAnnotation { row?: number;
  col?: number; date?: string; label?: string }`: matrix mode matches by `row`/`col`, calendar mode
  by `date` (whichever pair matches the active `mode`; the other fields are ignored). Draws a
  stroked ring over the matching cell; an annotation with a `label` also gets its own
  `[part="legend-annotation"]` entry in the legend.
- `selectedCell: HeatmapSelectedCell | null = null` (attribute: false) — `HeatmapSelectedCell {
  row?: number; col?: number; date?: string }`, matched the same way as `annotations`. Draws a
  persistent ring (independent of keyboard focus) over the matching cell, appends a "Selected: ..."
  description to the host's own `aria-label`, and appends a "(selected)" suffix to the live-region
  announcement when the focused cell is the selection. Purely a controlled property — mirrors
  `<lr-lite-chart>`'s `selectedIndex`, this component never mutates it itself. Unset (the default,
  `null`) reproduces today's exact output.
- `accessibleCells: boolean = false` (attribute `accessible-cells`) — renders `[part="cells"]` with
  one `[part="cell"]` native button per interactive cell. Buttons expose localized `aria-label`s,
  explicit `aria-pressed` state from `selectedCell`, and a roving tabindex; the canvas becomes
  `aria-hidden` while this mode is enabled. The property is opt-in so the default canvas mode keeps
  its low DOM footprint.
- `cellText?: (pos: MatrixCellPos | CalendarCellPos, value: number) => string` (attribute: false) —
  formats the per-cell hover tooltip and keyboard live-region announcement text; receives the cell
  position (`MatrixCellPos { row, col }` in matrix mode, `CalendarCellPos { week, weekday, date }` in
  calendar mode) and its value. `CalendarCellPos.date` is a **required** ISO `yyyy-mm-dd` string,
  present for every grid position — including a sparse gap position with no matching entry in `days`
  at all, which still sits on a real calendar day (that case simply reports the `-1` "no data" value
  alongside it). It lets a callback key off the date without re-deriving the grid's own
  anchor-week arithmetic; `MatrixCellPos` is unchanged, and so is `lr-cell-click`'s detail.
  Unset (the default) falls back to the built-in English "Row X, Col Y: value" (matrix) / "Jan 15:
  value" — short month + day, **not** a weekday abbreviation (calendar) — template. Additive, not
  breaking.
- `cellInteractive?: (pos: MatrixCellPos | CalendarCellPos, value: number) => boolean` (attribute:
  false) — opts individual cells out of the interaction model; receives the cell position and its
  value, return `false` to make that cell present-but-non-interactive (no hover tooltip, click, or
  keyboard roving-focus stop) without losing the layout/color-ramp machinery. Unset (the default)
  keeps every cell interactive, unchanged.
- `columnX?: (index: number) => number` (attribute: false, calendar mode only) — overrides the
  internal week-column x-coordinate formula (`CAL_PAD_LEFT + week * (CAL_CELL + CAL_GAP)`) used
  consistently across drawing, hit-testing, the focus ring, and month-label positioning, so a
  consumer can pixel-align this calendar's week columns with a sibling `<lr-lite-chart>`'s bars
  (see that component's own `barX`) by supplying the same coordinate function to both. Unset (the
  default) is the original formula, unchanged.
- `rowY?: (weekday: number) => number` (attribute: false, calendar mode only) — the vertical
  analogue of `columnX`: overrides the internal weekday-row y-coordinate formula (`CAL_LABEL_H +
  weekday * (cellSize + CAL_GAP)`), consulted consistently by drawing, hit-testing, and the focus
  ring (also consulted at `weekday = 7` to size the canvas height, mirroring `columnX` at
  `week = weekCount`). Unset (the default) is the original formula, unchanged. Ignored in matrix
  mode.
- `cellColor?: (pos: MatrixCellPos | CalendarCellPos, value: number) => string | undefined`
  (attribute: false) — overrides a cell's computed ramp/no-data color entirely for an exact value;
  return a CSS color string to force that cell to it, or `undefined` to fall back to the normal ramp
  math unchanged. Lets a consumer designate a value as categorically outside the ramp (e.g. a real
  zero-count day rendered as a neutral hairline, distinct from both "no data" and the ramp's own
  lightest step) without a synthetic ramp color, which can't safely reserve an exact value on a
  skewed dataset. Unset (the default) reproduces the exact ramp/no-data behavior for every cell.
- `weekdayLabelText?: (jsWeekday: number) => string | undefined` (attribute: false, calendar mode
  only) — overrides the weekday-axis label text; receives the real JS weekday index (`0` Sunday ..
  `6` Saturday) for a row that would otherwise render a label and, when it returns a string, uses it
  instead of the built-in `Intl.DateTimeFormat`-derived short weekday name. Unset (the default)
  reproduces today's exact locale-derived output.
- `monthLabelText?: (jsMonth: number, year: number) => string | undefined` (attribute: false,
  calendar mode only) — the month-axis analogue of `weekdayLabelText`: receives the real JS month
  index (`0` January .. `11` December) and full year for a month boundary that would otherwise
  render a label, and, when it returns a string, uses it instead of the built-in
  `Intl.DateTimeFormat`-derived short month name. Unset (the default) reproduces today's exact
  locale-derived output. Lets month labels track the same locale signal (e.g. an app's own i18n
  store) as `weekdayLabelText` and the component's other localizable strings, instead of always
  following the browser/OS-language default.
- `colorSteps?: string[]` (attribute: false) — a discrete array (≥2 entries) of CSS colors used as
  exact ramp steps instead of linearly interpolating between `--lr-heatmap-scale-lo`/`-hi`;
  governs both `mode`s and both `scale` values, discretizing whichever scale would otherwise
  interpolate continuously into `colorSteps.length` buckets instead. Unset (the default, or fewer
  than 2 entries) keeps today's 2-endpoint interpolation exactly.
- `legendStops?: HeatmapLegendStop[]` (attribute: false) — `HeatmapLegendStop { value: number;
  color?: string; label?: string }`: a discrete legend key rendered **instead of** the
  `--lr-heatmap-scale-lo`/`-hi` gradient bar and its `[part="legend-lo"]`/`[part="legend-hi"]`
  endpoint labels — one `[part="legend-stop"]` per entry, in array order, each a
  `[part="legend-swatch"]` filled with that entry's `color` plus a `[part="legend-stop-label"]`.
  `color` is optional: omit it (or pass an empty string) for a **caption-only** stop, which renders
  its `[part="legend-stop-label"]` alone with no `[part="legend-swatch"]` element in the DOM at all —
  so a leading "0" or trailing "more" caption around a run of colored stops doesn't leave an empty
  swatch box in the row.
  A stop's label defaults to the component's own locale-aware numeric formatting of `value`, so an
  explicit `label` is only needed when the number isn't the right caption ("none", "≥ 90%"). Exists
  for the consumer who supplies `cellColor`: because that callback overrides a cell's color
  entirely, the built-in two-endpoint bar can end up describing a ramp the grid no longer uses —
  supplying the same colors here keeps the legend honest instead of hiding `::part(legend)` and
  re-implementing swatches, labels and annotation entries by hand. Strictly presentation: the stops
  are never consulted by the color ramp, the bucket math, the tooltip, or the generated accessible
  name, so adding them changes nothing a cell renders. Labeled `annotations` still render their
  `[part="legend-annotation"]` entries after the stops. Unset (the default) or an empty array
  reproduces the exact gradient legend, unchanged.

**Getters/methods:** `refreshTheme()` — redraws canvas content after an upstream design-token or
color-scheme change; called automatically on theme changes, exposed for a consumer that needs to
force a redraw manually.

**Events:** `lr-cell-click` (fired on click, or Enter/Space on the keyboard-focused cell —
`detail: { row, col, value }` in matrix mode, `detail: { date, value }` in calendar mode)

**Slots:** none.

**CSS parts:** `base`, `canvas`, `cells` (opt-in per-cell overlay), `cell` (one opt-in native cell
button), `tooltip` (hover tooltip, positioned over the hovered cell),
`live-region` (visually-hidden `role="status" aria-live="polite"` element announcing the
keyboard-focused cell), `legend`, `legend-lo`, `legend-hi` (both omitted, along with the gradient
bar between them, while `legendStops` is supplied), `legend-stop` (one per `legendStops` entry),
`legend-swatch` (that stop's color chip, not rendered at all for a caption-only stop),
`legend-stop-label` (that stop's text), `legend-value-label` (the trailing `valueLabel` caption that
closes the legend row, present in both the gradient and the `legendStops` branch),
`legend-annotation` (one per labeled `annotations` entry)

**Themeable custom properties:** `--lr-heatmap-scale-lo` (default `#cde2fb`),
`--lr-heatmap-scale-hi` (default `#0969da`) — the sequential color-ramp endpoints (matrix mode) or
quartile-bucket ramp endpoints (calendar mode), resolved via `getComputedStyle` each draw (any valid
CSS color syntax — hex/rgb/hsl/oklch/named — works, resolved through a scratch canvas).
`--lr-heatmap-no-data-fill` (default `rgba(128,128,128,0.25)` — the no-data cell fill, same
resolve-via-`getComputedStyle` pattern), `--lr-heatmap-label-font` (default `10px sans-serif` — the
canvas-drawn axis/month/weekday label font), `--lr-heatmap-focus-ring-color` (default
`var(--lr-focus-ring-color)` — the canvas-drawn ring stroked around the keyboard-focused cell;
also reused by `[part="canvas"]`'s own `:focus-visible` outline so the two stay visually in sync),
`--lr-heatmap-color-steps-gradient` (default
`linear-gradient(to right, var(--lr-heatmap-scale-lo), var(--lr-heatmap-scale-hi))` — the gradient
painted on the continuous legend bar; the component writes it onto the host itself while
`colorSteps` is supplied and removes it again when it isn't, so it is a read-out rather than a knob
you set). `--lr-heatmap-annotation-color` (default `var(--lr-color-danger)` — the canvas-drawn ring
stroked around an annotated cell, deliberately not one of the sequential ramp colors so it stays
visible regardless of what it's drawn over). `--lr-heatmap-selected-color` (default
`var(--lr-color-success)` — the canvas-drawn ring stroked around the persistent `selectedCell`, a
dedicated token distinct from both the focus ring and the annotation ring so a host can retheme it
independently). `--lr-heatmap-tooltip-bg` (default
`var(--lr-color-surface)`) and `--lr-heatmap-tooltip-text` (default `var(--lr-color-text)`) —
unlike the canvas-drawn tokens above, `[part="tooltip"]` is a real DOM element and consumes these
directly, no `getComputedStyle` bridging needed. Also consumes `--lr-color-text-quiet` (axis label
color), `--lr-space-xs`, `--lr-radius`/`--lr-shadow` (tooltip box), and `--lr-focus-ring-width`/
`--lr-focus-ring-offset` (the real `[part="canvas"]:focus-visible` DOM outline, stroked in the
same color as `--lr-heatmap-focus-ring-color`).

**Optional peer deps:** none.

```html
<lr-heatmap value-label="requests"></lr-heatmap>
<script>
  const hm = document.querySelector('lr-heatmap');
  hm.rowLabels = ['Mon', 'Tue', 'Wed'];
  hm.colLabels = ['00h', '06h', '12h', '18h'];
  hm.values = [[3, 8, 12, 4], [1, 2, 9, 5], [0, 4, 6, 2]];
</script>
```

```html
<!-- Calendar mode: a GitHub-contributions-style day grid -->
<lr-heatmap mode="calendar" value-label="commits"></lr-heatmap>
<script>
  document.querySelector('lr-heatmap').days = [
    { date: '2026-01-01', value: 3 },
    { date: '2026-01-02', value: 0 },
    // ...
  ];
</script>
```

**Known gotchas:**
- `legendStops` *replaces* the lo/hi gradient bar rather than adding to it: supplying it removes
  `[part="legend-lo"]`, `[part="legend-hi"]` and the bar from the DOM, so a stylesheet targeting
  those parts silently stops applying. It is also presentation-only — it never feeds back into the
  cell colors, so the stops and a `cellColor` callback have to be kept in agreement by the consumer
  (the point of the property is that they *can* be, from one shared function).
- the `ResizeObserver` only actually resizes the drawn grid **when `fit-to-width` is set**, in either
  mode. Without it (the default), `draw()` sizes the canvas as `PAD_LEFT + cols * cellSize` (matrix
  mode) or `CAL_PAD_LEFT + weekCount * cellSize` (calendar mode), never from the host's measured
  width, so a container-resize redraw is a geometric no-op; the stylesheet's
  `canvas { inline-size: 100% }` is also dead code in that case, since `draw()` unconditionally sets
  an inline `canvas.style.width/height` that wins over it.
- `maxCellSize`/`minCellSize` are no-ops without `fit-to-width` — an explicit `cellSize` is an exact
  request and is never clamped. And the canvas is sized *from the clamped* cell size, so a capped
  grid deliberately leaves the host's remaining width unfilled: the canvas simply ends early rather
  than stretching to fill. Position it with ordinary CSS on the host if you want it centered or
  end-aligned.
- the host is `role="group"` (not `role="img"`) with a dimensions+range summary `aria-label`
  (calendar mode: a day-count + range summary instead) — `[part="canvas"]` inside it is a real
  focusable, keyboard-operable, per-cell-interactive control (roving arrow-key focus,
  `[part="live-region"]` announcements, `lr-cell-click`), and `role="img"` is documented (ARIA) to
  flatten its subtree to a single image for some assistive tech, which conflicted with that
  focusable descendant — fixed, matching `lr-lite-chart`/`lr-word-cloud`'s existing `role="group"`
  pattern.
- `NaN`/non-finite cell values in matrix mode are correctly treated as no-data now (alongside `-1`),
  and repeated DPR crossings (moving the window across displays with different pixel ratios) no
  longer leak a `MediaQueryList` listener per crossing — both previously-known issues are fixed.
- calendar mode's date labels (used by the default `cellText` template and the tooltip/live-region
  text) now format via the runtime locale (`toLocaleString(undefined, ...)`) instead of a hardcoded
  `'en'` — fixed. The canvas-drawn axis chrome is now locale-aware too: month labels use
  `toLocaleString(undefined, ...)` (previously hardcoded `'en'`) and weekday labels are derived via
  `Intl.DateTimeFormat(undefined, { weekday: 'short' })` (previously a literal English `['', 'Mon',
  '', 'Wed', '', 'Fri', '']` array) — same sparse every-other-day spacing, just locale-correct text.

---

## `lr-sequence-strip`

A compact, one-thin-cell-per-item strip visualizing a sequence of categorical states, with an
optional secondary per-cell marker. Pure CSS/flex — no chart.js, no SVG, no canvas — sized/named
consistently with the sparkline/heatmap family, but a glanceable *aggregate* visualization
(`role="img"`, one summarizing `aria-label`) rather than a `role="list"` of separately-operable
items: there is no per-cell keyboard focus and no per-cell click event, matching `<lr-sparkline>`'s
accessibility model rather than `<lr-heatmap>`'s heavier canvas-plus-keyboard-roving one. Hovering a
cell (pointer only) shows `[part="tooltip"]` with that item's label. Setting `showLegend`
additionally renders a static `[part="legend"]` key below the strip, so the color-to-category
mapping is readable without hovering each cell.

**Properties:**
- `items: SequenceStripItem[] = []` (attribute: false) — `{ id, category, marker?, label? }`;
  `marker` renders a small bottom marker on that cell independent of the category color (e.g. a
  subagent-dispatched turn); `label` is per-item hover-tooltip text, falling back to the matching
  category's own `label` (or its `key`) when unset — not read by the auto-generated `aria-label`,
  which summarizes by category/count only
- `categories: SequenceStripCategory[] = []` (attribute: false) — `{ key, color, label? }`; `color`
  is the cell background for every item whose `category` matches `key` (an item whose `category`
  matches no entry renders `transparent`); `label` is used in the auto-generated `aria-label` summary
  and as the hover-tooltip fallback text, falling back to `key` itself when unset
- `orientation: 'horizontal' = 'horizontal'` (reflected) — only `'horizontal'` is supported today;
  vertical is plausible future scope, not built speculatively without a motivating case
- `accessibleLabel?: string` (attribute `accessible-label`) — overrides the auto-generated
  `aria-label` (a per-category "label: count" summary, e.g. `"Text: 2, Tool: 1"`). Unset computes the
  summary from `items`/`categories`
- `showLegend: boolean = false` (attribute `show-legend`, reflected) — renders a static
  `[part="legend"]` key below the strip, one swatch + label row per `categories` entry, in array
  order. The key describes the *scheme*, not the current data: a category with no matching item
  still gets a row, and an item whose `category` matches no entry adds none. Deliberately
  non-interactive — it toggles nothing and emits nothing (`lr-graph-legend` is the interactive,
  filtering legend). Because it only repeats the category names `[part="base"]` already announces
  through its `role="img"` summary, the legend is `aria-hidden` — visible on screen, announced
  exactly once — and it wraps onto further rows in a narrow allocation rather than overflowing
- `markerLabel?: string` (attribute `marker-label`) — names what an item's `marker` *means* (e.g.
  `"Subagent"`). Setting it does two things: with `showLegend` on it adds one trailing
  `[part="legend-item"]`, whose `[part="legend-marker-swatch"]` reproduces the cell's own marker
  treatment, and it adds the marker to the auto-generated `aria-label` summary, which is otherwise
  per-category only. The marker count is reported as its own clause rather than folded into any
  category's count. Unset (the default) changes nothing: no extra legend row, no extra summary clause

**Events:** none.

**Slots:** none.

**CSS parts:** `base` (the root strip, `role="img"`), `cell` (each item's cell, background-colored
by its category), `marker` (the small bottom marker on a cell whose item sets `marker: true`),
`tooltip` (the hover tooltip showing the hovered item's label, hidden until a cell is hovered),
`legend` (the static category key rendered below the strip when `showLegend` is set — `aria-hidden`,
as it repeats the strip's own `aria-label`), `legend-item` (one swatch + label pair, one per
`categories` entry, plus one trailing marker row when `markerLabel` is set), `legend-swatch` (the
color chip, matching that category's cell color), `legend-marker-swatch` (the marker row's chip
instead: a neutral chip carrying the same bottom bar a `marker: true` cell paints, in the same
`--lr-sequence-strip-marker-color`), `legend-label` (the category's `label`, or its `key` when
unset).

**Themeable custom properties:** `--lr-sequence-strip-height` (default `1.5rem` — the strip's
block-size), `--lr-sequence-strip-marker-color` (default `var(--lr-color-text)` — the
`[part="marker"]` fill, and of the marker legend row's bar), `--lr-sequence-strip-legend-swatch-size`
(default `0.625rem` — a legend swatch's inline- and block-size, category and marker rows alike), and
`--lr-sequence-strip-legend-marker-bg` (default `var(--lr-color-surface-raised)` — the neutral chip
background behind the marker legend row's bar; it stands in for "any cell", so it deliberately
matches no category color); the tooltip also consumes shared tokens
`--lr-color-surface`, `--lr-color-text`, `--lr-font-size-xs`, `--lr-radius`, and `--lr-shadow`, and
the legend consumes `--lr-space-2xs`, `--lr-space-xs`, `--lr-space-s`, `--lr-font-size-xs`,
`--lr-color-text-quiet`, and `--lr-radius-xs`.

**Optional peer deps:** none.

```html
<lr-sequence-strip></lr-sequence-strip>
<script>
  const strip = document.querySelector('lr-sequence-strip');
  strip.categories = [
    { key: 'text', color: '#4f46e5', label: 'Text' },
    { key: 'tool', color: '#16a34a', label: 'Tool' },
  ];
  strip.items = [
    { id: '1', category: 'text', label: 'Turn 1: text' },
    { id: '2', category: 'tool', marker: true, label: 'Turn 2: tool call' },
    { id: '3', category: 'text', label: 'Turn 3: text' },
  ];
</script>
```

**Known gotchas:**
- there is no `lr-cell-click`/keyboard-interaction model at all — unlike `lr-heatmap`'s
  canvas cells, a strip cell is purely a hover target; build a click handler outside this component
  (e.g. on a wrapping element) if per-item activation is needed.
- an `items` entry whose `category` has no matching `categories` entry still renders its own cell
  (background `transparent`) rather than being dropped, so a strip stays the same length as `items`
  regardless of `categories` coverage.

---

## `lr-tree` / `lr-tree-node`

An expand/collapse hierarchy (document/graph navigation tree). `lr-tree` owns the data and
imperatively creates/reconciles light-DOM `<lr-tree-node>` children by `id`; `lr-tree-node`
recursively renders itself and its own nested children.

### `lr-tree`

Implements the full WAI-ARIA treeitem keyboard pattern: a single roving `tabindex` (tracked as
`activeId`, pushed down to every `<lr-tree-node>` including nested ones) and
ArrowUp/Down/Right/Left/Home/End/Enter/Space handled by one delegated `keydown` listener (native
`KeyboardEvent`s are `composed: true` and bubble across shadow-DOM boundaries, so a press inside a
deeply-nested node's own shadow root still reaches it).

**Properties:**
- `data: TreeItem[] = []` (attribute: false) — `TreeItem { id: string; label: string; children?:
  TreeItem[]; badge?: string | number; icon?: unknown; description?: string; accessibleLabel?:
  string }`; `icon` renders as a decorative leading visual, `description` as secondary visible row
  text, and `accessibleLabel` names the `role="treeitem"` host without changing its visible label
- `label: string = ''` — accessible name for the tree; `role="tree"` lives on an internal
  `[part="base"]` element. The component forwards a host `aria-label` to that semantic element when
  `label` is empty; `label` takes precedence when both are set. External `aria-labelledby` idrefs
  are not forwarded across the shadow boundary.
- `reorderable: boolean = false` (reflected) — opts into keyboard reordering. Unset, no `lr-reorder`
  is ever emitted, Ctrl/Cmd+Arrow behaves exactly like a plain Arrow press, and the internal live
  region is not rendered at all.

**Keyboard:** ArrowDown/ArrowUp move the roving focus to the next/previous *visible* node.
ArrowRight expands a collapsed node (focus stays put; a second ArrowRight then steps into the first
child) or moves into an already-expanded node's first child. ArrowLeft collapses an expanded node, or
moves focus to its parent. Home/End jump to the first/last visible node. Enter/Space activate
`select()` on the focused node. While `reorderable`, **Ctrl/Cmd**+ArrowUp/ArrowDown moves the focused
node within its own parent's child list instead of navigating. Ctrl/Cmd rather than Alt: Alt+Arrow is
browser back/forward on Windows and Linux. ArrowUp/ArrowDown are not direction-sensitive, so this
binding is deliberately **not** RTL-swapped — "down" always means later in the sibling list.

**Methods:** `expandAll()`, `collapseAll()` (both recursive, properly sequenced around Lit's render
cycle).

**Events:** `lr-reorder` (`detail: { id, parentId, fromIndex, toIndex }`, only while `reorderable`).
Like every other event here it is a **request**: `data` is host-owned and is never mutated by this
component, so nothing moves until the host reassigns a reordered `data` — focus then follows the
moved node. `parentId` is `null` for a top-level item, and `fromIndex`/`toIndex` are **sibling-scoped
indices**, not positions in the flattened visible list. The move is constrained to one sibling list
and never fires at a subtree boundary, so a reorder can never become a reparent: Ctrl+ArrowDown on
the last child of a subtree is ambiguous (the visually next row is a top-level uncle, so "move down"
could mean either "swap with the next sibling" — there is none — or "reparent up a level"), and
reparenting is a structural edit with no keyboard affordance distinguishing the two. Such a request
is simply not made: no event, no announcement, focus stays put. Otherwise this element dispatches
nothing directly (see `lr-tree-node` below — those bubble up and are also observed internally to keep
the roving `activeId` in sync with clicks).

**Slots:** default (holds the `<lr-tree-node>` elements it manages).

**CSS parts:** `base`, `empty` (the empty-state message shown when `data` is empty)

**Themeable custom properties:** shared tokens `--lr-space-xs`/`-s`, `--lr-color-brand-quiet`,
`--lr-color-text-quiet`, `--lr-color-border`, `--lr-color-text`, `--lr-radius`,
`--lr-focus-ring-*` (row `:focus-visible` ring, driven by `:host(:focus-visible)` since the host
itself is the focusable `role="treeitem"`).

**Optional peer deps:** none.

### `lr-tree-node`

Normally set internally by `lr-tree`, but a public element. `role="treeitem"` (plus
`aria-expanded`/`aria-level`/`aria-setsize`/`aria-posinset` and the roving `tabindex`, driven by
`<lr-tree>`) live on the *host* element itself, not an internal row `<div>` — so this node's own
nested children (rendered in its own shadow root as further `role="group"` content) are genuine DOM
descendants of the treeitem, matching the WAI-ARIA treeitem pattern's containment expectation.

**Properties:**
- `item: TreeItem` (required, attribute: false)
- `depth: number = 0`
- `expanded: boolean = false` (reflected)
- `activeId: string | null = null` (attribute: false) — the id of the tree's roving-tabindex-focused
  item, pushed down from `<lr-tree>`; normally set internally, not by consumers
- `setSize: number = 1`, `posInSet: number = 1` (attribute: false) — this node's `aria-setsize`/
  `aria-posinset` values among its siblings, pushed down from `<lr-tree>`; normally set internally,
  not by consumers
- `hasChildren: boolean` (read-only getter) — reports whether `item.children` contains at least one
  child; leaf nodes never expose `aria-expanded` and cannot expand or collapse

**Methods:** `expand()`, `collapse()` (each a no-op if already in that state, or a leaf), `select()`
(fires `lr-node-select`).

**Events:** `lr-node-toggle` (`detail: { id, expanded }`, fired by `expand()`/`collapse()` — via
the toggle button or ArrowRight/ArrowLeft), `lr-node-select` (`detail: { id }`, fired by `select()`
— via clicking anywhere in the row or Enter/Space) — dispatched from `lr-tree-node`,
bubble/compose up
through `lr-tree`'s light DOM.

**Slots:** none.

**CSS parts:** `row`, `toggle`, `icon`, `content`, `label`, `description`, `badge`, `group`. `icon` is
`aria-hidden="true"`; `content` groups the primary label and optional wrapping secondary
description while preserving one interactive treeitem per row.

**Themeable custom properties:** `--lr-tree-depth` (internal, set inline per row for
indentation), plus the shared tokens listed above.

**Optional peer deps:** none.

```html
<lr-tree></lr-tree>
<script>
  document.querySelector('lr-tree').data = [
    {
      id: '1',
      label: 'Root',
      description: 'Two child documents',
      accessibleLabel: 'Root, two child documents',
      icon: document.createTextNode('◇'),
      children: [{ id: '1a', label: 'Child A' }, { id: '1b', label: 'Child B', badge: 3 }],
    },
  ];
</script>
```

**Known gotchas:**
- all four previously-known ARIA gaps in this pair are fixed: the treeitem row is now genuinely
  keyboard-operable with a roving tabindex and full arrow-key navigation (not just the expand/collapse
  button); the expanded-children `role="group"` is now a real DOM descendant of its `role="treeitem"`
  host rather than a shadow-DOM sibling; by-id reconciliation (preserving `expanded` state across
  data reassignment) now applies at every depth via a keyed `repeat()`, not just depth 0; and
  `role="tree"` now has an accessible name via the new `label` property.
- `lr-tree`'s `getUpdateComplete()` cascades into every currently-known descendant
  `<lr-tree-node>`'s own `updateComplete` (see `update-cascade.ts`) so that code awaiting the
  tree's `updateComplete` (e.g. after `focusNode()`) doesn't run before an arbitrarily-nested node has
  actually finished rendering its pushed-down `activeId`/`tabIndex` — one more pending update per
  depth level, otherwise.
- row enrichment is intentionally structured rather than an unrestricted renderer: use `icon`,
  `label`, `description`, `badge`, and `accessibleLabel`. This keeps the host as the single
  `role="treeitem"` interaction target and preserves the APG keyboard model.
- `lr-file-tree` does **not** forward `reorderable`, and deliberately so: its `TreeItem[]` is derived
  from `nodes` on every render and keyed by filesystem path, an order it does not own.

---

## `lr-flow-canvas`

A pannable/zoomable DAG workflow canvas: positions HTML node cards, draws SVG edges between their
handles, runs a shared layered auto-layout for unpositioned nodes, and owns all selection/drag/
connect interaction as controlled events. Readonly (viewer) by default; opt into editor gestures
individually via `nodes-draggable`, `connectable`, `droppable`. Never mutates `nodes` or `edges`
itself — every edit intent is an event the host applies, mirroring `lr-stepper`/`lr-table`'s
controlled-component contract.

**Properties:**
- `nodes: FlowNode[] = []` (attribute: false) — `FlowNode { id: string; type?: string; position?: {
  x, y }; data?: Record<string, unknown>; accessibleLabel?: string; inputs?: FlowHandle[]; outputs?:
  FlowHandle[] }`; a node with no `position` is placed by the layered auto-layout, and `data.label`/
  `data.description` feed the default `<lr-flow-node>` card when no matching light-DOM child exists
- `edges: FlowEdge[] = []` (attribute: false) — `FlowEdge { id: string; source: string; target:
  string; sourceHandle?: string; targetHandle?: string; label?: string; tone?: 'accent' | 'success' |
  'warning' | 'danger' | 'neutral' }` (source/target are node ids; `label` draws at the edge midpoint,
  unlike `lr-graph`'s spoken-only `GraphLink.label`)
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected) — downstream layout/handle axis
- `nodesDraggable: boolean = false` (attribute `nodes-draggable`)
- `connectable: boolean = false`
- `droppable: boolean = false` — accepts drops carrying the `FLOW_PALETTE_MIME_TYPE` payload a
  `lr-node-palette` drag sets, emitting `lr-node-add`
- `locked: boolean = false` (reflected) — freezes pan/zoom/drag/connect without touching the other
  gesture flags
- `selectedNodeIds: string[] = []`, `selectedEdgeIds: string[] = []` (attribute: false) — controlled;
  the host assigns these back from `lr-selection-change`
- `minZoom: number = 0.25` (attribute `min-zoom`), `maxZoom: number = 2` (attribute `max-zoom`)
- `grid: number = 8` — snap step in content px for drags/nudges/drop positions (`0` disables
  snapping); also the dotted background's base spacing
- `layerGap: number = 64` (attribute `layer-gap`), `nodeGap: number = 24` (attribute `node-gap`) —
  auto-layout layer/sibling spacing
- `decorations: FlowRunDecorations | null = null` (attribute: false) — `Record<nodeOrEdgeId,
  FlowRunDecoration>`, `FlowRunDecoration { status: 'pending'|'running'|'success'|'error'|'denied';
  progress?: number; durationMs?: number; detail?: string }`; pushed onto adopted `lr-flow-node`
  cards, typically supplied via a `lr-flow-run-overlay`
- `accessibleLabel: string | null = null` (attribute `aria-label`)
- `viewport` (read-only getter) — `{ x, y, zoom }`, the current pan/zoom state

**Methods:** `setViewport({ x, y, zoom })`, `zoomIn()`, `zoomOut()`, `resetZoom()`,
`fit(options?: { padding?: number })` (frames every node), `focusNode(id, options?: { zoom? })`
(pans/zooms to one node and moves roving focus onto it), `toContentPoint(clientX, clientY)` (maps a
pointer position to content coordinates, RTL-aware), `registerCompanion(cb: (snapshot:
FlowStructureSnapshot) => void): () => void` — the subscription `lr-flow-minimap` uses to read
live node/edge/viewport geometry without this canvas ever importing the minimap.

**Events:** `lr-node-click` (`detail: { id }`), `lr-edge-click` (`detail: { id, source, target
}`), `lr-selection-change` (`detail: { nodeIds, edgeIds }`), `lr-node-move` (`detail: { id,
position, previous }`), `lr-connect` (`detail: { source, target, sourceHandle, targetHandle }`),
`lr-node-add` (`detail: { type, position }`, from a palette drop), `lr-selection-delete`
(`detail: { nodeIds, edgeIds }`), `lr-viewport-change` (`detail: { x, y, zoom }`),
`lr-layout-change` (`detail: { positions }`, fired after an auto-layout pass places previously
unpositioned nodes).

**Slots:** default (`lr-flow-node` children adopted by `node-id`; a non-matching child is ignored
with a console warning), `top-start`, `top-end` (floating corner overlays), `bottom-start` (e.g.
`lr-flow-controls`), `bottom-end` (e.g. `lr-flow-minimap`).

**CSS parts:** `base`, `viewport`, `background`, `edges`, `edge`, `edge-label`, `arrowhead`, `stub`
(a dangling-edge stub line), `connection-line` (in-progress connect gesture), `node`, `empty`,
`live-region`, `edge-list` (a visually hidden list of every edge).

**Themeable custom properties:** `--lr-flow-canvas-grid-size` (default `8px`, dotted background
spacing — the canvas also writes it inline as `${grid}px` from the `grid` property, which wins over
the stylesheet fallback whenever a grid is in effect), `--lr-flow-canvas-march-duration` (default
`var(--lr-transition-ambient)`, running-edge march animation duration), and
`--lr-flow-canvas-node-current-outline-color` (default `var(--lr-color-brand)`) — the outline color
of the current (`aria-current`) node. Like every state-scoped custom property in this library it is
an inline `var()` fallback at its point of use rather than a `:host` declaration, so it can be set on
the element *or any ancestor*. It exists because Shadow Parts forbids an attribute selector after
`::part()` — `::part(node)[aria-current='true']` is invalid CSS — so the current node could otherwise
only be restyled by overriding the library-wide `--lr-color-brand` token, repainting everything else
that reads it.

**Optional peer deps:** none.

```html
<lr-flow-canvas id="canvas" nodes-draggable connectable droppable style="height:480px"></lr-flow-canvas>
<lr-flow-controls slot="bottom-start" for="canvas"></lr-flow-controls>
<lr-flow-minimap slot="bottom-end" for="canvas"></lr-flow-minimap>
<script>
  const canvas = document.getElementById('canvas');
  canvas.nodes = [
    { id: 'a', data: { label: 'Fetch' } },
    { id: 'b', data: { label: 'Transform' } },
  ];
  canvas.edges = [{ id: 'a-b', source: 'a', target: 'b' }];
  canvas.addEventListener('lr-node-move', (e) => {
    canvas.nodes = canvas.nodes.map((n) => (n.id === e.detail.id ? { ...n, position: e.detail.position } : n));
  });
</script>
```

**Known gotchas:**
- Fully controlled: `nodes`/`edges`/`selectedNodeIds`/`selectedEdgeIds` are never mutated
  internally — `lr-node-move`, `lr-selection-change`, `lr-connect`, `lr-node-add`, and
  `lr-selection-delete` are all requests the host applies back, same contract as `lr-table`.
- Auto-layout (via the dependency-free `layeredLayout()` util) only ever positions nodes that are
  missing an explicit `position`; a node the host has already positioned is left exactly where it is
  and used as a fixed anchor for the rest of the layout pass.
- `droppable` only accepts drags carrying the exact `FLOW_PALETTE_MIME_TYPE` MIME type a
  `lr-node-palette` drag sets — the two components can never disagree on the payload shape because
  they share one exported constant.
- Pan/drag/zoom track the pointer's physical direction; under an RTL ancestor the pan and node-drag
  deltas are mirrored so content still visually follows the cursor, matching every other
  RTL-mirrored surface in this library.

---

## `lr-flow-node`

The card a workflow node renders as: header/body/toolbar chrome, tool-lifecycle status tones, and
the named connection-handle elements edges anchor to. Used as `lr-flow-canvas`'s default card and
as a slotted override; also renders standalone (palette previews, docs). Purely presentational —
activation, selection, movement, and connection are all `lr-flow-canvas` events; this component
owns none of that.

**Properties:**
- `nodeId: string = ''` (attribute `node-id`)
- `heading: string = ''`
- `status: 'pending' | 'running' | 'success' | 'error' | 'denied' | null = null` (reflected)
- `progress: number | null = null` — renders a determinate `[part="progress"]` bar when set
- `statusDetail: string = ''` (attribute `status-detail`) — appended to the status line
- `durationMs: number | null = null` (attribute `duration-ms`) — formatted into the status line
- `selected: boolean = false` (reflected)
- `inputs: FlowHandle[] = [{ id: 'in' }]`, `outputs: FlowHandle[] = [{ id: 'out' }]` (attribute:
  false) — `FlowHandle { id: string; label?: string }`
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected) — which physical edge handles
  render on; mirrors the adopting canvas's own `orientation`

**Events:** none — purely presentational, activation/drag/connect all live on `lr-flow-canvas`.

**Slots:** default (body content), `icon` (leading header glyph), `header` (replaces the built-in
heading row entirely), `toolbar` (action row at the block-end edge).

**CSS parts:** `base`, `header`, `icon`, `heading`, `status` (never color-only — always paired with
text), `progress`, `body`, `toolbar`, `handle` (every handle dot), `handle-input`, `handle-output`.

**Themeable custom properties:** `--lr-flow-node-min-inline-size` (default `11rem`) and
`--lr-flow-node-selected-border` (default `var(--lr-color-brand)`) — the card's border color while
`selected`. Like the other state-scoped custom properties here it is an inline `var()` fallback at
its point of use rather than a `:host` declaration, so it can be set on the element *or any
ancestor*; overriding the selection color otherwise means hijacking the library-wide
`--lr-color-brand` token and repainting everything else that reads it.

**Optional peer deps:** none.

```html
<lr-flow-node node-id="a" heading="Fetch" status="running" progress="40"></lr-flow-node>
```

**Known gotchas:**
- A running node's card pulses (`?data-pulse`) unless `prefers-reduced-motion` is set — the same
  reduced-motion exception every animated surface in this library follows.
- `status` drives a status chip with a localized label plus `statusDetail`/`durationMs`, never a
  color-only indicator.

---

## `lr-flow-minimap`

A corner overview map of a `lr-flow-canvas`: scaled node rectangles plus a draggable viewport
rectangle, for orientation and fast navigation on canvases larger than the screen. Draws no edges
(nodes only, matching the React Flow/n8n minimap convention) and never reads `nodes` itself —
geometry always comes from the canvas's `registerCompanion()` snapshots, so the two can never
disagree.

**Properties:**
- `for: string = ''` — id of the target `lr-flow-canvas`; when empty, the nearest ancestor canvas
  is used (the slotted-into-a-corner-slot case, the primary wiring)
- `label: string = ''` — accessible name for the map region; falls back to a host `aria-label`, then
  a localized default

**Events:** none.

**Slots:** none.

**CSS parts:** `base`, `map` (the scaled SVG), `node` (one rect per node), `viewport` (the
draggable, focusable view rectangle).

**Themeable custom properties:** `--lr-flow-minimap-inline-size` (default `12rem`),
`--lr-flow-minimap-block-size` (default `8rem`).

**Optional peer deps:** none.

```html
<lr-flow-canvas id="canvas" style="height:480px">
  <lr-flow-minimap slot="bottom-end" for="canvas"></lr-flow-minimap>
</lr-flow-canvas>
```

**Known gotchas:**
- Never resolves `nodes`/`edges` on its own — it subscribes to `registerCompanion()` and repaints
  from whatever snapshot the canvas last pushed, so it can only ever show what the canvas itself
  currently renders.
- Dragging the viewport rectangle calls the canvas's `setViewport()` directly; there's no separate
  event to wire up.

---

## `lr-flow-controls`

The canvas's button cluster: zoom in/out, fit, and interaction lock, so every flow surface ships the
same affordances without hosts rebuilding them. Manipulates only view state, never `nodes`/`edges` —
no editing commands live here.

**Properties:**
- `for: string = ''` — id of the target `lr-flow-canvas`; empty resolves to the nearest ancestor
- `orientation: 'vertical' | 'horizontal' = 'vertical'` (reflected) — button-cluster layout axis
- `hideLock: boolean = false` (attribute `hide-lock`) — omits the lock/unlock toggle button

**Events:** none dispatched directly — each button calls the resolved canvas's own `zoomIn()`/
`zoomOut()`/`fit()`, or toggles its `locked` property.

**Slots:** default — extra host buttons appended to the cluster, styled by the same group.

**CSS parts:** `base` (the `role="group"` wrapper), `zoom-in`, `zoom-out`, `fit`, `lock` (omitted
when `hideLock`).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-flow-canvas id="canvas" style="height:480px">
  <lr-flow-controls slot="bottom-start" for="canvas"></lr-flow-controls>
</lr-flow-canvas>
```

**Known gotchas:**
- `for` resolution is identical to `lr-flow-minimap`/`lr-flow-run-overlay`: an explicit id, else
  the nearest ancestor canvas — none of the three companions import `LyraFlowCanvas` as a value, only
  its types, so registration order between them and the canvas never matters.

---

## `lr-flow-run-overlay`

Execution-state presentation for a `lr-flow-canvas`: pushes a `FlowRunDecorations` map into the
resolved canvas (the canvas itself renders the node/edge paint) and renders a compact run-summary
strip. Does not execute, poll, or time anything — pure pushed state; `durationMs` is host-computed.

**Properties:**
- `for: string = ''` — id of the target `lr-flow-canvas`; empty resolves to the nearest ancestor
- `decorations: FlowRunDecorations = {}` (attribute: false) — `Record<nodeOrEdgeId,
  FlowRunDecoration>`, pushed verbatim onto the resolved canvas's own `decorations` property
- `hideSummary: boolean = false` (attribute `hide-summary`) — omits the "{done} of {total} steps
  complete" strip, keeping only the decoration push
- `label: string = ''` — accessible name for the summary strip
- `appearance: 'card'|'plain' = 'card'` (reflected) — `'plain'` removes the border, background,
  shadow, padding and radius, so a summary strip dropped straight into a host toolbar that already
  draws its own frame does not double it. `'card'` is the standalone floating-strip presentation and
  is unchanged.

**Events:** none dispatched directly.

**Slots:** default — extra host chrome appended to the strip (e.g. a cancel button or a usage
badge).

**CSS parts:** `base`, `summary` (the "{done} of {total} steps complete" line), `count` (one per
status present, text + tone dot, never color-only), `live-region` (step-transition announcement).

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-flow-canvas id="canvas" style="height:480px">
  <lr-flow-run-overlay slot="top-start" for="canvas"></lr-flow-run-overlay>
</lr-flow-canvas>
<script>
  document.querySelector('lr-flow-run-overlay').decorations = {
    a: { status: 'success', durationMs: 820 },
    b: { status: 'running', progress: 40 },
  };
</script>
```

**Known gotchas:**
- Purely a pushed-state conduit: it never starts, stops, or times a run itself — the host recomputes
  `decorations` (including `durationMs`) on whatever cadence its own execution engine ticks at.
- `for` resolution matches `lr-flow-minimap`/`lr-flow-controls`.

---

## `lr-context-meter`

A segmented occupancy meter (bar or ring) for showing how a fixed capacity — a model's context
window, a token budget, any consumable quota — is divided across labeled categories. First-party
invention (no Web Awesome equivalent). Pure data visualization: it renders `segments`/`total` exactly
as given and never computes token counts, costs, or any other domain-specific estimate itself — the
one exception is the plain arithmetic sum of segment values used to build the accessible "X of Y
used" summary.

**Properties:**
- `segments: ContextMeterSegment[] = []` (attribute: false, JS-only) — `{ label: string; value:
  number; tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'; color?: string }[]`. `value` is an *absolute*
  quantity measured against `total`, never a pre-computed percentage.
  `color`, when supplied, is a sanitized arbitrary CSS color that takes precedence over `tone`.
- `total: number = 0` — the full capacity segments are measured against (e.g. a model's context
  window size).
- `variant: 'ring' | 'bar' = 'bar'` (reflected)
- `label: string = ''` — overall accessible caption, e.g. `"128K context window"`. Also rendered
  visually (`[part="label"]`) when set.

Accessible summaries, segment tooltips, and ring titles format quantities using `effectiveLocale`.
A host `aria-label` overrides the generated meter summary and is preserved across reactive updates.

**Events:** none.

**Slots:** none.

**CSS parts:** `base` (a `<div>` for `bar`, an `<svg>` for `ring`), `track` (the unfilled/empty
capacity), `segment` (one occupied segment — carries `data-tone` and, for custom colors,
`--lr-context-meter-segment-color`), `label`

**Themeable custom properties:** `--lr-context-meter-segment-color` is set per segment when its
`color` field is supplied; otherwise the component consumes shared tokens
`--lr-space-xs`, `--lr-color-text-quiet`, `--lr-font`, `--lr-radius`, `--lr-color-border`,
`--lr-color-surface` (the bar variant's inter-segment seam), `--lr-color-brand`,
`--lr-color-success`, `--lr-color-warning`, `--lr-color-danger`, `--lr-transition-base`.

**Optional peer deps:** none.

```html
<lr-context-meter
  label="128K context window"
  total="128000"
  .segments=${[
    { label: 'System prompt', value: 2200, tone: 'neutral' },
    { label: 'Conversation history', value: 61000, tone: 'brand' },
    { label: 'Retrieved context', value: 30800, tone: 'warning' },
  ]}
></lr-context-meter>

<lr-context-meter variant="ring" total="128000" .segments=${segments}></lr-context-meter>
```

`role="img"` and a computed `aria-label` are set imperatively on the *host* element itself in
`willUpdate` (mirroring `lr-gauge`'s "meter" role convention) — every internal node (`track`,
`segment`, the ring's `<svg>`, `label`) is `aria-hidden`, so a screen reader gets one meaningful
summary string instead of the raw markup. That summary's "used" figure is the sum of
`segments[].value`, clamped to `total` whenever `total > 0` so the announced text can never claim
more than 100% used (e.g. `segments` summing to `150000` against `total="128000"` still announces
`"128,000 of 128,000 used"`) — matching what the *visual* meter shows, since each segment's ratio is
independently clamped so the running cumulative fill across all segments can never exceed 100% of the
bar/ring either: an over-`total` `segments` array renders as a fully (not over-) filled meter, with
later segments truncated or squeezed to zero width/arc-length as the budget runs out. `total <= 0`
(or non-finite) renders zero segments — an empty track/ring — and the announced summary falls back to
just `"{used} used"` with no `"of {total}"` clause, regardless of what's in `segments`. Ring geometry
(a 40-radius circle, 12px stroke, centered at 50,50) intentionally matches `lr-gauge`'s own radial
numbers, so the two circular-meter components in the library share one visual scale.

**Known gotchas:**
- The ring variant's per-segment `<title>` and the bar variant's per-segment `title=` attribute are
  native mouse-hover tooltips only — they sit inside `aria-hidden` markup, so screen readers never
  read them; only the host's own `role="img"`/`aria-label` carries accessible information.
- `variant="ring"` fixes the host at `8em × 8em` (`:host([variant='ring'])`) — the bar variant's
  `inline-size: 100%` does not apply in ring mode; resize it via `font-size` or an explicit
  width/height override on the host instead.
- Segment order is significant for the ring's cumulative `stroke-dashoffset` — later entries in
  `segments` render further around the circle (starting at 12 o'clock, going clockwise); there's no
  independent sort/z-order control.

---

## `lr-data-grid`

Keyboard-navigable data grid with typed `columns` and `rows`, sortable headers, roving cell focus,
loading/empty states, and responsive horizontal overflow.

**Properties:**
- `columns: DataGridColumn<T>[] = []` (attribute: false) — `{ key, label, width?, sortable?,
  value? }`; `width` becomes the header cell's `inline-size`, `value(row)` overrides the default
  `row[key]` lookup
- `rows: T[] = []` (attribute: false)
- `rowKey: (row: T, index: number) => string | number = (_row, index) => index` (attribute: false)
- `selectedKey: string | number | null = null` (attribute: false) — compared against `rowKey(row, i)`
  to set `[part='row'][data-selected]` and `aria-selected`
- `sortKey: string = ''`, `sortDirection: 'ascending' | 'descending' = 'ascending'`
  (attribute: false) — the grid updates both on header activation and emits `lr-sort`, but never
  reorders `rows`; sorting stays the consumer's job
- `loading: boolean = false` (reflected) — replaces the body with a localized "loading" row
- `emptyText: string = ''` (attribute `empty-text`) — empty-state text; falls back to the localized
  `noData`
- `accessibleLabel: string = ''` (attribute `aria-label`) — names the `role="grid"` table; falls back
  to the localized `dataGridLabel`

**Keyboard:** exactly one cell is tabbable. Arrows move the roving focus (Left/Right are swapped
under RTL), Home/End jump to the first/last column of the current row, Enter/Space activate the row.
The focus position is re-clamped whenever `rows`/`columns` shrink, so the grid can't lose its tab stop.

**Events:** `lr-row-click` (`detail: { row }`, click or Enter/Space), `lr-selection-change`
(`detail: { row }`, emitted alongside it after `selectedKey` updates), `lr-cell-focus`
(`detail: { row, column }`, `column` is the column `key`), `lr-sort` (`detail: { key, direction }`,
`sortable` columns only; re-activating the active column flips `direction`).

**Slots:** none.

**CSS parts:** `viewport` (the scrolling bordered wrapper), `grid` (the `<table role="grid">`),
`header` (each sticky `<th>`), `row`, `cell`, `empty` (the loading / no-data cell).

**Themeable custom properties:** `--lr-data-grid-row-selected-bg` (default
`var(--lr-color-brand-quiet)`) — the background of the selected row's cells. It is an inline `var()`
fallback at its point of use rather than a `:host` declaration, so it can be set on the element *or
any ancestor*. It exists because Shadow Parts forbids an attribute selector after `::part()` —
`::part(row)[aria-selected='true']` is invalid CSS — leaving the library-wide
`--lr-color-brand-quiet` token as the only prior lever, which repaints every other surface reading
it. `lr-table` exposes the equivalent knob as `--lr-table-row-selected-bg`.

## `lr-calendar`

Responsive month calendar with event markers and an agenda view.

**Properties:**
- `events: CalendarEvent[] = []` (attribute: false) — `{ id?, date, title, start?, end?, color?,
  data? }`; `date` is an ISO `YYYY-MM-DD` string and `color` is sanitized before being used as the
  marker background
- `value: string = ''` — the selected ISO date
- `viewDate: string` (attribute `view-date`, defaults to the 1st of the current month) — the visible
  month; an unparseable value falls back to the current month
- `view: 'month' | 'agenda' = 'month'` (reflected) — agenda lists this month's events, date-sorted
- `firstDayOfWeek: number = 1` (attribute `first-day-of-week`) — sanitized to a finite integer
  (fallback `1`) and wrapped into `0`–`6`, so a malformed value can't drop days
- `accessibleLabel: string = ''` (attribute `aria-label`) — names the calendar `<section>`; falls back
  to the localized `calendarLabel`

**Keyboard:** the month grid is a fixed 6×7 matrix (leading/trailing days of adjacent months fill it
out) with one roving tab stop — `focusedDate`, else `value`, else today, else the first rendered day.
Arrows move by 1 day (Left/Right swapped under RTL) or 7; stepping past the rendered grid rolls
`viewDate` to the target's month and emits `lr-view-change`. Enter/Space select.

**Events:** `lr-date-select` (`detail: { date }`), `lr-event-select` (`detail: { event }`),
`lr-view-change` (`detail: { viewDate }`, from the prev/next buttons and out-of-grid arrow moves).

**Slots:** none.

**CSS parts:** `header`, `nav` (carried both by the previous button itself and by the wrapper around
the next button), `nav-glyph` (the chevron, `scaleX(-1)`-mirrored under RTL), `title`, `weekdays`,
`weekday`, `grid`, `week` (`display: contents`), `day`, `date`, `event` (a month-view marker),
`agenda`, `agenda-event`.

**Themeable custom properties:** `--lr-calendar-day-min-block-size` (default `var(--lr-size-6rem)`)
and `--lr-calendar-day-min-block-size-narrow` (default `4rem`, applied at container inline-size
≤ 28rem).

**Gotcha:** month-view `[part='event']` markers are a mouse-only quick-select affordance — they sit
inside the day `<button>`, which may not contain focusable descendants. Agenda view renders each
event as a real `<button part="agenda-event">` and is the keyboard-accessible path to
`lr-event-select`.

## `lr-timeline` and `lr-timeline-item`

Read-only chronological sequence. `lr-timeline` is a `role="list"` flex container; each
`lr-timeline-item` is a light-DOM child that sets `role="listitem"` on itself and renders its own
marker plus the trailing rail segment reaching toward the next item's marker. The last item's rail is
suppressed purely in CSS (`::slotted([role='listitem']:last-child)`) — no JS coordination anywhere.
Neither element has events, keyboard navigation, or a selection model: a passive record display, by
design (an item's `title`/`description` routinely hold focusable content, so wrapping the row in
`role="button"` would trip `nested-interactive`).

**`lr-timeline` properties:** `orientation: 'vertical' | 'horizontal' = 'vertical'` — note the
opposite default from `lr-stepper`; `horizontal` makes `[part='base']` a horizontally scrollable row.
`accessibleLabel: string = ''` (attribute `aria-label`) overrides the localized `"Timeline"` name
(the `role="list"` element is in the shadow root and never inherits a host attribute). Read-only
`itemCount: number` is the live default-slot child count.

**`lr-timeline-item` properties:** `timestamp?: Date | string | number` (attribute: false — `Date`
isn't attribute-serializable; invalid input normalizes to unset and renders no timestamp UI),
`sync: boolean = false` (forwarded to the internal `<lr-relative-time>`; no effect when the
`timestamp` slot is filled), `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' =
'neutral'` (marker tone), `active: boolean = false` (reflected — pulsing marker, disabled under
`prefers-reduced-motion: reduce`, plus `aria-current="true"` on the host, removed entirely while
inactive).

**Events:** none on either element. Listen to the native `slotchange` if you need item-count changes.

**Slots:** `lr-timeline`'s default slot holds the items, in display order. On an item the **default
slot is the title** (there is no `title` slot), plus `icon` (marker glyph override; falls back to a
color-coded dot), `timestamp` (wins outright over the `timestamp` property whenever it has assigned
content), and `description` (its part is hidden entirely when empty).

**CSS parts:** timeline `base` — the `role="list"` flex container (no separate `list` part). Item:
`base`, `track` (marker + rail spine, always the opposite axis from `base`), `marker`
(`aria-hidden="true"`, decorative), `rail` (the connecting segment; `visibility: hidden` rather than
removed on the last item, so marker alignment stays consistent), `content`, `header` (flex row
wrapping `title` and `timestamp`; wraps at narrow widths rather than truncating), `title`,
`timestamp` (hidden when there's nothing to show), `description`.

**Themeable custom properties:** `--lr-timeline-gap` (default `var(--lr-space-l)`) — declared on
`lr-timeline` but consumed inside each item via inheritance across the slot boundary; it is both the
inter-item spacing and the length each rail bridges. On the item: `--lr-timeline-marker-size`
(default `var(--lr-size-1-25rem)`, both dimensions so the dot stays circular),
`--lr-timeline-rail-width` (default `var(--lr-border-width-medium)`), `--lr-timeline-rail-color`
(default `var(--lr-color-border)`), `--lr-timeline-marker-color` (default
`var(--lr-color-text-quiet)`, swapped per `variant`; setting it directly on an item wins over the
variant default).

**Internal, not public:** `--lr-timeline-item-direction`, `--lr-timeline-item-track-direction`,
`--lr-timeline-item-gap-block-end` and `--lr-timeline-item-gap-inline-end` (set by `lr-timeline`'s
`:host` / `:host([orientation='horizontal'])` rules), plus `--lr-timeline-item-rail-visibility` (set
by its `::slotted(:last-child)` rule) propagate orientation and last-item state across the slot
boundary. Overriding any of them breaks layout rather than merely restyling it.

## `lr-file-tree`

A file-explorer preset over `<lr-tree>` + `<lr-file-icon>`: path-keyed nodes with
git-status/diff-count badges, lazy directory loading, and select/open events.

**Properties:** `nodes: FileTreeNode[] = []` (attribute: false), `selectedPath: string | null = null`
(attribute `selected-path`), and `label: string = ''`.

**Methods:** `setChildren(path, children)` supplies a lazily-loaded directory's children.
`revealPath(path)` expands every ancestor directory and scrolls the target row into view, resolving
`true` once found. `expandAll()` and `collapseAll()` forward to the underlying `<lr-tree>`.

**Events:** `lr-file-select` (`detail: { path, node }`, a row was activated), `lr-file-open`
(`detail: { path, node }`, Enter/click on an already-selected file row), and `lr-load-children`
(`detail: { path }`, a lazy unloaded directory expanded).

**CSS parts:** `base` — the root wrapper.

## `lr-env-list`

A masked key/value list for environment variables and secrets, with per-row reveal and copy.
Masking is presentational, not a security boundary: the real value sits in a DOM property
regardless of mask state.

**Properties:** `entries: EnvEntry[] = []` (attribute: false), `revealable: boolean = true`
(reflected), `copyable: boolean = true` (reflected), and `label: string = ''`.

**Events:** `lr-reveal-change` (`detail: { name, revealed }`) and `lr-copy` (`detail: { text }`,
the real unmasked value).

**CSS parts:** `base` (the `<dl>` root), `name` (the `<dt>` text), `value-cell` (the `<dd>` wrapping
an entry's value text and buttons), `value` (carries `data-masked`), `reveal-button`, and
`copy-button`.

**Themeable custom properties:** `--lr-env-list-reveal-active-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-env-list-reveal-active-border` (default
`var(--lr-color-brand)`) — the background and border color of a pressed (revealed) reveal toggle.
Both are inline `var()` fallbacks at their point of use rather than `:host` declarations, so either
can be set on the element *or any ancestor*. They exist because
`::part(reveal-button)[aria-pressed='true']` is invalid CSS — Shadow Parts forbids an attribute
selector after `::part()` — so restyling the pressed state otherwise required overriding the
library-wide brand tokens.

## `lr-document-library`

Controlled searchable and filterable document inventory with versions, tags, owners, freshness,
sorting, and bulk selection.

**Properties:** `documents`, `filter`, `label`, `loading`, `selectedIds`, `sortKey`, `sortDirection`,
`tagFilter`. **Events:** `lr-filter-change`, `lr-open`, `lr-selection-change`, `lr-sort`. **CSS
parts:** `base`, `toolbar`, `search`, `tag-filter`, `selection-bar`, `selection-count`,
`clear-selection`, `table`, `row`, `cell`, `header-cell`, `document-name`.

## `lr-graph-query-builder`

Form-associated editor for a typed graph relationship/path query, including entity anchors,
relationship and node-type filters, hop limits, validation, and saved queries.

**Properties:** `value`, `label`, `labels`, `name`, `disabled`, `effectiveDisabled`, `nodeTypeOptions`,
`relationshipTypeOptions`, `hopLimit`, `savedQueries`, `errors`, `form`, `validity`,
`validationMessage`, `willValidate`, `checkValidity`, `reportValidity`, `formDisabledCallback`,
`formResetCallback`, `formStateRestoreCallback`. **Events:** `lr-input`, `lr-validity-change`,
`lr-query-run`, `lr-query-save`, `lr-query-load`, `lr-query-delete`. **Slots:** `actions`. **CSS
parts:** `base`, `path-fields`, `start-input`, `end-input`, `relationship-picker`,
`relationship-chips`, `node-type-picker`, `node-type-chips`, `direction`, `filter-group`,
`min-hops`, `max-hops`, `footer`, `run-button`, `save-button`, `save-row`, `save-name-input`,
`saved-queries`, `saved-queries-label`, `saved-list`, `saved-item`, `saved-load-button`,
`saved-delete-button`, `saved-empty`.

## `lr-query-builder`

Composable structured-query builder for tabular or dashboard data: condition rows combined with an
AND/OR combinator.

**Properties:** `fields`, `value`, `disabled`, `addCondition`, `removeCondition`. **Events:**
`lr-input`, `lr-add-condition`, `lr-remove-condition`. **CSS parts:** `base`, `conditions`,
`condition`, `field-select`, `operator-select`, `value`, `combinator`, `add-button`,
`remove-button`, `empty`.
