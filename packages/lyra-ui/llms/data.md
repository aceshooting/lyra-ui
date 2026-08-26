## Breaking changes in 10.0.0

`<lr-calendar>`'s `firstDayOfWeek`/`first-day-of-week` drops the bare `0`–`6` integer form and stops
defaulting to a hardcoded Monday. The type is now exactly `LyraCalendarFirstDayOfWeek`
(`'auto'|'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'`, default `'auto'`), so there is one way to
express a week start instead of two that had to be sanitized and wrapped against each other, and
`'auto'` resolves through the same `resolveFirstDayOfWeek()` contract `<lr-date-picker>`/
`<lr-date-input>` already use. An unset `<lr-calendar>` and an unset `<lr-date-picker>` on the same
page therefore agree at last — Sunday-first under `en-US`, Monday-first under `fr-FR` — where the
calendar previously rendered Monday-first everywhere while already formatting its weekday *labels*
from the locale. Replace `first-day-of-week="1"` with `first-day-of-week="mon"`: a leftover numeric
value is not mapped or clamped, it is simply an unrecognized token and falls through to Sunday. If
the locale-independent Monday start was deliberate, keep it by writing `"mon"` explicitly instead of
relying on the default. There is no `wa-calendar`, so no upstream mirror is affected.

Also corrected in 10.0.0 — not breaking, but visible. A specificity sweep found rules that were
meant to win yet were losing to another rule in the same shadow stylesheet, so their declarations
never applied at all. In this family: `<lr-calendar>`'s today cell has a focus ring again (its
`[data-today]` outline was swallowing it, leaving today's cell pixel-identical focused and at rest)
and its adjacent-month cells take selection and pointer feedback again; `<lr-table>`'s header cell
that is both sticky and sortable, `<lr-pagination>`'s page input, `<lr-sequence-strip>`'s selected
cell and `<lr-flow-canvas>`'s selected edge regain hover/press/focus feedback; and
`<lr-flow-controls>` honors a `hidden` slotted action button instead of painting it.

## `lr-sparkline`

Zero-dependency inline SVG trend chart (mirrors `<wa-sparkline>`). Its default allocation is one
`em` tall at a `4 / 1` aspect ratio, so it can sit directly in text; authored block size changes
both dimensions through the aspect ratio.

**Properties:**

- `appearance: 'gradient'|'line'|'solid' = 'solid'` (reflected) — `solid` fills the area below the
  stroke, `gradient` fades that fill toward the baseline, and `line` renders only the stroke
- `curve: 'linear'|'natural'|'step' = 'linear'` (reflected) — straight segments, smooth cubic
  interpolation, or horizontal/vertical steps
- `data: string = ''` — space-separated finite numbers such as `"5 4 4 3 4 2 3"`; at least two
  finite values are required. Invalid/non-finite tokens are dropped, and a remaining series shorter
  than two values renders the named empty wrapper without an invalid SVG path
- `label: string = ''` — accessible name applied verbatim to the SVG
- `trend?: 'positive'|'negative'|'neutral'` (reflected) — selects semantic Lyra-token defaults for
  the line and fill. The public color custom properties below always override it

**Additive Lyra extensions:**

- `values: readonly number[] = []` (attribute: false) — property-only programmatic data source used
  while `data` is empty; foreign/non-array assignments render the empty state rather than throwing
- `mark: LyraSparklineMark = 'line'`, where `LyraSparklineMark = 'line'|'bar'` (reflected) —
  chooses line/path versus bounded rectangle geometry. Fill treatment remains solely on the
  mirrored `appearance` axis
- `min?: number` (defaults to data minimum)
- `max?: number` (defaults to data maximum)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — programmatic compatibility
  name for the additive `values` path. Naming precedence is an authored host `aria-label`
  (including an intentional empty value), then nonempty `label`, then a nonempty programmatic
  `accessibleLabel`, then the localized generated summary

**Events:** none.

**Slots:** none.

**CSS parts:** `sparkline` and deprecated `base` are aliases on the same outer SVG, `fill` is the
area path for solid/gradient appearance, `line` is the stroke path. Additive aliases are `area` on
the same fill path and `bar` on each extension-mode rectangle.

**Themeable custom properties:** `--fill-color` (area/gradient stop color), `--line-color` (stroke
color), and `--line-width` (stroke width). Each reads through the live CSS cascade; line/fill
default to the selected `trend`'s semantic Lyra tokens and `--line-width` falls back through the
compatibility `--lr-sparkline-stroke-width` to `--lr-border-width-medium`. No canvas bridge or
manual refresh is needed.

**Optional peer deps:** none.

```html
<lr-sparkline
  appearance="gradient"
  curve="natural"
  trend="positive"
  data="3 5 4 8 6 9 7"
  label="Revenue over the last seven days"
></lr-sparkline>
```

**Known gotchas:**

- The semantic `role="img"` and accessible name live on the SVG that owns the graphic. `label` is
  applied exactly. The additive `values` path retains its localized, effective-locale summary when
  neither naming property is present; a `data` chart without a label is left presentational rather
  than inventing spoken application data.
- flat data (every value equal, so the auto-computed range spans zero) now renders a centered
  midline/mid-height bars instead of collapsing every point to the bottom edge, and a single-value
  additive `values` series renders a visible flat line. Mirrored `data` deliberately requires two
  values. **Every** rendering mode
  (`mark="line"` with any appearance, or `mark="bar"`) decimates a `values` array past 500 points
  down to at most 500 plotted
  samples — evenly sampled by index, always keeping the first and last value exactly, not
  aggregated/averaged. `mark="bar"` caps at 500 rendered `<rect>`s directly; line marks cap the
  point count baked into the single `<path>`'s `d` string instead (an uncapped path string also
  grows unbounded, even though the element count stays at one `<path>`). Auto `min`/`max` is still
  scanned from the _full_ pre-decimation `values` array, so a real extreme value that decimation
  happens to drop can't silently narrow the rendered scale.
- Point order mirrors under RTL while the numeric sample order remains unchanged. There are no
  animations, so reduced-motion mode needs no alternate timing branch.
- **9.0 migration:** rename additive `type="bar"`/`"line"` to `mark="bar"`/`"line"`. Replace
  `type="area"` with `mark="line" appearance="solid"`. `values` is now property-only, matching its
  array type; use mirrored `data` for declarative space-separated samples.

---

## `lr-stat`

KPI/stat card — value + unit + label + optional icon/trend/caption.

**Renamed in 8.0.0 — breaking:** `appearance` is now `frame`. Library-wide, `appearance` means only
"how a control fills itself" and `frame` means "whether a container draws itself as a bounded card";
this property was always the second. There is no alias — `appearance` on `<lr-stat>` is an unknown
attribute now, so a stat left on `appearance="plain"` silently renders full card chrome again.

**Properties:**

- `label: string = ''`
- `accessibleLabel: string | null = null` (attribute `aria-label`) — when `href` is safe, this
  host-level override names the real whole-card anchor; removing it restores the natural
  label/value/unit name
- `value: string = ''`
- `unit: string = ''`
- `href?: string` — when it resolves to a safe URL, the root is a real whole-stat `<a>`; unsafe
  URL schemes keep the stat non-interactive. The anchor is stretched behind the visible content,
  so public slots remain semantic siblings rather than interactive descendants of the link
- `target?: string` — forwarded to the anchor while `href` is active; a nonempty target derives
  `rel="noopener noreferrer"` rather than exposing a separately settable `rel`
- `variant: LyraVariant = 'neutral'` (reflected) — the library's shared
  one semantic-tone vocabulary, tinting `[part="value"]`. **`brand` is new in 8.0.0**, so a stat
  whose headline is the primary metric no longer has to borrow `emphasis` (which is a card-chrome
  accent) to read as branded
- `deltaPercent: number | null = null` (attribute `delta-percent`) — a finite percentage delta;
  `null` hides the trend pill and any non-finite assignment normalizes to `null`
- `caption: string = ''`
- `goodDirection: 'up'|'down' = 'up'` (attribute `good-direction`) — which trend direction counts
  as "good"; inverts arrow/color polarity for cost/latency/error-rate-style metrics where a
  _decrease_ is the win.
- `rows: readonly StatRow[] = []` (attribute: false) — `StatRow { readonly label: string; readonly
value: string; readonly exactValue?: string }`; at most the first 10,000 rows are snapshotted and
  frozen at assignment. Reassign `rows` after changing it. The snapshot renders as a simple
  label/value breakdown list (`[part="rows"]`/`[part="row"]`/
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
- `frame: 'card'|'plain' = 'card'` (reflected) — container treatment, on the library-wide `frame`
  vocabulary. `'card'` keeps the bordered, filled, padded box that stretches to fill its
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

**Slots:** `start` (canonical leading icon), default (legacy leading-icon alias, retained as the
fallback; `start` takes precedence when both are filled), `caption` (rich caption content —
overrides the `caption` attribute when slotted content is provided), `spark` (a sparkline, e.g. `<lr-sparkline
slot="spark">`, or other compact trend visual — `lr-stat` only reserves the slot and doesn't
render one itself), `sub` (rich sub-line content — overrides the `sub` attribute when slotted content
is provided). In a linked stat, an interactive slotted descendant keeps its own focus and action;
clicking non-interactive slotted content still follows the whole-card link.

**CSS parts:** `base` (a `<div>`, or an `<a>` for a safe `href`), `icon`, `label` (carries `hidden`,
and is collapsed, whenever `label` is empty — a label-less stat leaves no blank line above the
value), `value-row`, `value`, `unit`, `trend`, `sub`, `spark`,
`caption`, `rows`, `row`, `row-label`, `row-value` — `[part="value"]` gets `aria-labelledby` pairing
it with `[part="label"]`'s generated id whenever `label` is non-empty (so tabbing straight to the
`exactValue`-focusable value still announces e.g. "Revenue $1.2K USD", including the visible unit,
not just the bare value); each
`[part="row-value"]` is paired the same way with its own row's `[part="row-label"]`.

**Themeable custom properties:** `--lr-stat-trend-good-color` (default `var(--lr-color-success)`)
and `--lr-stat-trend-good-bg` (default `color-mix(in srgb, var(--lr-color-success) 8%,
transparent)`) — text/background of `[part="trend"]` when its polarity (per `goodDirection`) is
"good"; `--lr-stat-trend-bad-color` (default `var(--lr-color-danger)`) and `--lr-stat-trend-bad-bg`
(default `color-mix(in srgb, var(--lr-color-danger) 8%, transparent)`) — the "bad"-polarity
counterparts. All four are independent of the headline value's `variant="success"`/`"danger"` tint,
so retinting the trend pill doesn't also recolor the value, and vice versa.
`--lr-stat-value-brand-color` (default `var(--lr-color-brand)`),
`--lr-stat-value-success-color` (default `var(--lr-color-success)`),
`--lr-stat-value-warning-color` (default `var(--lr-color-warning)`), and
`--lr-stat-value-danger-color` (default `var(--lr-color-danger)`) independently color the headline
value for each non-neutral `variant`. `--lr-stat-emphasis-border-color` and
`--lr-stat-emphasis-value-color` (both default `var(--lr-color-brand)`) independently color the
emphasis accent edge and a neutral emphasized headline without retinting `variant="brand"`.
Linked-card interaction paint is independently themeable through
`--lr-stat-link-hover-border-color` (default `var(--lr-color-brand)`),
`--lr-stat-link-hover-shadow` (default `var(--lr-shadow-s)`),
`--lr-stat-link-active-border-color`/`--lr-stat-link-active-shadow` (defaulting to their hover
counterparts), and `--lr-stat-link-active-bg` (defaulting to the existing active color mix). These
are point-of-use fallbacks, so values inherit from a theme ancestor and a value on `lr-stat` wins.

**Optional peer deps:** none.

```html
<lr-stat
  label="Active users"
  value="1,204"
  delta-percent="4.2"
  variant="success"
>
  <svg slot="start">...</svg>
</lr-stat>
<lr-stat label="Memories" value="128" href="/memories"></lr-stat>
```

**Known gotchas:**

- When `href` makes the whole stat a link, exact-value spans keep their hover tooltips but omit
  their own `tabindex` to avoid nesting focus targets inside the anchor.
- Slotted buttons, links, and other controls are outside the stretched whole-card anchor. Their
  actions never also navigate the stat; use a host `aria-label` when the link destination needs a
  more specific name than the visible label/value/unit.
- no `aria-live` region wraps `value`/`deltaPercent` — an in-place update after first render still isn't
  proactively announced to screen readers. The trend pill's direction/polarity is no longer
  conveyed by icon rotation/color alone, though: a visually-hidden span now spells it out in plain
  language (e.g. "increased 4.2%, good" / "decreased 2%, bad" / "unchanged"), so a screen reader
  landing on the pill (rather than being live-notified of a change) gets the full meaning, not just
  an `aria-hidden` arrow glyph.
- **9.0 migration:** rename `trend`/`trend=` to `deltaPercent`/`delta-percent`; replace the `NaN`
  absence sentinel with `null`. Import shared `LyraVariant` and `LyraFrame` directly; the redundant
  `StatVariant` and stale `StatAppearance` aliases were removed. Calling `click()` on a linked stat
  now activates its whole-card anchor exactly once.

---

## `lr-data-grid`

Virtualized client/server data grid with multi-sort, column filters, global search, grouping,
trees, row details, paging, pinning, resizing, reordering, selection, copy, and CSV export. Import
the granular registration module when the root bundle is not already loaded:

```js
import "@aceshooting/lyra-ui/components/data/data-grid/data-grid.js";
```

Give the grid an accessible name with `label` or a host `aria-label`; the host attribute wins.
Collection inputs are clone-owned readonly snapshots, so reassign `data`, `columns`, `groupBy`, and controlled
state arrays to update them; mutating the array originally assigned has no effect.
Column records are also copied and frozen synchronously. Row object
identities are preserved so formatter callbacks and `selectedRows` still refer to caller records.
Column identity uses a nonblank `id`, then a nonblank `field`, then stable definition-object
occurrence; malformed, blank, and later-duplicate identities are omitted first-wins. When `rowKey`
is set, malformed, blank, and later-duplicate row identities are omitted first-wins before
rendering, focus, selection, expansion, or events. Without `rowKey`, stable row-object occurrence
replaces positional identity, so reordering the same records does not transfer DOM or controlled
state to another row.

Pagination exposes the same page-local ARIA row model in client and server modes. The header is row
one; current-page display rows and expanded detail rows begin at two; and `aria-rowcount` covers
only that page plus the header. In server mode, `total` still drives `pageCount` and the pager, but
does not inflate `aria-rowcount` while `aria-rowindex` restarts for each loaded page. Treat these
ARIA values as page-local positions rather than as the dataset-wide total.

**Properties:**

- `appearance: 'outlined' | 'plain' = 'outlined'` (`appearance`, reflected).
- `childRows: string | ((row) => readonly Row[] | undefined) | null = null` (`child-rows`) — dot path or
  callback for nested rows. Tree sorting stays within each parent and paging keeps a subtree with
  its top-level parent. Projection is iterative, cycle-safe, and bounded to 10,000 total rows and
  64 descendant levels; exceeding a budget renders the localized `tree-limit` notice.
- `columnOrder: readonly string[] = []` (JS-only) — empty preserves declaration order.
- `columns: readonly DataGridColumn<Row>[] = []` (JS-only).
- `data: readonly Row[] = []` (JS-only) — client rows, or the currently loaded server page.
- `dataSource: ((request) => Promise<{ rows, total }>) | null = null` (JS-only) — providing it
  enables server behavior.
- `expandedRowKeys: readonly Array<string | number> = []` (JS-only).
  The mirrored `expandedKeys` spelling remains a compatibility alias for this same state.
- `filterDebounce: number = 250` (`filter-debounce`) — finite server search/filter delay.
- `filteredCount: number` (read-only, JS-only) — matching client rows before paging.
- `filterFromLeafRows: boolean = false` (`filter-from-leaf-rows`) — retains ancestors of matching
  tree descendants.
- `filters: readonly Array<{ readonly id: string; readonly value: unknown }> = []` (JS-only).
- `groupBy: string | readonly string[] | null = null` (`group-by`) — a string accepts comma- or
  whitespace-separated column ids/fields.
- `label: string | null = null` (`label`).
- `loading: boolean = false` (`loading`, reflected).
- `maxMultiSort: number = 0` (`max-multi-sort`) — zero means unlimited; the oldest sort is dropped
  when a positive limit is reached.
- `page: number = 0` (`page`, reflected) — zero-based.
- `pageCount: number` (read-only, JS-only).
- `pageSize: number = 20` (`page-size`).
- `pageSizeOptions: readonly number[] = [10, 20, 50, 100]` (JS-only). A finite current `pageSize`
  absent from this list is still inserted into the selector, keeping visible and IDL state aligned.
- `paginate: boolean = false` (`paginate`, reflected).
- `pinnable: boolean = false` (`pinnable`, reflected).
- `reorderable: boolean = false` (`reorderable`, reflected).
- `resizable: boolean = false` (`resizable`, reflected).
- `rowClass: ((row) => string | null | undefined) | null = null` (JS-only).
- `rowDetail: ((row) => string | TemplateResult | Node) | null = null` (JS-only).
- `rowKey: string | null = null` (`row-key`) — dot path for stable selection/expansion identity.
- `searchFn: ((value, term, row) => boolean) | null = null` (JS-only).
- `searchTerm: string = ''` (JS-only).
- `selectable: '' | 'single' | 'multiple' | 'none' = 'none'` (`selectable`, reflected) — a bare
  `selectable` attribute means `multiple`.
- `selectableRows: ((row) => boolean) | null = null` (JS-only).
- `selectedRowKeys: readonly Array<string | number> = []` (JS-only).
  The mirrored `selectedKeys` spelling remains a compatibility alias for this same state.
- `selectedRows: readonly Row[]` (writable, JS-only) — assigning rows that belong to the current source
  maps them to `selectedRowKeys`; detached rows are ignored and single-selection mode keeps the first.
- `server: boolean = false` (`server`, reflected).
- `size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' = 'm'` (`size`, reflected).
- `sort: readonly Array<{ readonly id: string; readonly desc: boolean }> = []` (JS-only).
- `sortDescFirst: boolean = false` (`sort-desc-first`).
- `striped: boolean = false` (`striped`, reflected).
- `total: number = -1` (`total`) — server total; `-1` derives from loaded/matching rows.
- `withColumnMenu: boolean = false` (`with-column-menu`, reflected).
- `withColumnsMenu: boolean = false` (`with-columns-menu`, reflected).
- `withoutSortRemoval: boolean = false` (`without-sort-removal`, reflected).
- `withSearch: boolean = false` (`with-search`, reflected).

`DataGridColumn<Row>` accepts `id`, dot-path `field`, `label`, `align`, numeric `width` /
`minWidth` / `maxWidth`, `flex`, `formatter(value, row)`, computed `value(row)`, `sortable`,
`sortFn`, `comparator`, `sortDescFirst`, `sortUndefined`, `searchable`, `filterable`, `filterType`,
`filterFn`, `hidden`, `hideable`, `resizable`, `movable`, `pinnable`, `pinned`, `footer`,
`aggregation`, and `aggregatedFormatter`. A column with neither `field` nor `value` is an action
column: its formatter receives `undefined`, and it is not sorted or searched by default.

Built-in sort algorithms are `alphanumeric`, `alphanumericCaseSensitive`, `text`,
`textCaseSensitive`, `datetime`, and `basic`; `comparator` takes precedence. Built-in filter types
are `text`, `equals`, `number-range`, `date-range`, `set`, `includes-any`, and `includes-all`;
`filterFn` takes precedence in client mode. Group aggregations are `sum`, `min`, `max`, `mean`,
`median`, `count`, `unique`, `uniqueCount`, `extent`, or a callback.

**Methods:**

- `autoSizeColumn(columnId)`, `autoSizeColumns()`, and `sizeColumnsToFit()` manage measured widths.
- `collapseAllRows()`, `collapseRow(key)`, `expandAllRows()`, and `expandRow(key)` update expansion
  without emitting the user-only row events.
- `copySelectedRows(options?: DataGridCopyOptions)` copies selected rows (or all processed rows
  when selection is empty) as TSV by default and returns the copied row count. Its options include
  `columnIds`, `includeHeaders`, `format: 'tsv' | 'csv'`, `escapeFormulas`, and `delimiter`; an
  explicit delimiter overrides the one normally selected by `format`. Clipboard settlement is
  asynchronous: `lr-copy` fires only after the owning context's write fulfills (including a
  successful legacy textarea fallback), while rejection emits `lr-error` plus `lr-copy-error` and
  announces the localized `copyFailed` string. Copy intent alone is never reported as success.
- `exportDataAsCsv(options?: DataGridExportOptions)` downloads formula-safe delimited data (CSV by
  default); `getDataAsCsv(options?: DataGridCsvOptions)` returns it without downloading. Options include `delimiter`,
  `includeHeaders`, `columnIds`, `escapeFormulas`, and `fileName`. The Lyra-only `columns` and
  `filename` aliases were **removed in 9.0.0** — rename them to `columnIds` and `fileName` (the
  spellings `wa-data-grid` uses); an unrenamed call silently falls back to every visible column and
  `data.csv`. Formula escaping is on by default for string cells beginning with `=`, `+`,
  `-`, or `@`; numeric values remain numeric.
- `focus(options?)` focuses the current roving header/cell stop.
- `getColumnFacets(columnId)` returns `{ uniqueValues: Map, minMax? }`, computed after every other
  filter but before the named column's own filter. Server mode returns an empty map.
- `getColumnPin(columnId)`, `pinColumn(columnId, side: 'left' | 'right' | 'start' | 'end' | false)`, and
  `toggleColumn(columnId, visible)` read or change column state without emitting the corresponding
  user-only events. `left`/`start` mean logical inline-start and `right`/`end` mean logical
  inline-end, so both pairs mirror under RTL; pass `false` to unpin.
- `getProcessedRows()` returns a frozen readonly snapshot of matching sorted rows before paging;
  `getVisibleRows()` returns a frozen readonly snapshot of the current effective page.
- `getState()`, `setState(state)`, `resetState()`, and `resetColumns()` serialize or restore view
  state. `getState()` is detached, frozen, and JSON-safe (Set filter values become arrays). Unknown
  column ids are ignored. `resetState()` intentionally preserves selection, page, and page size.
- `handleColumnsChange()`, `handlePageChange()`, and `handleSearchTermChange()` are public handler
  seams used by the built-in controls.
- `reload()` forces the current server request.
- `scrollToIndex(index, options?: DataGridScrollOptions)` addresses a processed row, maps it through
  group/tree/detail display rows, and scrolls with `align: 'start' | 'center' | 'end'`. A row hidden
  in a collapsed branch is a no-op.

**Server mode:** `dataSource` receives `{ sort, filters, search, page, pageSize, signal }`. A newer
request aborts and supersedes the previous one; rejected requests keep prior rows and emit
`lr-data-error`. Filter/search requests use `filterDebounce`; sorting and paging load immediately.
For event-driven loading, set `server`, listen to the mirrored `request` event, and assign `data`,
`total`, and `loading` yourself. The redundant Lyra-only `lr-data-request` event was removed in
9.0.0; rename that listener to `request`. Each dispatch carries a fresh frozen detail that cannot
mutate the component or loader request.

**Keyboard:** headers and cells share one roving grid stop; the scrollable `body` is separately
focusable so keyboard users can pan overflowing content. Arrow keys traverse cells, Home/End
traverse a row, Ctrl+Home / Ctrl+End reach grid ends, PageUp/PageDown move a page, Enter
sorts/activates, Space selects, Shift+Arrow reorders a header, Alt+Arrow resizes from the header,
unmodified Left/Right adjusts a focused separator, Ctrl+A selects
the current page, Ctrl+C copies, and Shift+F10 requests a cell context menu. Inline-direction
movement swaps under RTL. Keyboard events from an interactive formatter descendant remain owned by
that descendant.

**Events:** `request`; `lr-cell-click` and cancelable `lr-cell-contextmenu` carry canonical
`rowKey`/`columnId` alongside the row, column, value, and display index (canceling the latter suppresses the
native menu); `lr-column-move`; `lr-column-pin`; `lr-column-resize` (`detail.finished` distinguishes
live and committed resize). `pointerup` commits a pointer drag. `pointercancel` or lost capture
restores the exact pre-gesture width state; after a live move it emits the restored width with
`finished: false`, and it never emits a canceled `finished: true` commit. `lr-column-visibility-change`;
`lr-data-error`;
`lr-filter-change`; `lr-page-change`; `lr-row-collapse`; `lr-row-expand`; `lr-group-collapse` and
`lr-group-expand` (frozen `{ key, columnId, value, rows }` snapshots); `lr-row-select` with
canonical `{ selectedRowKeys, selectedRows }` plus mirrored `selectedKeys`; row expand/collapse
details use canonical `rowKey` plus mirrored `key`;
`lr-sort-change`; `lr-copy` (frozen `{ ok: true, text }` after fulfillment); `lr-copy-error`
(frozen `{ ok: false, text, reason, error }` after failure); `lr-error` (compatibility failure
notification with no raw platform error text). Every library event bubbles and is composed; only `lr-cell-contextmenu` is
cancelable. Structured details and their owned collections are frozen. The toolbar search and active column-filter inputs re-dispatch `focus` and `blur` once
from the grid host as bubbling, composed native `FocusEvent`s, preserving `relatedTarget` so
delegated ancestors can observe editor entry and exit without crossing the shadow boundary.

**Slots:** `empty`, `loading`, `no-results`.

**CSS parts:** `body`, `cell`, `column-menu`, `column-menu-button`, `columns-menu`, `data-grid`,
`drag-ghost`, `ellipsis`, `empty`, `expand-button`, `filter-button`, `filter-panel`, `first-button`,
`first-icon`, `footer`, `footer-cell`, `footer-row`, `group-count`, `group-row`, `group-value`,
`header`, `header-cell`, `last-button`, `last-icon`, `live-region`, `loading-overlay`,
`next-button`, `next-icon`, `no-results`, `page`, `page-current`, `page-size`, `pager`,
`pager-button`, `pin-indicator`, `previous-button`, `previous-icon`,
`resize-handle`, `row`, `row-detail`, `search`, `select-all-checkbox`, `sort-indicator`,
`sort-number`, `table`, `toolbar`, `tree-limit`.

Each per-column disclosure opens an honestly named native-control `group`, not a false ARIA menu:
its buttons have localized pin-to-start, pin-to-end, and unpin names; its visibility toggle has one
native checkbox semantic owner; and `aria-controls` links trigger and group. The per-column group,
column-filter panel, and all-columns visibility group are mutually exclusive and use the shared
topmost overlay router, so Escape closes only the active disclosure and returns focus to its own
trigger. Resize separators are focusable and expose finite `aria-valuemin`, `aria-valuemax`, and
`aria-valuenow`; inverted bounds collapse to the minimum. Revoking resize/reorder capability during
a gesture rolls it back, and column drops require the current grid's owned drag token plus current
source/target capability.

The four pager navigation controls each wrap their glyph in an icon part — `first-icon`,
`previous-icon`, `next-icon`, `last-icon` — rendered as real chevron SVGs rather than literal
`«`/`‹`/`›`/`»` text, so they mirror under `dir="rtl"` instead of pointing the wrong way. `first-icon`
and `last-icon` hold two overlapping chevrons so the pair reads as one doubled glyph. This matches
`<lr-pagination>`'s identical treatment; style the glyph through the icon part and the control
through `first-button`/`previous-button`/`next-button`/`last-button` (or the shared `pager-button`).

`[part="live-region"]` is a visually-hidden, `aria-hidden` **mirror** of the last polite
announcement — a styling and inspection surface, with no live-region role of its own. The
announcement itself goes to the library's shared **light-DOM** polite region, appended to the
consumer's `<body>` and marked `data-lr-live-region="polite"`, because a live region inside a
shadow root is not reliably announced (JAWS with Firefox ignores one outright). Assert against that
document-level region rather than `::part(live-region)`; the part still tells you what the grid
last announced.

Declarative `loading` is silent on mount. Each later `false` → `true` transition appends the
localized loading text to that shared polite sink, including repeated loading cycles. The visible
`loading-overlay` is ordinary non-live content, and the grid exposes the state with `aria-busy`.

**Themeable custom properties:** `--accent-color`, `--background-color`, `--border-color`,
`--border-radius`, `--border-width`, `--cell-padding`, `--focus-ring`, `--header-background`,
`--header-row-height`, `--header-text-color`, `--indent-size`, `--max-height`, `--row-height`,
`--row-hover-background`, `--selected-background`, `--stripe-background`, `--text-color`, and
`--transition-duration`. Defaults resolve through Lyra design tokens. Set `--max-height: none` to
render every row instead of a virtual window. Three grid-specific hooks reach formatter and row
detail content inside the shadow root: `--lr-data-grid-cell-color` (default `inherit`) controls
body-cell text, `--lr-data-grid-cell-link-color` (default `var(--lr-color-brand)`) controls nested
anchors, and `--lr-data-grid-cell-link-hover-color` (default
`var(--lr-data-grid-cell-link-color, var(--lr-color-brand))`) controls those anchors on hover,
focus-visible, and active interaction. Set the link color to `revert` to restore the user-agent
default.

```html
<lr-data-grid
  label="Engineering roster"
  row-key="id"
  selectable
  with-search
  paginate
  page-size="20"
></lr-data-grid>
<script type="module">
  const grid = document.querySelector("lr-data-grid");
  grid.columns = [
    { field: "name", label: "Name", filterable: true },
    { field: "score", label: "Score", align: "end" },
  ];
  grid.data = [{ id: 1, name: "Ada", score: 97 }];
</script>
```

**Known gotchas:** selection and expansion are only stable across sort/filter/server page changes
when `rowKey` names a unique string/number field. CSV/copy uses a formatter only when it returns a
string; templates and Nodes fall back to the raw value. Server export/copy includes currently loaded
rows because the browser does not possess unloaded pages.

---

## `lr-table`

Sort/select-aware data table with a bounded 100-row default projection. A sortable header first
emits cancelable `lr-sort-request`; accepted transactions emit `lr-sort` with the same canonical
`sortKey`/`sortDir`. Client mode updates sort state and orders rows; server mode leaves sort state
controlled. Optional filtering, bounded pagination, and loading chrome are built in. A
`columns[].heatValue`-opted-in heat-tint mode paints a shared, normalized color-mix background across
every tinted cell (auto-derived domain, or overridden via `heatTintScale`); `rowTotal`/`grandTotal`
add a trailing totals column mirroring `expandedContent`'s leading one — `rowTotal(row)` renders
per-row, `grandTotal(rows)` renders at its intersection with the footer row — both sharing `footer`'s
own "consumer computes/renders" contract rather than assuming addition.

Header cells and body rows use separate roving tab stops. When a controlled `columns` or rendered
row collection changes while one of those stops owns focus, the table keeps the same stable key if
it survives and otherwise clamps focus to the nearest surviving index. Moving focus outside the
table before the update is applied always wins; nested editors and controls keep their independent
focus contracts.

**9.0 migration:** replace `selectedKey = key` with `selectedRowKeys = new Set([key])`; both single
and multiple modes now use that one store. Replace `columnsHidden` with read-only
`hasHiddenPriorityColumns`, `showAllColumns` with `priorityColumnsVisible`, and the two former
column-visibility events with `lr-priority-columns-visibility-change { visible }`. Column
`sticky: true` becomes `sticky: 'start'`; `editable: true` becomes
`editTrigger: 'double-click'`, and `editable: 'always'` becomes `editTrigger: 'always'`. Sort
listeners now receive phased readonly `{ phase, sortKey, sortDir }` details from
`lr-sort-request`/`lr-sort`. A bare table now projects 100 rows per page (with inputs bounded to
1..500); set an explicit finite `page-size` when a different window is required.

**Properties:**

- `columns: readonly TableColumn<T>[] = []` (attribute: false; clone-owned frozen collection,
  bounded to the first 10,000 source positions; blank keys and later duplicates are omitted first-wins
  before header, cell, sort, focus, and event paths; reassign to update) — `{ key, label,
headerCell?, width?, minWidth?, maxWidth?,
resizable?, sortable?, sortValue?, align?: 'start'|'end', priority?: 'medium'|'low',
sticky?: 'start'|'end', editTrigger?: 'double-click'|'always', footer?, cellStyle?, heatValue?,
cell: (row) => unknown }` —
  `sortValue(row) => string | number | null | undefined` supplies the comparable value backing
  client-mode sorting for that column: a finite number sorts numerically, a string sorts through an
  `Intl.Collator` built from the component's effective locale with `numeric: true` (so `item2`
  precedes `item10`), and `null`/`undefined`/non-finite sorts **last in both directions** so
  flipping `sortDir` never floats a block of blanks to the top. Omit it and the column sorts by its
  stringified `cell()` output instead — meaningful only when `cell()` returns a string or number, so
  define `sortValue` whenever `cell()` returns a template or element. Ignored under
  `sortMode="server"` and on a column that is not `sortable`;
  `priority` progressively hides that column via a `@container` query as `[part='base']` narrows
  (`'low'` hides first, under a ~900px container width; `'medium'` next, under ~640px; both
  breakpoints are fixed in `table.styles.ts`, not themeable tokens), reversible via
  `[part='reveal-columns-button']`; `sticky` pins that column's header/cells to the logical start or
  end edge while the table scrolls horizontally — multiple sticky columns stack
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
  no per-cell style override (the default, unchanged output);
  `editTrigger: 'double-click'` opens a native editor on that cell's double-click (one cell at a
  time), while `'always'` renders a persistent editor in every body cell from first paint, for a
  settings/rate-style column meant to be typed straight into — while `editValue` supplies the editor
  value and `editType` selects `text` or `number`
  `cellTitle(row) => string | undefined` is the `title` analogue of `cellStyle`, applied directly to
  the generated `<td>` — e.g. the untruncated text behind an ellipsized cell, or a formatted
  timestamp behind a relative one;
  `resizable` adds a focusable separator `[part='resize-handle']` and emits `lr-column-resize` with
  the live width in CSS pixels. Drag it, or use logical ArrowLeft/ArrowRight for 10px steps (mirrored
  under RTL), Shift+Arrow for 50px steps, Home for the minimum, and End for an explicit pixel
  `maxWidth`; explicit pixel `minWidth`/`maxWidth` values bound both input paths. The separator
  exposes its current/minimum/bounded-maximum pixel width through ARIA value attributes. Only the
  _commit_ is vetoable — see `lr-column-resize` under Events.
- **`cellStyle` beats `heatValue`, always.** `styleMap` writes an inline `style=` attribute, and an
  inline style outranks any stylesheet rule in the cascade regardless of specificity, while the heat
  tint is painted by a shadow-stylesheet rule. So a `cellStyle` returning
  `background`/`backgroundColor` on a column that also defines `heatValue` silently and completely
  erases that column's tint — no warning, and the cell still contributes to the shared domain, so the
  _other_ tinted columns' scale shifts around a cell that shows no tint at all. Define both on one
  column only when that override is the intent; to tint _and_ style, return only non-background
  declarations (`color`, `fontWeight`, `textAlign`, …) from `cellStyle`.
- `columns[].editTrigger: 'double-click' | 'always'` — `'double-click'` opens one transient editor;
  Enter commits and closes, Escape cancels and closes, and blur-after-change commits. `'always'`
  renders an editor in
  every body cell of that column, permanently:
  - **Focus model.** Each editor is a plain tab stop — no `tabindex` of its own — exactly like the
    existing row-expand toggle, and stays _outside_ the header/row roving-tabindex model. Tab walks
    down the column; arrow keys still navigate the grid from a row's own roving stop, and act as
    ordinary caret movement once focus is inside a field. Non-editable columns are unaffected.
  - **Value binding.** A persistent editor binds its `value` as a **content attribute**, not as the
    `.value` property, so native dirty-value-flag semantics apply. Trade-off: once the user has
    typed into a cell, an out-of-band `rows` update to that same cell will **not** visibly replace
    their draft. An editor the user has not touched still picks up a new `rows` value normally.
    `lr-cell-edit` remains the only mutation channel — the table never mutates `row`.
  - **Keys.** Enter commits (emits `lr-cell-edit`) and _keeps focus_ in the field, since there is no
    closed state to fall back to. `change` (blur after a modification) commits in both modes.
    Escape is **not** cancelled and does nothing to the editor — there is nothing to cancel back to
    — so an ancestor dialog/popover still acts on it.
  - **Focus across re-sorts and pagination.** Rows are keyed, so a re-sort _moves_ the editor's
    `<input>` (the typed value rides along) and the table restores focus to the same logical cell
    afterwards. If the focused row leaves the rendered page entirely (pagination, filtering), focus
    is simply lost rather than yanked to whichever unrelated row now sits in that position.
  - Each editor keeps its own interpolated `tableEditCell` accessible name (`Edit {column}`), so a
    column of otherwise-identical inputs is still individually named to a screen reader.
- `hasHiddenPriorityColumns: boolean = false` (attribute `has-hidden-priority-columns`, reflected) —
  computed/read-only and true only while a priority column is actually hidden. It becomes false
  when `priorityColumnsVisible` reveals the columns. Measured via a `ResizeObserver` on
  `[part='base']` plus a post-render DOM check, so it settles one render cycle after a `columns`/
  `rows`/width change lands — poll for the settled value (e.g. `await el.updateComplete;` twice, or
  `waitUntil()`) rather than assuming a single `updateComplete` covers it. Setting it directly has no
  lasting effect; it is recomputed on the next render or resize. The toggle remains available while
  a narrow table is revealed, even though this property truthfully reports false
- `rows: readonly T[] = []` (attribute: false; clone-owned frozen collection bounded to the first
  10,000 rows; reassign to update). Records are retained
  here; one canonical `rowKey` projection omits blank and later-duplicate identities first-wins
  before filtering, counts, pagination, focus, actions, and events
- `layout: 'auto'|'fixed' = 'auto'` (reflected) — a **floor** on the `<table>`'s `table-layout`, not
  an override. `'fixed'` forces the fixed algorithm even when no column declares a `width`, so every
  column shares the available width evenly and long cell content is clipped/wrapped instead of
  stretching its column. The default `'auto'` still _resolves_ to `fixed` whenever a column declares
  a `width`, a column has been drag-resized, or a resize gesture is in flight — column resizing does
  not work under `table-layout: auto`, so `'auto'` can never mean "never fixed". See the gotchas for
  the two consequences of the fixed algorithm worth knowing before opting in
- `sortKey: string = ''` (attribute `sort-key`)
- `sortDir: 'asc'|'desc' = 'asc'` (attribute `sort-dir`)
- `sortMode: 'client'|'server' = 'client'` (attribute `sort-mode`, reflected) — mirrors
  `paginationMode`'s identical split. `'client'` (the default) orders `rows` in the browser from
  `sortKey`/`sortDir` and the active column's `sortValue`; `'server'` renders `rows` exactly as
  given, for a table whose ordering already happened server-side. Accepted header activation emits
  `lr-sort` under both modes, but only client mode mutates `sortKey`/`sortDir`. With no `sortKey` set
  (the default) `'client'` is a **no-op** — the
  input order is preserved verbatim — so a table that never sorts renders identically either way.
  Sorting applies to the whole filtered set _before_ client pagination slices the page, so page 1
  holds the globally-smallest rows rather than a re-sorted slice
- `defaultSortDir: 'asc'|'desc' = 'asc'` (attribute `default-sort-dir`) — the direction applied
  whenever header activation switches sorting to a **different** column, including the first column
  ever sorted. Re-activating the column that is already `sortKey` toggles between `'asc'` and
  `'desc'` instead, so `defaultSortDir` never overrides a direction the user just chose for the
  column they are still on. Set `'desc'` for a most-recent-first or highest-first table
- `rowKey?: (row: T) => string | number` (attribute: false) — derives each row's stable identity for
  DOM-reconciliation and the delegated row click/keydown lookup; falls back to the row's array index
  when omitted, which is only safe while `rows` never reorders — set it whenever `rows` can be
  sorted/filtered/re-ordered across renders, or selection/click can silently attach to the wrong
  row. Empty string identities and later duplicates are omitted; the first valid occurrence wins
- `selectionMode: 'none'|'single'|'multiple' = 'none'` (attribute `selection-mode`, reflected) —
  opt-in self-managed row selection; the default remains presentational
- `selectedRowKeys: ReadonlySet<string | number> = new Set()` (attribute: false) — the single selection
  store in every mode, bounded to 10,000 keys. Single mode enforces at most one key; multiple mode
  toggles membership. Malformed and whitespace-only string keys are omitted, while valid
  unmatched/off-page keys remain controlled state for server pagination. Reads return immutable detached `ReadonlySet`
  facades; reassign a new set to update
- `filterable: boolean = false` (attribute `filterable`, reflected) — renders a localized search
  field above the grid
- `filterText: string = ''` (attribute `filter-text`) — controlled filter text
- `filter?: (row: T, text: string) => boolean` (attribute: false) — typed predicate used by the
  filter field; when omitted, rows are matched against their JSON representation
- `filterLabel?: string` (attribute `filter-label`) and `filterPlaceholder?: string`
  (attribute `filter-placeholder`) — omission localizes `tableFilterLabel`/
  `tableFilterPlaceholder`; any supplied string, including the built-in English text or `''`, is
  an explicit verbatim override
- `spellcheck: boolean = true`, `autocapitalize: string = ''`, `autoCorrect: string = ''`
  (attribute `autocorrect`) — forwarded to the filter input and, for a `'text'` (the default)
  `editType`, the inline cell editor; no effect on a `'number'` cell editor. `spellcheck="false"`
  is parsed as `false` via a string-aware converter (Lit's default presence-based boolean
  converter would otherwise treat any attribute value, including the literal string `"false"`, as
  `true`).
- `loading: boolean = false` (attribute `loading`, reflected) and `loadingLabel?: string`
  (attribute `loading-label`) — renders busy chrome and suppresses the real rows while loading;
  omission localizes `tableLoading`, while a supplied string (including `''`) renders verbatim
- `loadingAppearance: 'spinner'|'skeleton' = 'spinner'` (attribute `loading-appearance`, reflected) —
  how `loading` renders. `'spinner'` replaces the whole grid with an indeterminate spinner.
  `'skeleton'` instead renders the real table — the same `<colgroup>` (declared _and_ drag-resized
  widths included), the same `<thead>`, the filter field and the pagination footer — and fills
  `<tbody>` with placeholder rows, so a cold load sketches the grid's shape rather than collapsing to
  a spinner and reflowing when the rows land. Kept as a separate property rather than widening
  `loading` to a string union, so `?loading=${…}` bindings and `el.loading === true` checks keep
  working. Loading takes precedence over both empty branches. When `columns` is empty, a skeleton
  request temporarily falls back to the spinner because there is no schema to sketch; the table
  does not flash its no-columns empty state while `loading` remains true
- `skeletonRows: number = 0` (attribute `skeleton-rows`) — placeholder row count under
  `loadingAppearance="skeleton"`. `0` renders 3 placeholders for the ordinary bounded default, or
  derives a non-default explicit `pageSize` (capped at 20). Positive explicit values are also capped
  at 20. Ignored entirely under the default spinner appearance
- `pageSize: number = 100` (attribute `page-size`) — normalized to `1..500`; a bare table therefore
  never mounts an unbounded row-by-column projection
- `page: number = 1` (attribute `page`, reflected) — self-managed after accepted client pagination;
  controlled in server mode
- `totalItems: number = -1` (attribute `total-items`) — server-side total item count; `-1` derives
  the total from filtered rows
- `paginationMode: 'client'|'server' = 'client'` (attribute `pagination-mode`, reflected) — client
  mode slices rows and updates `page`; server mode leaves `page` controlled and bounds the supplied
  page to `pageSize`
- Editable columns emit `lr-cell-edit` on commit and never mutate the supplied row object.
- `groupBy?: (row: T) => string | number` (attribute: false) — inserts a non-focusable full-width
  group row wherever this key changes between consecutive rendered rows. Supply `rows` with each
  group already contiguous; the table renders the groups in their first-appearance order in `rows`
  and never reorders them. A client-mode sort is applied **within** each group, so sorting a
  grouped table on a column unrelated to the group key reorders rows inside their groups and
  leaves the grouping intact. The one exception: when the sorted column's value is constant inside
  every group — the group column itself, most obviously — there is nothing to reorder within a
  group, so the **groups** are ordered by that value instead.
- `groupLabel?: (key: string | number, rows: readonly T[]) => unknown` (attribute: false) — custom group
  header content; without it, the group key is rendered as text
- `expandedContent?: (row: T) => unknown` (attribute: false) — enables a leading expand toggle and
  renders a full-width detail row beneath expanded records. The returned content renders inside
  the component's shadow root, behind the `expanded-cell` part — page CSS cannot reach it, and
  `::part(expanded-cell)` only reaches the wrapping `<td>` itself, not the descendants this
  callback returns (the same `::part()` limitation a column's `cell(row)` anchors run into, see
  `--lr-table-cell-link-color` below). Style such content by returning already-styled elements —
  inline `style`, or elements that reference this table's own `--lr-*` design tokens, which
  inherit across the shadow boundary like any custom property
- `canExpand?: (row: T) => boolean` (attribute: false) — optional per-row gate for expansion
- `expandedRowKeys: ReadonlySet<string | number> = new Set()` (attribute: false) — consumer-controlled
  expanded state bounded to 10,000 keys; malformed and whitespace-only string keys are omitted while valid
  off-page keys remain controlled; reads return immutable detached `ReadonlySet` facades, and
  consumers reassign it after
  `lr-row-expand-toggle`
- `hasMore: boolean = false` (attribute `has-more`, reflected)
- `moreLabel?: string` (attribute `more-label`) — omission renders localized `loadMore` (`'Load more'` in the built-in English catalog); a supplied string, including `''`, renders verbatim
- `emptyHeading?: string` (attribute `empty-heading`) — omission renders localized `noData` (`'No data'` in the built-in English catalog); a supplied string, including `''`, renders verbatim
- `emptyDescription: string = ''` (attribute `empty-description`)
- `noColumnsHeading?: string` (attribute `no-columns-heading`) — omission renders localized `noColumns` (`'No columns configured'` in the built-in English catalog); a supplied string,
  including `''`, renders verbatim
- `noColumnsDescription: string = ''` (attribute `no-columns-description`)
- `emptyCompact?: boolean` (attribute `empty-compact`) — overrides the built-in `[part='empty']`
  state's `compact` rendering. Tri-state: leave it `undefined` (the default) to keep each empty
  branch's own built-in default — the two shadow-root-level branches (no columns, no rows) render
  spacious, while the filtered-to-zero branch, which sits inside `[part='base']` alongside the filter
  field, renders compact. `empty-compact="false"` forces the spacious rendering everywhere, and is
  parsed as `false` rather than as mere attribute presence. Has no effect once the `empty` slot is
  filled
- `revealColumnsLabel?: string` (attribute `reveal-columns-label`) — the reveal button's label
  while `priority`-hidden columns are hidden; omission renders localized
  `showAllColumns` (`'Show all columns'` in the built-in English catalog), while a supplied string (including `''`) is verbatim
- `hideColumnsLabel?: string` (attribute `hide-columns-label`) — the same button's label once
  the columns have been revealed; omission renders localized `showFewerColumns` (`'Show fewer columns'` in the built-in English catalog), while a supplied string (including `''`) is verbatim
- `priorityColumnsVisible: boolean = false` (attribute `priority-columns-visible`, reflected) —
  forces responsive priority columns visible and is updated by the built-in reveal button
- `storageKey?: string` (attribute `storage-key`) — when set, persists `priorityColumnsVisible` to
  `localStorage` (namespaced as `lr-table:${storageKey}`) and restores it on the next mount. Unset
  (the default) touches storage not at all. Mirrors `lr-app-rail`'s identical `storage-key` pattern
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
- `grandTotal?: (rows: readonly T[]) => unknown` (attribute: false) — renders the bottom-right cell (row-total
  column × footer row). Only rendered when both `rowTotal` is set **and** at least one column defines
  `footer` — otherwise there is no footer row for it to occupy, and this renders nothing

**Events:** `lr-sort-request` (cancelable frozen readonly
`detail: { phase: 'request', sortKey, sortDir }`) precedes `lr-sort` (frozen readonly
`detail: { phase: 'commit', sortKey, sortDir }`) only when accepted. Client mode also updates its
sort properties; server mode leaves them controlled. Other events are `lr-row-click`
(`detail: { row }`), `lr-load-more` (fired on the "load more" button),
`lr-priority-columns-visibility-change` (frozen readonly `detail: { visible }`), and `lr-row-expand-toggle`
(`detail: { row, rowKey }`; the table does not mutate `expandedRowKeys`), and
`lr-selection-change` (frozen readonly `detail: { rowKeys }`, not cancelable) when selection is
enabled — fired both from a row activation and from a `selectionMode` flip to `'single'` that coerces
an existing multi-row selection down to one key (skipped on the very first render, since an
already-inconsistent initial `selectionMode`/`selectedRowKeys` pairing is a starting state, not a
live transition), `lr-filter-change`
(frozen readonly `detail: { text }`), and `lr-page-change` (frozen readonly `detail: { page }`) from the
filter/pagination surfaces, and `lr-cell-edit` (`detail: { row, columnKey, value }`) for editable
columns, and `lr-column-resize` (`detail: { columnKey, width }`, `width` in CSS pixels) on every pointer or
keyboard resize step. **Only the commit is cancelable.** A pointer drag fires the event once per
pixel of movement as non-cancelable live feedback, then exactly once more — `cancelable: true` — for
the width committed at drag-end (and only when that width actually differs from the pre-drag one).
A keyboard step (Arrow/Shift+Arrow/Home/End) is already one discrete action, so it fires that single
cancelable commit directly, with no live-feedback stream. Calling `preventDefault()` on a cancelable
emission reverts the column to its pre-gesture width (or removes the override entirely if the column
had never been resized); calling it on a mid-drag step does nothing, by design — a veto is a decision
about the final width, not about every pixel the pointer passes through.
The internal filter input's composed native `input`/`change` events are contained; only
`lr-filter-change` crosses the host boundary. Cell-editor `input`/`change` events are likewise
contained while an accepted edit publishes `lr-cell-edit`. Internal filter/cell-editor native
`focus` and `blur` are re-dispatched from the host as bubbling, composed events (the native ones
are neither).

**Slots:** `empty` — replaces the built-in empty state on the two _data_-empty branches (no rows at
all, and filtered/paginated down to zero). Left unfilled, the built-in `[part='empty']` `<lr-empty>`
renders as this slot's fallback content. The no-columns branch is deliberately **not**
slot-replaceable: it reports a configuration problem (`noColumnsHeading`), not "this query returned
nothing", and one slot covering all three would collapse that distinction. Everything else comes
from `columns`/`rows`.

**CSS parts:** `base`, `table`, `caption`, `head`, `header-cell`, `row`, `cell`, `more-button`, `sort-icon` (a
chevron indicator shown on the active sortable header, rotated per `sortDir`), `reveal-columns-button`
(shown when priority columns are hidden or when a narrow allocation is currently force-visible),
`foot` (the `<tfoot>`, only rendered when at least one
column defines `footer`), `footer-row`, `footer-cell`, `row-total-cell` (each body row's trailing
`<td>` holding `rowTotal(row)`, rendered only when `rowTotal` is set — the corresponding footer-row
cell, holding `grandTotal`, is a `footer-cell` instead, matching every other footer cell),
`expand-toggle-cell`, `row-expand-toggle`,
`row-expand-icon`, `expanded-row`, `expanded-cell`, `filter-label`, `filter`, `loading` (under
`loadingAppearance="spinner"` the visible block holding the spinner; under `"skeleton"` the
visually-hidden, `aria-hidden` announcement mirror, since the placeholder rows are the visible
affordance; the part has no live-region role in either appearance),
`skeleton` (each canonical `shape="rect"` `<lr-skeleton>` placeholder inside a skeleton-mode body cell — the placeholder rows
and cells reuse the ordinary `row`/`cell`/`row-total-cell` parts, which is exactly what keeps them
geometrically identical to real rows, so `skeleton` is the part to target for the placeholder's own
look: `::part(skeleton) { --lr-skeleton-h: 2em; }`), and
`pagination`, `cell-editor`, `group-row`, `group-cell`, and `resize-handle` (the focusable column
separator, with a finite explicit ARIA maximum even when no CSS `maxWidth` was supplied). The built-in empty state is addressable rather than fixed: `empty` is the `<lr-empty>`
host in all three empty states, and it re-exports that element's own inner parts as `empty-base`,
`empty-icon`, `empty-heading`, `empty-description` and `empty-actions`. Note that the no-columns and
no-rows states return the empty element as the shadow root's own root, with no `[part='base']`
wrapper around it — `::part(base)` does not apply in those two states, only in the filtered-to-zero
one — and that `empty` disappears entirely once the `empty` slot is filled.

- `scrollMode: 'self' | 'page' | 'auto' = 'self'` (attribute `scroll-mode`, reflected) — which element
  scrolls when the table overflows. `'self'` makes `[part="base"]` the scroll container, which is
  what pairs with `--lr-table-max-height` and makes the sticky header pin inside the table's own
  viewport. `'page'` hands scrolling back to the document. Needed because a scroll container clips
  **both** axes — CSS offers no way to scroll one and not the other — so an *uncapped* table that is
  still `overflow: auto` becomes a sticky containing block that never scrolls, and its header
  scrolls away with the page. With `'page'` the header's nearest scrollport is the page, so it pins
  there; the cost is that a table wider than its host overflows the page instead of scrolling
  inside itself. The opt-in `'auto'` mode resolves between those two behaviors from the rendered
  allocation: while content fits it uses page flow, and only while content actually overflows
  horizontally does `[part="base"]` become the contained scrollport. It re-evaluates when either
  the allocated width or the rendered table's intrinsic width changes, so the same table can flow
  with a desktop page and contain itself in a 320px panel. The default remains `'self'`. Named
  `scrollMode` rather than `scroll` because a `scroll` property would shadow `Element.prototype.scroll()`

**Themeable custom properties:** `--lr-table-cell-color` (default `inherit`),
`--lr-table-cell-link-color` (default `var(--lr-color-brand)`) and
`--lr-table-cell-link-hover-color` — an anchor returned from a column's `cell(row)` renders inside
the component's shadow root, where page CSS cannot reach it and `::part()` cannot select past the
first compound selector to reach it either, so without these it computes to the UA default link
blue; set `revert` for the UA default. `--lr-table-max-height` (default `none`; controls the scrollable
body's `max-block-size`). `--lr-table-heat-tint-lo` (default `var(--lr-color-brand-quiet)`) and
`--lr-table-heat-tint-hi` (default `var(--lr-color-brand)`) — the `color-mix()` ramp endpoints
for heat-tint mode's per-cell background, consulted only on columns/rows that define `heatValue`;
`--lr-table-resize-min-width` (default `var(--lr-size-3rem)`) and
`--lr-table-resize-handle-opacity` (default `0.12`) control resizable-column behavior. The latter
remains the legacy shared opacity fallback; `--lr-table-resize-handle-hover-bg` (default
`var(--lr-color-brand)`), `--lr-table-resize-handle-hover-opacity` (defaulting to the legacy
opacity), `--lr-table-resize-handle-active-bg` (defaulting to the hover background), and
`--lr-table-resize-handle-active-opacity` (defaulting to twice the hover opacity) independently
retune the rendered interaction states. These heat-tint/resize hooks are not redeclared on the component host: set them on
`lr-table` or on a theme ancestor, and a table-level value wins through the normal cascade.
`--lr-table-row-selected-bg` (default `var(--lr-color-brand-quiet)`) — the background of a row whose
`aria-selected` is `true`. Like every state-scoped custom property in this library it is an inline
`var()` fallback at its point of use and is **not** declared on `:host`, so it can be set on the
element _or on any ancestor_ and still reach the rule that reads it. It exists because Shadow Parts
forbids an attribute selector after `::part()` — `::part(row)[aria-selected='true']` is invalid CSS —
so the only prior lever for restyling the selected row was overriding the library-wide
`--lr-color-brand-quiet` token, which repaints everything else reading it.
`--lr-table-row-stripe-bg` (default `transparent`) — the background of alternating body rows. The
component marks the alternating rows itself, so this works without an invalid `::part(row)` attribute
or structural-pseudo-class selector and does not affect group, expanded, hover, or selected rows.
`--lr-table-header-sorted-bg` (default `var(--lr-color-surface)`) and `--lr-table-header-sorted-color` (default
`inherit`) restyle the **currently-sorted** column's header cell (`[aria-sort]` other than `none`). The opaque surface default prevents body rows from
showing through the sticky header while it scrolls.
Same shape and rationale as `--lr-table-row-selected-bg`: inline `var()` fallbacks, not on `:host`,
because `::part(header-cell)[aria-sort]` is invalid CSS. The `sort-icon` part styles only the
chevron; these tokens style the header cell itself.
`--lr-table-sticky-offset` (default `0`) is measured and written inline per column by the component
so multiple `sticky` columns stack instead of overlapping; it is a read-out, not a knob you set.
`--lr-table-heat-t` is likewise component-written (each `[data-heat]` cell's position on the ramp).

**Optional peer deps:** none.

```html
<lr-table
  id="t"
  sort-key="name"
  sort-dir="asc"
  accessible-label="Items"
></lr-table>
<script type="module">
  const t = document.getElementById("t");
  t.columns = [
    { key: "name", label: "Name", sortable: true, cell: (r) => r.name },
    // sortValue keeps the numeric column comparing as numbers, not as strings.
    {
      key: "value",
      label: "Value",
      align: "end",
      sortable: true,
      sortValue: (r) => r.value,
      cell: (r) => r.value,
    },
  ];
  t.rows = [
    { name: "Alpha", value: 1 },
    { name: "Beta", value: 2 },
  ];
  t.rowKey = (r) => r.name;
  t.addEventListener("lr-sort-request", (e) => {
    console.log("sort proposed", e.detail.sortKey, e.detail.sortDir);
    // Call e.preventDefault() here to veto the transaction.
  });
  t.addEventListener("lr-sort", (e) =>
    console.log("sort committed", e.detail.sortKey, e.detail.sortDir)
  );
  t.addEventListener("lr-row-click", (e) =>
    console.log("clicked", e.detail.row)
  );
</script>
```

**Known gotchas:**

- accepted sortable-header activation writes `sortKey`/`sortDir` only in client mode. Server mode
  keeps those properties controlled and reports the accepted proposal in `lr-sort`; veto
  `lr-sort-request` to suppress both state change and commit. The built-in transaction toggles only
  between two directions, so a tri-state header (asc → desc → unsorted) remains consumer-owned.
- `sortValue`/`cell` are read off the column object by identity. Mutating a column **in place**
  (`t.columns[0].sortValue = …`) neither re-renders nor re-sorts; assign a new `columns` array.
- `groupBy` + client sorting are **not** in conflict: the sort runs per group, not across the whole
  set, so group rows stay contiguous. The consequence is that the group order is normally yours to
  control — it follows first appearance in `rows`. The single exception is a sort on a column whose
  value is constant inside every group (the group column itself, a column functionally determined
  by the group key, or any column at all when every group holds one row): the within-group sort
  would be a provable no-op, so the groups are ordered by that constant value instead. That is what
  keeps `aria-sort` and the header chevron honest — otherwise clicking the group column would flip
  both while changing nothing. To force a group order in any other case, sort `rows` into it before
  assigning them (or set `sort-mode="server"` and own the whole ordering).
- both single and multiple row selection use `selectedRowKeys`; the component does not synthesize a
  checkbox column, so a bulk-select UI still belongs in `headerCell()`/`cell()` callbacks.
- `accessibleLabel?: string` (attribute `accessible-label`) — a typed accessible name for the
  `<table role="grid">`. Omitting it reads back `undefined`; a plain `aria-label` HTML attribute on
  the host is then forwarded instead (read via `this.getAttribute('aria-label')` at render time). An
  explicitly empty string is a real override — it renders `aria-label=""` rather than falling back to
  the host attribute. Consumer-supplied text, so neither is run through `this.localize()`.
- `caption: string = ''` — an optional visible `<caption>` (exposed as the `caption` CSS part). When
  no `accessibleLabel`/host `aria-label` is present the caption also names the grid via
  `aria-labelledby`.
- A grid with **none** of `accessibleLabel`, host `aria-label`, or `caption` logs a one-time
  `console.warn` on first render in development builds only — an unnamed grid is an accessibility
  defect that otherwise renders silently. Production and unknown/unbundled runtimes do not log it.
- Full roving-tabindex grid keyboard pattern (one `tabindex="0"` stop among header cells, one among
  body rows) — Left/Right/Home/End move within the header row, Up/Down/Home/End move within the
  body, Down from the header enters the body's roving stop and Up from the body's first row returns
  to the header, Enter/Space still only sort/activate — a genuine strength versus most siblings in
  this family. A `priority`-hidden header/cell is skipped when computing the visible header stops,
  so arrow-key navigation never strands the roving stop on a hidden column.
- a `cell()` template can render its own interactive content without it being swallowed by
  row/column activation. Delegated clicks and Enter/Space inspect the event's composed path for
  native buttons, links, inputs, selects, textareas, summaries, and media with controls;
  editable content; a non-negative `tabindex`; or role semantics (`button`, `checkbox`, `combobox`,
  `listbox`, `menu`, `menuitem`, `option`, `radio`, `separator`, `slider`, `spinbutton`, `switch`,
  `tab`, or `textbox`). Open-shadow custom controls expose those semantics through the composed path
  and therefore keep their own action. A passive custom element — including a formatter or
  display-only badge — remains part of the row activation surface instead of creating a dead zone
  merely because its tag contains a hyphen. An opaque closed-shadow control can explicitly opt out
  of row activation by adding `data-table-interactive` to its visible host.
- `layout="fixed"` (and any `'auto'` that resolves to fixed) carries two consequences of the CSS
  fixed algorithm. With no declared widths the **first** row — the header row included — determines
  every column's width, so revealing a `priority`-hidden column via
  `[part='reveal-columns-button']` re-measures and changes _all_ of them, not just the revealed one.
  And `columns[].minWidth`/`maxWidth` are silently ignored by `table-layout: fixed`; declare `width`
  instead when a specific column needs a specific size.
- skeleton mode keeps geometry stable only when the browser isn't sizing columns from cell content.
  Under the default `table-layout: auto`, placeholder cells have no intrinsic width, so the columns
  re-measure when real content arrives — exactly as they do between any two different data sets. For
  pixel-identical widths across the load, declare `columns[].width` or set `layout="fixed"`.
  Initial declarative loading stays silent; every later transition into either loading appearance
  appends the localized loading text to the document's shared light-DOM polite sink, including
  repeated cycles. `[part="base"]` exposes `aria-busy`, `[part="loading"]` is an `aria-hidden`
  mirror rather than a live region, and every placeholder opts out of `<lr-skeleton>`'s own
  announcement, so a skeleton table never announces once per placeholder row.
- `columns[].cellTitle` returning an empty string **or** `undefined` omits the `title` attribute
  entirely rather than rendering `title=""` — an empty `title` would suppress an ancestor element's
  own tooltip. The attribute is also suppressed while that cell is in inline-edit mode, so the
  tooltip can't shadow the editor. Accessibility caveat: some screen readers announce a `<td title>`
  as the cell's accessible _name_, replacing the cell's content rather than supplementing it (the
  same caveat `lr-stat`'s `exactValue` carries). Use it for a longer form of what the cell already
  shows, never for information that exists nowhere else.
- `editTrigger: 'always'` deliberately does not re-assert a cell's source value once the user has typed
  into it. That is the native dirty-value-flag behavior the attribute binding buys, and it is the
  point: a background `rows` refresh cannot silently overwrite an in-progress edit. If you need the
  opposite — an authoritative external value that always wins — do not use `'always'`; re-key the
  row (`rowKey`) so the editor is recreated rather than updated, or use `editTrigger: 'double-click'` and let
  the short-lived double-click editor's property binding re-assert. Also note the two things
  `'always'` intentionally does _not_ do: it never sets the roving `tabindex` (its editors are
  ordinary tab stops, so Tab order in that column interleaves with the grid's two roving stops,
  the same way the row-expand toggle's already does), and it never cancels Escape.

---

## `lr-pagination`

Controlled page navigation for server-side or client-side data sets: a numbered page list with
elided runs, previous/next and optional first/last buttons, an opt-in localized item-range summary,
a compact layout that swaps the list for a validated numeric page jump, and a polite announcement
after the host applies a requested page. The component owns no data fetching and never mutates
`page`.

**9.0.0 migration:** remove reads of `pageCount` and use the required mirrored `totalPages` getter.
There is no alias or compatibility shim; keeping both names made one derived total look like two
independent concepts.

**8.0.0 migration — these changes are breaking:**

- `total-items` is now `total` (property `totalItems` → `total`). The old attribute no longer binds
  to anything: a pager left on `total-items` keeps `total` at its `0` default and silently renders
  the empty state with every control disabled.
- `hide-summary` is now `with-summary`, which **inverts the default**. The summary used to render
  unless you opted out; it is now hidden unless you opt in. Drop `hide-summary` wherever it appears,
  and add `with-summary` to every pager that was relying on the old show-by-default behavior.
- `pageSize` now defaults to `10` instead of `20`, matching the mirrored pagination contract. Keep
  `page-size="20"` explicitly wherever the old twenty-item window is part of the data request.
- `lr-page-change.detail` now includes `pageSize` as well as `page`, and the new cancelable
  `lr-before-page-change` fires first. Existing readers of `detail.page` keep working; code that
  asserted the exact one-key detail object must accept `{ page, pageSize }`.

**Properties and getters:**

- `page: number = 1` (reflected) — the currently applied page. Runtime values are presented within
  the valid `1..totalPages` range, but the public property itself remains controlled and is not
  rewritten by the component
- `pageSize: number = 10` (attribute `page-size`) — items per page; finite values are truncated to
  a non-negative integer for the derived calculations, and zero produces no pages
- `total: number = 0` (attribute `total`) — total item count; finite values are truncated
  to a non-negative integer for display and page-count calculations
- `totalPages: number` (readonly getter) — `ceil(total / pageSize)` after the normalization above,
  or `0` when either normalized input is zero
- `disabled: boolean = false` (reflected)
- `loading: boolean = false` (reflected) — disables all controls and sets `aria-busy="true"` on the
  internal navigation landmark
- `withSummary: boolean = false` (attribute `with-summary`, reflected) — renders the built-in range
  summary while retaining the controls. Opt-in since 8.0.0; see the rename note above
- `size: '2xs'|'xs'|'s'|'m'|'l'|'xl' = 'm'` (reflected) — control footprint, on the library's shared
  six-step ladder: `--lr-pagination-control-size` and `--lr-pagination-font-size` read the same
  `--lr-form-control-height`/`--lr-form-control-font-size` knobs `lr-button`/`lr-input`/`lr-select`
  sit on, so a pager in a toolbar row lines up with its neighbours at every tier.
  `'small'`/`'medium'`/`'large'` are accepted as exact synonyms of `'s'`/`'m'`/`'l'` — no attribute
  rewrite when migrating from an upstream that spells them that way
- `format: 'standard'|'compact' = 'standard'` (reflected) — `standard` renders the numbered page
  list; `compact` replaces it with the single page-jump input and a `/ totalPages` readout, for a
  toolbar or card footer. Previous/next and the `with-edges` buttons render in both. Foreign
  runtime values normalize to `standard`
- `siblingCount: number = 2` (attribute `sibling-count`) — pages shown either side of the current
  page in the numbered list. Read as a non-negative integer clamped to `0..25`; non-finite input
  falls back to `2`
- `boundaryCount: number = 1` (attribute `boundary-count`) — pages always pinned at the start and
  the end of the numbered list. Same normalization, fallback `1`
- `withEdges: boolean = false` (attribute `with-edges`, reflected) — adds first-page and last-page
  buttons outside previous/next, each drawn with a doubled chevron
- `withoutNav: boolean = false` (attribute `without-nav`, reflected) — omits previous/next while
  retaining numbered pages and any `with-edges` first/last controls
- `hideSinglePage: boolean = false` (attribute `hide-single-page`, reflected) — renders nothing when
  the normalized data set has zero or one page
- `hrefTemplate: string | ((page: number) => string) = ''` (attribute `href-template`) — renders
  every navigation target outside the compact field as an `<a>` instead of a `<button>`, so the
  pager works before hydration and for crawlers. Standard layout includes numbered pages and
  interactive ellipses; compact layout retains link-mode previous/next and optional first/last
  controls around its controlled page field. A string uses `{page}` as the placeholder
  (`/products?page={page}`); a function receives the page number and returns the URL and can only be
  assigned from JavaScript
- `appearance: 'accent'|'filled'|'outlined'|'filled-outlined'|'plain' = 'outlined'` (reflected) —
  the resting fill and border of the first/previous/next/last buttons and the numbered pages (not the
  compact page-jump input), applied through the two custom properties below. The applied page stays a
  solid brand chip in all five, so the appearance never decides whether the current page is
  identifiable
- `itemLabel: string = ''` (attribute `item-label`) — custom item noun used in the summary; empty
  selects the localized singular `item` or plural `items` key
- `accessibleLabel: string | null = null` (attribute `aria-label`) — host accessible-name override
  forwarded to the internal `<nav>` landmark; takes precedence over `label`
- `label?: string` — explicit fallback accessible name for the internal `<nav>` landmark, applied
  when no host `aria-label` is set; omitting it reads back `undefined` and localizes the
  `paginationLabel` message, while an explicit empty string renders no visible/accessible label
- `pageLabel?: string` (attribute `page-label`) — optional accessible-name override for the page-jump input
- `previousLabel?: string` (attribute `previous-label`), `nextLabel?: string`
  (attribute `next-label`) — optional accessible-name overrides for the icon-only directional buttons
- `firstLabel?: string` (attribute `first-label`), `lastLabel?: string`
  (attribute `last-label`) —
  optional accessible-name overrides for the icon-only edge buttons rendered by
  `with-edges`

Omitting any of those five control-label properties resolves the matching locale message. Any
supplied string is an explicit per-instance override and renders verbatim, including the built-in
English wording under a non-English `.strings` catalog and an empty string.

**Events:** `lr-before-page-change` (frozen readonly `detail: { page: number, pageSize: number }`, bubbles and
composes, cancelable) fires first for any valid, different requested page. Preventing it suppresses
the request and restores the compact field to the controlled page. If accepted,
`lr-page-change` follows with the same frozen detail (bubbles and composes, non-cancelable), from a numbered
page, interactive ellipsis, previous/next, first/last, or the compact page-jump input. The host
applies `event.detail.page` back to `page` after routing, fetching, or any other policy decision.
When that requested value is applied, focus follows the new `[part="page-current"]` control; the
compact layout returns focus to its page field instead. This keeps keyboard orientation intact even
when a next/previous, edge, or ellipsis control is replaced by the newly rendered page window. If
the application applies the controlled page asynchronously and the user has moved focus outside
the pagination component in the meantime, it leaves that newer focus destination alone.
`focus` and `blur` are re-dispatched as exactly one bubbling, composed native `FocusEvent` from
whichever internal control the user reached — a page button or link, previous/next, first/last, or
the page input. The shadow-origin event is stopped, and the host event preserves its native focus
payload, including `relatedTarget`.

**Methods:** `focus(options?)`, `blur()` and `click()` resolve the primary control for the active
format at call time: the applied `[part="page-current"]` button/link in `standard`, or the
`[part="page-input"]` page-jump input in `compact`. `click()` additionally does nothing while the
controls are disabled.

**Slots:** `first-icon`, `previous-icon`, `next-icon`, and `last-icon` replace the corresponding
directional glyph while leaving its localized accessible name on the owning control.

**CSS parts:** `base` and `pagination` are aliases on the same navigation wrapper; `summary`,
`controls`, `pages`, `button`, `page`, `page-current`, `ellipsis`,
`first-button`, `first-icon`, `previous-button`, `previous-icon`, `page-field`, `label`, `page-input`,
`page-count`, `next-button`, `next-icon`, `last-button`, `last-icon`, `live-region`.

`pages` is the `role="list"` wrapper, `page` one numbered control inside it (a `<button>`, or an
`<a>` under `href-template`), and `ellipsis` an accessible interactive control that jumps several
pages into its skipped run. `button` is shared by every page, ellipsis, and navigation control;
`label` aliases the compact `page-field` wrapper. The applied page's control carries a second part token, so
`::part(page-current)` selects it and `::part(page)` still selects every page including the current
one — the state lives in the part name because `::part(page)[aria-current='page']` is invalid CSS
and would silently never match. `first-button`/`first-icon` and `last-button`/`last-icon` exist only
while `with-edges` is set.

`live-region` is a visually hidden, `aria-hidden` **mirror** of the applied-page announcement — a
styling and inspection surface, with no live-region role of its own. The announcement itself goes
to the library's shared **light-DOM** polite region, appended to the consumer's `<body>` and marked
`data-lr-live-region="polite"`, because a live region inside a shadow root is not reliably
announced (JAWS with Firefox ignores one outright). Assert against that document-level region
rather than `::part(live-region)`.

**CSS custom states:** `disabled` matches when the public `disabled` property is true. The state
does not match for the separate `loading` or empty-data conditions, even though those conditions
also make the rendered controls inert.

**Themeable custom properties:** `--lr-pagination-control-size` and
`--lr-pagination-font-size` (both default from `size`), `--lr-pagination-control-bg` (default
`var(--lr-color-surface)`) and `--lr-pagination-control-border-color` (default
`var(--lr-color-border)`) — the resting fill and border shared by the first/previous/next/last
buttons, interactive ellipses, and numbered pages, which is what `appearance` re-points: `filled` → `var(--lr-color-surface-raised)` + `transparent`,
`filled-outlined` → `var(--lr-color-surface-raised)` + `var(--lr-color-border)`, `plain` →
`transparent` + `transparent`, `accent` → `var(--lr-color-brand-quiet)` +
`var(--lr-color-brand)`; set either property yourself to theme past the five presets —
`--lr-pagination-control-radius` (default `var(--lr-radius)`) — border radius of the navigation
buttons, the numbered pages and the page input — `--lr-pagination-control-padding` (default
`var(--lr-space-xs)`) — inner padding of those same controls, deliberately uniform across every
`size` tier because the control's outer footprint is already fixed by
`--lr-pagination-control-size`, so this only adjusts the icon/digit inset. Layout spacing is split
across `--lr-pagination-base-gap` (default `var(--lr-space-m)`) between summary and controls,
`--lr-pagination-controls-gap` (default `var(--lr-space-xs)`) inside the navigation group, and
`--lr-pagination-pages-gap` (default `var(--lr-space-xs)`) between numbered pages; each remains
active in standard, compact, and 320px container layouts —
`--lr-pagination-invalid-border` (default `var(--lr-color-danger)`) — border color of
`[part="page-input"]` while the typed page is out of range (`aria-invalid="true"`); a state hook
declared as an inline `var()` fallback, since `::part(page-input)[aria-invalid='true']` is invalid
CSS. `--lr-pagination-control-color` independently controls the resting foreground. The applied
page has `--lr-pagination-current-bg`, `--lr-pagination-current-border-color`, and
`--lr-pagination-current-color`. Ordinary controls use `--lr-pagination-hover-bg`,
`--lr-pagination-hover-border-color`, `--lr-pagination-active-bg`, and
`--lr-pagination-active-border-color`; the applied page has independent
`--lr-pagination-current-hover-bg`, `--lr-pagination-current-hover-border-color`,
`--lr-pagination-current-active-bg`, and `--lr-pagination-current-active-border-color` hooks. Each
defaults to the exact shared brand/quiet-brand/active-mix treatment used previously. These state
hooks and the resting background/border hooks are consumed through inline fallbacks, so they work
when inherited from an ancestor as well as when set directly on one pager. Shared spacing,
disabled-opacity, and focus-ring tokens remain available as usual.

**Optional peer deps:** none.

```html
<lr-pagination
  total="237"
  page-size="20"
  with-summary
  with-edges
></lr-pagination>
<script>
  const pagination = document.querySelector("lr-pagination");
  pagination.addEventListener("lr-page-change", async (event) => {
    await loadPage(event.detail.page, event.detail.pageSize);
    pagination.page = event.detail.page;
  });
</script>

<!-- Link mode: real anchors, so the pager is crawlable and works before hydration. -->
<lr-pagination
  total="237"
  page-size="20"
  page="3"
  with-edges
  href-template="/products?page={page}"
></lr-pagination>
```

A function template builds the URL itself, which is where any dynamic segment gets encoded:

```js
const pagination = document.querySelector("lr-pagination");
const query = new URLSearchParams(location.search).get("q") ?? "";
pagination.hrefTemplate = (page) =>
  `/products?${new URLSearchParams({ q: query, page: String(page) })}`;
```

**Known gotchas:**

- user activation only emits an intent. Until the host applies a new `page`, the numeric input
  returns to the currently controlled value; assigning the page triggers the localized
  announcement in the shared light-DOM polite sink
- cancel `lr-before-page-change` for a policy veto; preventing `lr-page-change` has no effect because
  that second event is the accepted, non-cancelable controlled intent
- the jump input accepts only whole pages in `1..totalPages`; empty, fractional, and out-of-range
  drafts expose `aria-invalid="true"` and emit nothing
- zero items, zero page size, `disabled`, and `loading` all disable the navigation controls. The
  empty summary is still rendered via the localized `paginationEmptySummary` message
  (`'{total} {itemLabel}'`, producing `0 items` in the default locale) only when `with-summary` is set
- below a 20rem container allocation the summary and controls stack; the breakpoint responds to the
  component's own inline size, not the viewport. The control group and the page list wrap onto
  further rows at any width rather than overflowing. Previous/next and first/last icons all mirror
  under RTL
- link mode moves navigation outside the compact page field out of your handler. Numbered pages and
  ellipses exist only in standard layout; previous/next and first/last exist in both layouts. Each
  is a plain anchor with no click handler: activating it navigates and emits neither pagination
  event. The compact field continues to emit the controlled request events
- `href-template` is interpolated, not encoded. `{page}` is replaced with `String(page)` — always a
  plain integer, never the localized digits shown in the label — and the rest of the template is
  placed in the `href` verbatim: it is neither URL-encoded nor otherwise escaped. The only check
  applied is a scheme allowlist on the resolved URL (`http:`, `https:`, `blob:`, `mailto:`, and
  relative URLs); a `javascript:`, `data:` or unparseable result fails closed to a `<button>` for
  that page instead of being rendered. Treat the template as trusted application input and encode
  any dynamic segment yourself before it reaches the template — a function template is the
  straightforward place to do that
- the current page never gets an `href`, but while enabled it carries `tabindex="0"` so the applied
  location remains a keyboard stop. While `disabled` or `loading`, every anchor loses both `href`
  and the current page's explicit tabindex and carries `aria-disabled="true"`, leaving the inert
  pager with no tab stops
- an `hrefTemplate` function runs only for active targets inside `1..totalPages`. Current, spent,
  disabled, loading, and empty-state controls stay rendered as configured anchors without `href`,
  but do not call the function with a destination the user cannot activate
- `format="compact"` removes only the numbered list. `href-template` still applies to active
  previous/next and optional first/last targets around the page-jump input; spent boundary controls
  remain anchors without `href` and expose `aria-disabled="true"`
- the numbered list keeps a constant slot count as the reader pages through, so the control does not
  jitter: `siblingCount`/`boundaryCount` fix the budget, every page renders when the page count fits
  inside it, and otherwise a side that turns out to need no gap hands its slot back as one more page
  number. A gap is a named jump control, not decorative text; repeated activation advances through
  a large skipped run. Both counts are clamped to `25` and the render-every-page budget is capped at 101 slots, so
  however large you set them the list never renders more than 103 slots
- `appearance` does not reach the compact page-jump input — `[part="page-input"]` always draws with
  the shared surface and border tokens. Style `::part(page-input)` directly when a non-default
  appearance needs it to match

---

## `lr-gauge`

Dependency-free SVG radial, full-circle ring, or linear meter (no charting library).

**Properties:**

- `value: number = 0`
- `min: number = 0`
- `max: number = 100`
- `shape: GaugeShape = 'radial'`, where `GaugeShape = 'radial'|'ring'|'linear'` (reflected —
  `radial` is a 270° sweep; `ring` is a
  full circle that begins at 12 o'clock)
- `label: string = ''`
- `valueText?: string` (attribute `value-text` — overrides both the visible text and the host's
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
<lr-gauge
  shape="ring"
  value="84"
  label="Coverage"
  style="--lr-gauge-fill: var(--lr-color-success)"
></lr-gauge>
<lr-gauge shape="linear" value="0.4" max="1" value-text="72°F"></lr-gauge>
```

**9.0 migration:** rename geometry `type`/`GaugeType` to `shape`/`GaugeShape`, and formatted-value
`valueLabel` to the declarative `valueText`/`value-text`. There are no legacy aliases.

**Known gotchas:**

- SVG text cannot wrap. Long caller-supplied `label`/`valueText` strings are visibly abbreviated
  with an ellipsis instead of being compressed into unreadable hairline glyphs; a nested SVG
  `<title>` supplies the full hover tooltip, while the host accessible label and `aria-valuetext`
  retain the complete text.
- The host defaults to `role="meter"` for a finite, non-degenerate range and `role="img"`
  otherwise. An authored host role remains authoritative across value updates; removing it restores
  the generated default.
- setting `valueText` (e.g. `"72°F"`) also sets `aria-valuetext` on the host (in addition to
  changing the visible SVG text), so a screen reader announces your formatted string instead of the
  raw `aria-valuenow` number; the SVG `<text part="value">`/`<text part="label">` elements are
  `aria-hidden="true"` so they're no longer separately exposed inside the same `role="meter"` host.
- no automatic color-threshold/variant logic is built in. Set `--lr-gauge-fill` per instance (or
  reactively from application state) when the value should select a success/warning/danger color.
- no documented component-specific sizing custom property; host size is fixed em values
  (`8em` radial/ring, `12em`/`1.5em` linear) — resize via plain CSS `width`/`height` on the
  element instead.
- Divide-by-zero guarded, and radial/linear share one component via the `shape`
  attribute.
- non-finite `value` text remains blank unless `valueText` supplies a truthful fallback; that
  fallback is included in the generated `role="img"` accessible name. Non-finite `min`/`max` use finite default domain
  bounds; no `NaN`/`Infinity` value leaks into the SVG geometry or ARIA attributes, and a finite
  value is clamped into the resolved domain before being announced.

---

## `lr-funnel`

Dependency-free conversion funnel (no charting library): an ordered set of stages, each drawn as a
bar whose length is that stage's share of the **first** stage, read top-to-bottom as progressive
drop-off. It sits beside `lr-gauge` and `lr-heatmap` as an analytics primitive rather than a general
chart type.

It is deliberately not a sorted bar chart: it normalizes to the first stage rather than to the data
maximum, draws no value axis, and reads as stage-to-stage retention rather than category comparison.
Reach for `lr-bar-chart`/`lr-lite-chart` when you actually want a value axis and category comparison.

The whole chart is plain HTML — stage names, absolute values, shares and drop-off percentages are
real text inside an `<ol>`, so there is no sighted-only drawing needing a separate transcript. The
list carries the accessible name; a host `aria-label` overrides `label`.

**Properties:**

- `stages: readonly LyraFunnelStage[] = []` (property only; every share is measured against
  `stages[0]`)
- `comparison: readonly LyraFunnelStage[] = []` (property only — an optional baseline/peer cohort
  drawn behind each bar as a dashed outline, normalized to **its own** first stage so a cohort's
  funnel *shape* stays comparable against a baseline whose absolute volumes are not)
- `comparisonLabel: string = ''` (attribute `comparison-label`; falls back to a localized generic
  label)
- `label: string = ''` (accessible name for the stage list)
- `dropoff: boolean = true` (reflected; `dropoff="false"` in markup really does turn it off —
  the property uses the explicit `false`-parsing converter, not attribute presence)
- `sharePrecision: number = 0` (attribute `share-precision`; fraction digits for every share and
  drop-off percentage, clamped to `0`–`20`)

```ts
interface LyraFunnelStage {
  readonly label: string;
  readonly value: number;
  readonly color?: string; // CSS color; unparseable values fall back to --lr-funnel-bar-color
}
```

**Events:** none.

**Slots:** none.

**CSS parts:** `base`, `stages` (the `<ol>`), `stage`, `dropoff`, `stage-header`, `stage-label`,
`stage-value`, `stage-share`, `comparison-value`, `track`, `bar`, `bar-overflow` (a second token on
`bar` when the stage exceeds the first stage), `comparison-bar`, `empty`

**Themeable custom properties:** `--lr-funnel-bar-color` (default `var(--lr-color-brand)`),
`--lr-funnel-comparison-color` (default `var(--lr-color-border-strong)`), `--lr-funnel-track-color`
(default `var(--lr-color-surface-raised)`), `--lr-funnel-bar-size` (track thickness, default
`var(--lr-size-1-5rem)`).

**Optional peer deps:** none.

```html
<script type="module">
  import '@aceshooting/lyra-ui/components/data/funnel/funnel.js';
</script>

<lr-funnel id="signup" label="Self-serve signup" share-precision="1"></lr-funnel>

<script type="module">
  const funnel = document.querySelector('#signup');
  funnel.stages = [
    { label: 'Visited pricing', value: 12480 },
    { label: 'Started trial', value: 4310 },
    { label: 'Converted to paid', value: 512 },
  ];
  // Normalized to ITS OWN first stage, so a 380-visitor account still compares against a
  // 12,480-visitor peer group.
  funnel.comparison = [
    { label: 'Visited pricing', value: 380 },
    { label: 'Started trial', value: 141 },
    { label: 'Converted to paid', value: 12 },
  ];
  funnel.comparisonLabel = 'Acme Corp';
</script>
```

**Known gotchas:**

- **Shares are of the first stage, not of the previous one.** `stage-share` answers "how much of the
  top of the funnel is left here?"; the separate `dropoff` row answers "what changed since the
  previous stage?". Both are rendered because the percentage is usually the interesting number and
  the absolute count is the credibility check.
- **A zero or negative first stage cannot define a share.** Every `stage-share` is omitted, every bar
  is zero-length, and only the absolute values render. Nothing is silently divided by zero and no
  `NaN` reaches the geometry.
- **A stage larger than its predecessor is legal** (funnel re-entry). Its share is reported
  truthfully above 100% in text, while the bar clamps to the track and gains the `bar-overflow` part
  token so you can style it. Drop-off for that stage reads as an increase.
- **Drop-off is omitted, not zeroed, when the previous stage is non-positive** — a change relative to
  zero is undefined.
- **A comparison series of a different length pairs by index.** Extra comparison entries are ignored;
  stages past its end simply get no comparison bar. A comparison series whose own first value is
  zero or negative draws nothing.
- **Malformed stage entries are omitted independently.** Non-record entries and records without a
  string `label` cannot suppress valid neighbors in either series. This is a render-only boundary:
  the public `stages` and `comparison` arrays retain caller identity and are never rewritten.
- **Non-finite `value`s are treated as `0`** rather than blanking the stage, so one bad row cannot
  take the chart with it.
- Values, shares and drop-off percentages all format through the component's effective locale
  (`locale` attribute, or an inherited one) — never a hardcoded `en`.
- Bars grow from the inline-start edge and every dimension is a logical property, so `dir="rtl"`
  needs no extra work. The component never sets its own `dir`.
- Layout responds to the **container** (`container-type: inline-size` on `base`), not the viewport:
  below roughly `18rem` of allocated width the stage name moves to its own line so the value and
  share stay together. Bar motion is a token-driven transition that stops under
  `prefers-reduced-motion`.
- No events, no interaction model, no zoom/pan. If you need a clickable funnel, wrap the element and
  handle clicks yourself.

## `lr-word-cloud`

Dependency-free SVG word/tag cloud. First-party invention (no Web Awesome equivalent). Lays words
out via an outward Archimedean-spiral search — heaviest word placed first, each word spiraling from
the center until it clears every word already placed. Unlike sibling `lr-sparkline`/`lr-heatmap`
(one `role="img"` glyph standing in for an aggregate value), the individual words here _are_ the
meaningful interactive content — but with up to `MAX_WORDS` (150) of them, making every single one
its own tab stop would be a poor keyboard experience. Instead, like `lr-heatmap`'s cells, the whole
`[part="svg"]` is **one tab stop with roving arrow-key focus**: `ArrowRight`/`ArrowDown` move the
focus cursor to the next word in **declaration order** (not weight/placement order),
`ArrowLeft`/`ArrowUp` to the previous, `Home`/`End` to the first/last, and `Enter`/`Space` fires
`lr-word-activate` for the currently-focused word. Tab focus silently establishes the first word,
so immediate Enter/Space always works without requiring a preparatory arrow key. A
`[part="focus-ring"]` `<rect>` is drawn around the focused word, and a
shared light-DOM polite sink announces `"${text}, ${weight}"` on every focus move. Mount is silent,
and repeated edge movements append repeated announcements even when their text is identical.
`[part="live-region"]` mirrors the latest text for styling/inspection but is `aria-hidden` and has
no live-region role of its own. Pointer input resolves the nearest word from the adequately-sized
SVG surface; the potentially tiny text glyphs are not independent hit targets.

**Properties:**

- `words: readonly WordCloudWord[] = []` (attribute: false) — readonly `{ text: string, weight:
number, color?: string, group?: string }` snapshots; malformed/hostile records are skipped while
  later valid records survive. `weight` is normalized once to a finite nonnegative value used by
  font sizing, announcements, and `lr-word-activate` detail. A valid CSS `color` overrides the
  palette for that word (invalid values,
  declaration-breaking input, and `url()` fall back to the palette), and `group` shares one palette
  color across every word with the same `group` value. The component scans at most 10,000 input
  records, bounds each string to 256 characters and all retained word strings to 16,384 characters,
  marking shortened strings with an ellipsis and disclosing omitted input through `[part="limit"]`.
  The returned sequence and records are frozen; reassign `words` after changes.
- `minFontSize: number = 12` (attribute `min-font-size`) — px, applied to the lowest-weight word;
  a finite value is clamped to `[1, 512]` (so `0`/a negative value floors at `1px`, and an oversized
  value caps at `512px`); a non-finite value (`NaN`/`Infinity`) falls back to the default `12px`
  rather than to the `1px` floor
- `maxFontSize: number = 48` (attribute `max-font-size`) — px, applied to the highest-weight word;
  clamped/defaulted the same way (a non-finite value falls back to `48px`, not to `1px`); a
  resulting reversed pair (`minFontSize` greater than `maxFontSize`) is swapped rather than
  inverting the weight-to-size mapping
- `domain?: [number, number]` (attribute: false) — pins the weight-to-font-size input domain so
  separate clouds can share one scale instead of each deriving it from its own lightest and
  heaviest words. Reversed endpoints are normalized; a degenerate or non-finite pair falls back to
  the data-derived range
- `scale: 'linear'|'sqrt' = 'linear'` — `sqrt` compresses the weight→font-size mapping so one heavy
  word doesn't dwarf the rest, matching `lr-heatmap`'s `scale` property
- `wordRotation: 'none'|'mixed' = 'none'` (attribute `word-rotation`, reflected) — `mixed` lets
  ~25% of words render rotated 90° for denser packing
- `palette?: readonly string[]` (attribute: false) — clone-owned custom categorical colors (at
  most 64), cycled by word index (or by
  `group`); invalid CSS colors, declaration-breaking input, and `url()` entries are skipped, and an
  all-invalid palette defaults to the `--lr-word-cloud-color-1..8` tokens. The returned sequence is
  frozen; reassign `palette` after changes
- `legend: readonly WordCloudLegendItem[] = []` (attribute: false) — clone-owned, frozen named
  readonly `{ label, color }` entries for explaining explicit `words[].color`/group color
  overrides; when omitted, the component derives entries from grouped and explicitly colored
  words. Explicit legends retain at most 100 entries and 8,192 aggregate characters; malformed
  records are skipped, overlong strings end in an ellipsis, invalid colors render transparent, and
  `[part="legend-limit"]` truthfully exposes the localized rendered/received count. The returned
  sequence and records are frozen; reassign `legend` after changes.
- `showLegend: boolean = false` (attribute `show-legend`, reflected) — renders the supplied or
  derived legend below the cloud; the color key is an accessible list and does not change word
  activation or palette selection

**Methods:** `refreshTheme(): void` — forces a relayout so the `--lr-font` custom property is
re-read from computed style (font-family affects the canvas text measurement layout depends on).
The component's theme watcher calls it automatically when inherited theme typography changes; the
method remains available for a host theme system that needs an explicit synchronous refresh.

**Events:** `lr-word-activate` (frozen readonly `detail: { text, weight, group }`; fires from the
single SVG pointer surface, or Enter/Space on the current word)

**Slots:** none.

**CSS parts:** `base`, `svg`, `word` (each `<text>`), `focus-ring` (the rect around the roving-focus
cursor's word), `live-region` (visually-hidden, `aria-hidden` mirror of the latest announcement;
the actual announcement uses the shared light-DOM polite sink),
`legend`/`legend-item`/`legend-swatch`/`legend-label` (the optional static color key), and `empty`
(the no-data placeholder), `limit` (localized rendered/received word count), and `legend-limit`
(localized rendered/received explicit-legend count)

**Themeable custom properties:** `--lr-word-cloud-color-1`, `--lr-word-cloud-color-2`,
`--lr-word-cloud-color-3`, `--lr-word-cloud-color-4`, `--lr-word-cloud-color-5`,
`--lr-word-cloud-color-6`, `--lr-word-cloud-color-7`, `--lr-word-cloud-color-8` (the default
categorical palette, cycled by word index or `group`; a data-driven literal exception like
`lr-heatmap`'s scale-ramp endpoints — exposed as retheme-able custom properties instead of
hardcoded). They inherit from theme ancestors, while a value set directly on the word cloud wins
through the normal cascade), plus shared tokens (`--lr-font`,
`--lr-focus-ring-*`, `--lr-transition-fast`, `--lr-color-text-quiet`).

**Optional peer deps:** none.

```html
<lr-word-cloud id="cloud" style="height: 20rem"></lr-word-cloud>
<script type="module">
  document.getElementById("cloud").words = [
    { text: "JavaScript", weight: 90 },
    { text: "TypeScript", weight: 75 },
    { text: "Lit", weight: 60, group: "framework" },
  ];
  document
    .getElementById("cloud")
    .addEventListener("lr-word-activate", (e) => console.log(e.detail));
</script>
```

The focusable SVG is the single semantic owner: `role="application"` plus an accessible name. An
authored host `aria-label` is forwarded to that SVG and wins by attribute presence; when it is
absent, the SVG uses an auto-computed localized name such as `"Word cloud of 12 words"` / `"Word
cloud of 1 word"`, counting only words actually rendered. An authored host `role` remains on the
host and does not replace the SVG's application role. When records are omitted, the SVG references
the visible localized `[part="limit"]` rendered/received summary.

**Known gotchas:**

- capped at 150 words (`MAX_WORDS` in `word-cloud-layout.ts`, mirroring `lr-sparkline`'s
  `MAX_POINTS` input-sample guard) — a one-pass bounded top-K scan retains the **heaviest** 150 and
  counts the rest without cloning/sorting/spreading the full input. A pathological input can exhaust the
  spiral search's radius bound and get dropped the same way; blank/whitespace-only `text` is dropped
  during boundary normalization. Omitted diagnostics retain at most 32 records, while a separate
  complete count drives one deduplicated `console.warn` and the rendered disclosure — nothing throws.
- each word's spiral search tests at most 4,096 candidate positions. Together with the 150-word and
  512px font-size caps, this bounds placement work even for dense or adversarial layouts; a word
  that exhausts the search budget is reported through the same skipped-word path.
- text width is measured via a detached `<canvas>` 2D context (`ctx.measureText`) using the live
  `--lr-font-weight-semibold` and `--lr-font` token values. A consumer-only `::part(word)` font
  override can still desynchronize measurement from the painted glyph.
- rotation (`word-rotation="mixed"`) is genuinely random per layout (`Math.random()`, not seeded), so
  which words render rotated changes on every re-layout (any `words`/`minFontSize`/`maxFontSize`/
  `scale`/`wordRotation` change) — don't rely on rotation being stable across renders.
- only one word is ever in the page's tab sequence at a time (the roving cursor on `[part="svg"]`) —
  there's no way to Tab directly to the Nth word; arrow-key/Home/End your way there, or click it.

---

## `lr-heatmap`

A Canvas-rendered heatmap with a DPR-aware, resize-aware redraw loop. One discriminated `data`
property selects `{ kind: "matrix", rowLabels, colLabels, values }` (the default) or
`{ kind: "calendar", days, ...calendarOptions }` (a GitHub-style weekday × week grid). Every cell
is independently addressable despite being
canvas-drawn (no per-cell DOM node by default): a `pointermove` hit-test over the canvas shows `[part="tooltip"]`
with that cell's label + value; the canvas is a named `role="application"`, `tabindex="0"` control
with arrow-key roving focus (a stroked ring is redrawn over the focused cell on every draw, and the
cell text is appended to the document's shared light-DOM polite sink); and a click, or Enter/Space
on the focused cell, fires `lr-cell-click`. The first render is silent, repeated identical focus
movements remain separate announcements, and `[part="live-region"]` is only an `aria-hidden` mirror.
Both modes deliberately retain physical LTR grid geometry under `dir="rtl"`: matrix column 0 and
calendar week 0 remain at the physical left, so ArrowLeft and ArrowRight retain their physical
previous/next movement instead of swapping for RTL.
Full canvas redraws pause while the host is outside the viewport. Data, locale, theme, resize, and
DPR invalidations remain pending and coalesce into one redraw when the heatmap intersects again;
environments without `IntersectionObserver` retain eager drawing.

Set `accessibleCells: true` (`accessible-cells`) to opt into a semantic grid backed by a bounded
window of native buttons. It retains the complete `aria-rowcount`/`aria-colcount` and arrow-key
navigation model without mounting one node per cell. Buttons use localized `aria-label`s, explicit
`aria-selected="true"|"false"` from the controlled `selectedCell`, and roving tabindex; the grid
continues to emit `lr-cell-click` and leaves selection state consumer-controlled.
When matrix/calendar data refreshes while one of those buttons owns focus, the semantic matrix
coordinate or calendar date remains the sole roving stop. If it disappears, focus clamps to the
nearest surviving interactive cell, or to the stable heatmap base when none remain; an unfocused
refresh never steals external focus.

Changing `accessibleCells` also preserves owned focus across the rendering-mode replacement:
turning the overlay off moves a focused cell button to the canvas application control; turning it on
moves a focused canvas to the matching remembered cell, the first interactive cell, or the stable
base when no cell exists. A newer external focus destination is never reclaimed.

**Properties:**

- `data: HeatmapData = { kind: 'matrix', rowLabels: [], colLabels: [], values: [] }` (attribute:
  false), where `HeatmapData` is the readonly discriminated union:
  - `HeatmapMatrixData { kind: 'matrix'; rowLabels: readonly string[]; colLabels: readonly
string[]; values: readonly (readonly number[])[] }`
  - `HeatmapCalendarData { kind: 'calendar'; days: readonly CalendarDay[]; firstDayOfWeek?:
number; columnX?: (index:number)=>number; rowY?: (weekday:number)=>number;
weekdayLabelWidth?: number|'auto'; weekdayLabelText?: (jsWeekday:number)=>string|undefined; monthLabelText?:
(jsMonth:number,year:number)=>string|undefined }`
    Matrix `-1` or non-finite values are no-data. Calendar identity is ISO date; invalid dates are
    omitted and duplicates use one deterministic **first-valid-wins** entry before count, scale,
    paint, selection, focus and event paths.
    Collections are snapshotted into a bounded canonical projection; reassign `data` after changing
    caller-owned input.
    `weekdayLabelWidth` controls the calendar weekday-label gutter: a nonnegative CSS-pixel number
    pins its width, while `'auto'` measures the widest rendered weekday label without shrinking
    below the built-in `28px` gutter or growing beyond 40% of the host. Unset preserves the original
    `28px` geometry; malformed values are ignored.
- `cellSize: number = 22` (attribute `cell-size` — default `22` in matrix mode, `11` in calendar
  mode when left unset; explicitly setting it now governs both modes' per-cell size alike, and it's
  ignored in either mode when `fitToWidth` is set)
- `fitToWidth: boolean = false` (attribute `fit-to-width` — derives `cellSize` from the host's
  measured `clientWidth` on every draw/resize instead of the fixed `cell-size`, so the grid actually
  fills the available width; now applies to calendar mode as well as matrix mode — see gotchas for
  the default, non-`fit-to-width` behavior)
- `rowLabelWidth?: number | 'auto'` (attribute `row-label-width`, reflected) — width, in CSS px, of
  the **matrix** row-label gutter, or `'auto'` to measure the widest label and size the gutter to
  fit (never below the built-in `60`, never above 40% of the host width, so one long label cannot
  squeeze out the cells it describes). Unset keeps the built-in `60`, so no existing chart reflows.
  Independently of this, a label too wide for the resolved gutter is truncated with an ellipsis
  rather than clipped mid-glyph — clipping read as a rendering fault, truncation reads as "there is
  more here". `cellText` still carries the full label to the tooltip and the keyboard announcement.
  A malformed value is ignored rather than collapsing the gutter. Calendar mode is unaffected; it
  has its own fixed weekday gutter
- `colLabelHeight?: number | 'auto'` (attribute `col-label-height`, not reflected, `'auto'` new in
  11.0.0) — height, in CSS px, of the matrix column-label band, or `'auto'` to measure the labels
  and size the band to fit them. Under a non-zero `colLabelRotation` the measurement projects each
  label's width through the rotation, which is what makes a rotated axis usable without hand-tuning
  a magic number. Never below the built-in `20`, and bounded above by a sanity ceiling so a
  pathological label cannot produce an absurd canvas. Note this deliberately does **not** use
  `rowLabelWidth`'s "40% of the host" rule: the row gutter steals width from the cells and so must
  be bounded relative to them, whereas the canvas simply grows taller for this band and the cells
  keep their size. Unset keeps the built-in `20`, so no existing chart reflows. A malformed value is
  ignored
- `colLabelRotation?: number` (attribute `col-label-rotation`, new in 11.0.0) — rotation, in
  degrees, applied to matrix column labels. Unset or `0` paints them horizontally exactly as before.
  In a dense matrix the per-column width is far narrower than a typical label, so horizontal labels
  collide with their neighbours; `45` or `90` is the standard remedy. Each label rotates about an
  anchor at its own column's centre with the label's *end* at that anchor, so it leans back over the
  columns to its left and the last column's label cannot overflow the canvas. Values outside
  `[0, 90]` clamp into that range and non-finite values normalize to `0`. Pair with
  `colLabelHeight="auto"` to have the band size itself to the rotated extent. **Not mirrored under
  `dir="rtl"`** — both grid modes deliberately retain physical LTR geometry, so leaning one axis'
  labels the other way would be incoherent
- `stickyLabels: 'none' | 'rows' | 'cols' | 'both' = 'none'` (attribute `sticky-labels`, reflected)
  — freezes a **matrix** label band against the grid's own scrolling. `'rows'` pins the row-label
  gutter so it survives horizontal scrolling, `'cols'` pins the column-label band so it survives
  vertical scrolling, `'both'` pins both. Labels and cells otherwise share one bitmap, so neither
  band can be `position: sticky` on its own and a tall matrix scrolls its column header out of
  view; the only workaround was a light-DOM mirror row that had to hardcode the gutter width and
  cell size, which made it mutually exclusive with `row-label-width="auto"`. A frozen band is
  repainted into its own layer in the same draw pass, from the same resolved `matrixGeometry` the
  cells were painted with, so it tracks a `row-label-width`/`col-label-height` `"auto"`
  re-resolution, a resize, and a DPR change without drifting a pixel. Freezing needs something to
  scroll, so the frozen modes wrap the grid in a `[part="grid"]` scrollport: it is bounded inline by
  the host's own allocation — a matrix wider than a 320px host scrolls inside the component instead
  of overflowing it — and unbounded in block until you set `--lr-heatmap-grid-max-block-size`, which
  a frozen column band needs in order to have vertical scrolling to stay behind. The bands are
  `aria-hidden` duplicates of pixels the canvas already painted, so the accessible representation is
  unchanged, and the `accessibleCells` overlay moves inside the scrollport so the cell buttons
  scroll with the canvas they cover. The grid keeps this component's physical LTR geometry under
  `dir="rtl"`, so the frozen gutter stays on the same physical side as the labels the canvas paints.
  Matrix mode only, like `matrixGeometry`: the property is read in calendar mode but has no effect
  there, since a calendar's axes are a different geometry (fixed weekday gutter, month band, and the
  optional `columnX`/`rowY` overrides). Unset (`'none'`, the default) renders exactly what it always
  did — one canvas, no scrollport, no extra elements — and an unsupported value normalizes to it.
  The union is re-exported from the package root as `LyraHeatmapStickyLabels`, so a typed consumer
  can annotate a variable or a framework prop with it. Everything positioned in canvas coordinates
  moves into the scrollport with the cells: `[part="tooltip"]` renders inside it, so it stays on
  the cell it describes through a scroll instead of drifting by the scroll offset, and because
  `overflow: auto` clips whatever leaves the scrollport, the tooltip is kept inside the visible
  window too — clamped along the inline axis and flipped to below its cell when a frozen band
  leaves no room above it. Arrow-key navigation scrolls the focused cell into that window, clear of
  the frozen bands, which the frozen modes need in their own right: the canvas is the roving tab
  stop, its focus ring is painted into the bitmap rather than carried by a focusable element the
  browser would scroll to, and it calls `preventDefault()` on the arrows
- `maxCellSize?: number` (attribute `max-cell-size`) — ceiling, in CSS px, on the cell size
  `fitToWidth` derives from the host width, in **both** modes. Exists because `fitToWidth` divides
  the _whole_ host width across the grid, so a 5-week calendar or a 3-column matrix in a wide pane
  produces enormous blocks; capping them keeps a cell a cell
- `minCellSize?: number` (attribute `min-cell-size`) — the mirror floor, in CSS px, so a year-long
  calendar in a narrow pane keeps legible, hit-testable cells and overflows its host instead of
  collapsing to hairlines. It can only _raise_ the built-in `4`px floor, never lower it: a value
  below `4` normalizes to `4`. When both clamps are set and `maxCellSize < minCellSize`, the ceiling
  wins. For both: a non-finite value, or an empty attribute, means unset rather than `0`, and unset
  (the default) reproduces the unclamped fit-to-width behavior exactly
- `valueLabel?: string` (attribute `value-label`) — absence uses the localized default. Every
  supplied string is literal, including `"value"` and `""`; unset the property/attribute to resume
  localization.
- `scale: 'linear' | 'sqrt' = 'linear'` — governs both modes: in matrix mode, `'sqrt'` compresses the
  color ramp via `sqrtStep()` instead of mapping linearly; in calendar mode, the default `'linear'`
  still buckets by quartile (`quartileBucket()`, unchanged), while `'sqrt'` instead compresses via the
  same `sqrtStep()` magnitude compression as matrix mode, so one heavy day doesn't wash out the rest
- `domain?: [number, number]` (attribute: false) — pins the color ramp's input domain instead of
  deriving it from the data's own extremes, so two heatmaps of comparable data can share a scale
  rather than each normalizing to its own min/max. A reversed pair is normalized; a degenerate or
  non-finite one falls back to the derived range
- `midpoint?: number` — anchors a diverging ramp's neutral color on this value rather than at the
  middle of the domain, scaling the two halves independently (`lo`→0, `midpoint`→0.5, `hi`→1). A
  midpoint outside the resolved domain degrades to plain normalization rather than distorting the
  ramp
- **Signed data.** Setting either `domain` or `midpoint` opts the component into signed data, where
  only a **non-finite** value is no-data. With neither set (the default), a negative value is
  no-data — matching the long-documented `-1` sentinel, since a matrix of counts has no meaningful
  negative. Declaring a domain or midpoint is what disambiguates "a real negative" from "the
  sentinel", so signed datasets render their negative half instead of dropping it. In signed mode a
  structurally absent matrix cell reads as `NaN` so it stays no-data while a real `-1` beside it
  renders on the ramp; in default mode an absent cell still resolves to `-1`, keeping `valueAt()`
  and the `lr-cell-click` payload unchanged. `scale="sqrt"` rejects negatives in both modes — a
  square root of a negative has no meaning
- `bucketCount: number = 5` (attribute `bucket-count` — calendar mode only; non-finite values fall
  back to 5, while finite values are floored and clamped to 2–256 before the color-ramp allocation)
- `annotations: readonly HeatmapAnnotation[] = []` (attribute: false) — `HeatmapAnnotation { row?: number;
col?: number; date?: string; label?: string }`: matrix mode matches by `row`/`col`, calendar mode
  by `date` (whichever pair matches the active `mode`; the other fields are ignored). Draws a
  stroked ring over the matching cell; an annotation with a `label` also gets its own
  `[part="legend-annotation"]` entry in the legend. The collection is clone-owned, bounded, and
  frozen; reassign a new array after changes.
- `selectedCell: HeatmapSelectedCell | null = null` (attribute: false) — `HeatmapSelectedCell {
row?: number; col?: number; date?: string }`, matched the same way as `annotations`. Draws a
  persistent ring (independent of keyboard focus) over the matching cell, appends a "Selected: ..."
  description to the host's own `aria-label`, and adds localized selected wording to the keyboard
  announcement when the focused cell is the selection. Purely a controlled property — mirrors
  `<lr-lite-chart>`'s `selectedIndices`, this component never mutates it itself. Unset (the default,
  `null`) reproduces today's exact output.
- `accessibleCells: boolean = false` (attribute `accessible-cells`) — renders `[part="cells"]` with
  at most 400 `[part="cell"]` native buttons around the active cell. The semantic grid exposes the
  full row/column counts, buttons expose localized `aria-label`s and explicit `aria-selected`, and
  roving arrow navigation still reaches every canonical cell. The canvas remains the visual and
  pointer surface but is hidden from the accessibility tree. Controlled refresh focus follows the
  preservation/clamping behavior above.
- `cellText?: (pos: MatrixCellPos | CalendarCellPos, value: number) => string` (attribute: false) —
  formats the per-cell hover tooltip and keyboard announcement text; receives the cell
  position (`MatrixCellPos { row, col }` in matrix mode, `CalendarCellPos { week, weekday, date }` in
  calendar mode) and its value. `CalendarCellPos.date` is a **required** ISO `yyyy-mm-dd` string,
  present for every grid position — including a sparse gap position with no matching entry in `days`
  at all, which still sits on a real calendar day (that case simply reports the `-1` "no data" value
  alongside it). It lets a callback key off the date without re-deriving the grid's own
  anchor-week arithmetic; `MatrixCellPos` is unchanged, and so is `lr-cell-click`'s detail.
  Unset (the default) falls back to localized matrix row/column/value or calendar date/value
  templates. The default English catalog renders "Row X, Col Y: value" (matrix) / "Jan 15: value"
  — short month + day, **not** a weekday abbreviation (calendar). Matrix row/column placeholders,
  no-data wording, template order, calendar wording/date formatting, and numeric values all follow
  `locale` plus `registerLyraLocale()`/`.strings`; use `cellText` for application-specific wording.
- `cellInteractive?: (pos: MatrixCellPos | CalendarCellPos, value: number) => boolean` (attribute:
  false) — opts individual cells out of the interaction model; receives the cell position and its
  value, return `false` to make that cell present-but-non-interactive (no hover tooltip, click, or
  keyboard roving-focus stop) without losing the layout/color-ramp machinery. Unset (the default)
  keeps every cell interactive, unchanged.
- `data.columnX?: (index: number) => number` (calendar branch only) — overrides the
  internal week-column x-coordinate formula (`CAL_PAD_LEFT + week * (CAL_CELL + CAL_GAP)`) used
  consistently across drawing, hit-testing, the focus ring, and month-label positioning, so a
  consumer can pixel-align this calendar's week columns with a sibling `<lr-lite-chart>`'s bars
  (see that component's own `barX`) by supplying the same coordinate function to both. Unset (the
  default) is the original formula, unchanged.
- `data.rowY?: (weekday: number) => number` (calendar branch only) — the vertical
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
- `data.weekdayLabelText?: (jsWeekday: number) => string | undefined` (calendar branch only) —
  overrides the weekday-axis label text; receives the real JS weekday index (`0` Sunday ..
  `6` Saturday) for a row that would otherwise render a label and, when it returns a string, uses it
  instead of the built-in `Intl.DateTimeFormat`-derived short weekday name. Unset (the default)
  reproduces today's exact locale-derived output.
- `data.monthLabelText?: (jsMonth: number, year: number) => string | undefined` (calendar branch
  only) — the month-axis analogue of `weekdayLabelText`: receives the real JS month
  index (`0` January .. `11` December) and full year for a month boundary that would otherwise
  render a label, and, when it returns a string, uses it instead of the built-in
  `Intl.DateTimeFormat`-derived short month name. Unset (the default) reproduces today's exact
  locale-derived output. Lets month labels track the same locale signal (e.g. an app's own i18n
  store) as `weekdayLabelText` and the component's other localizable strings, instead of always
  following the browser/OS-language default.
- `colorSteps?: readonly string[]` (attribute: false) — a clone-owned, bounded, frozen discrete array (≥2 entries) of CSS colors used as
  exact ramp steps instead of linearly interpolating between `--lr-heatmap-scale-lo`/`-hi`;
  governs both `mode`s and both `scale` values, discretizing whichever scale would otherwise
  interpolate continuously into `colorSteps.length` buckets instead. Unset (the default, or fewer
  than 2 entries) keeps today's 2-endpoint interpolation exactly. Invalid colors use the canvas
  fallback color and prevent the custom legend gradient from being assigned.
- `legendStops?: readonly HeatmapLegendStop[]` (attribute: false) — clone-owned, bounded, frozen `HeatmapLegendStop { value: number;
color?: string; label?: string; partOfRamp?: boolean }`: a discrete legend key rendered **instead of** the
  `--lr-heatmap-scale-lo`/`-hi` gradient bar and its `[part="legend-lo"]`/`[part="legend-hi"]`
  endpoint labels — one `[part="legend-stop"]` per entry, in array order, each a
  `[part="legend-swatch"]` filled with that entry's `color` plus a `[part="legend-stop-label"]`.
  `color` is optional: omit it, pass an empty string, or pass an invalid CSS color for a
  **caption-only** stop, which renders its `[part="legend-stop-label"]` alone with no
  `[part="legend-swatch"]` element in the DOM at all — so a leading "0" or trailing "more" caption
  around a run of colored stops doesn't leave an empty swatch box in the row.
  A stop's label defaults to the component's own locale-aware numeric formatting of `value`, so an
  explicit `label` is only needed when the number isn't the right caption ("none", "≥ 90%"). Exists
  for the consumer who supplies `cellColor`: because that callback overrides a cell's color
  entirely, the built-in two-endpoint bar can end up describing a ramp the grid no longer uses —
  supplying the same colors here keeps the legend honest instead of hiding `::part(legend)` and
  re-implementing swatches, labels and annotation entries by hand. Strictly presentation: the stops
  are never consulted by the color ramp, the bucket math, the tooltip, or the generated accessible
  name, so adding them changes nothing a cell renders. Labeled `annotations` still render their
  `[part="legend-annotation"]` entries after the stops. Unset (the default) or an empty array
  reproduces the exact gradient legend, unchanged. Reassigning stops whose `value`/`color`/`label`/
  `partOfRamp` fields are unchanged does not schedule a canvas redraw. The assignment still takes
  a fresh frozen ownership snapshot, so mutating and reassigning the same caller array is detected
  while mutation without reassignment remains isolated. A dev-mode-only warning fires when a stop's
  `color` doesn't match the corresponding `colorSteps` entry — set `partOfRamp: false` on a stop
  that is a real, distinctly-colored swatch deliberately outside the sequential ramp (e.g. a fixed
  "no data" color next to an N-step ramp) to exclude just that stop from the comparison; defaults to
  `true`. A caption-only stop (no `color`) is already excluded regardless of this flag.

**Getters/methods:** `refreshTheme()` — redraws canvas content after an upstream design-token or
color-scheme change; called automatically on theme changes, exposed for a consumer that needs to
force a redraw manually. `matrixGeometry: Readonly<{ padLeft: number; padTop: number; cellSize:
number }> | undefined` — the gutter/cell geometry the last matrix-mode draw actually painted with,
in CSS pixels; `undefined` in calendar mode. Lets a light-DOM consumer line up with the canvas
without hardcoding the same numbers `row-label-width`/`col-label-height`'s `"auto"` resolution would
otherwise keep private. For the case that motivated it — a frozen header or gutter on a tall or wide
matrix — prefer `stickyLabels`, which freezes the band inside the component and needs no mirror at
all; the getter remains the way to align a *separate* element (a sibling chart, a custom overlay)
with the grid.

**Events:** `lr-cell-click` (fired on click, or Enter/Space on the keyboard-focused cell —
`detail: { row, col, value }` in matrix mode, `detail: { date, value }` in calendar mode),
`lr-matrix-geometry-change` (fired after a matrix-mode draw whose resolved `matrixGeometry` differs
from the previous draw — e.g. after `row-label-width="auto"`/`col-label-height="auto"` resolves
against new content or a resize; `detail` is the same object `matrixGeometry` returns; never fired
in calendar mode)

**Slots:** none.

**CSS parts:** `base`, `canvas`, `grid` (the scrollport wrapping the canvas while `stickyLabels`
freezes an axis — absent entirely otherwise), `row-labels`/`col-labels` (the frozen label bands,
rendered only for the axis `stickyLabels` names), `cells` (opt-in per-cell overlay), `cell` (one opt-in native cell
button), `tooltip` (hover tooltip, positioned over the hovered cell — inside `[part="grid"]` while
`stickyLabels` freezes an axis, so it scrolls with the cells, and a `[part="base"]` child
otherwise),
`live-region` (visually-hidden, `aria-hidden` mirror of the keyboard-focused cell; the actual
announcement uses the shared light-DOM polite sink), `projection-limit` (localized assistive
disclosure when bounded canonicalization truncates input), `legend`, `legend-lo`, `legend-hi` (both omitted, along with the gradient
bar between them, while `legendStops` is supplied), `legend-stop` (one per `legendStops` entry),
`legend-swatch` (that stop's color chip, not rendered at all for a caption-only stop),
`legend-stop-label` (that stop's text), `legend-value-label` (the trailing `valueLabel` caption that
closes the legend row, present in both the gradient and the `legendStops` branch),
`legend-annotation` (one per labeled `annotations` entry)

**Themeable custom properties:** `--lr-heatmap-scale-lo` (default `var(--lr-color-brand-quiet)`),
`--lr-heatmap-scale-hi` (default `var(--lr-color-brand)`) — the sequential color-ramp endpoints
(matrix mode) or quartile-bucket ramp endpoints (calendar mode), resolved via `getComputedStyle` each
draw (any valid CSS color syntax — hex/rgb/hsl/oklch/named — works, resolved through a scratch
canvas). Private defaults follow the theme (including dark mode), while inherited or direct public
values remain authoritative; the hard-coded `#cde2fb`/`#0969da` pair in the source is
only a last-resort constant for the case where the custom property resolves to an empty string (no
stylesheet applied at all), not the shipped default.
`--lr-heatmap-no-data-fill` (default `var(--lr-color-no-data)` — the no-data cell fill, same
resolve-via-`getComputedStyle` pattern), `--lr-heatmap-label-font` (default
`var(--lr-size-10px) var(--lr-font)` — the canvas-drawn axis/month/weekday label font),
`--lr-heatmap-focus-ring-color` (default
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
directly, no `getComputedStyle` bridging needed. `--lr-heatmap-sticky-label-bg` (default
`var(--lr-color-surface)` — the backdrop painted under a frozen `stickyLabels` band, resolved via
`getComputedStyle` like the other canvas-drawn tokens; it must stay **opaque**, since it covers the
same labels the scrolling canvas painted underneath it) and `--lr-heatmap-grid-max-block-size`
(default `none` — the block-size ceiling of the `[part="grid"]` scrollport, consumed directly by
that real DOM element; set it to give a frozen column band vertical scrolling to stay behind). Also consumes `--lr-color-text-quiet` (axis label
color), `--lr-space-xs`, `--lr-radius`/`--lr-shadow` (tooltip box), and `--lr-focus-ring-width`/
`--lr-focus-ring-offset` (the real `[part="canvas"]:focus-visible` DOM outline, stroked in the
same color as `--lr-heatmap-focus-ring-color`).

**Optional peer deps:** none.

```html
<lr-heatmap value-label="requests"></lr-heatmap>
<script>
  const hm = document.querySelector("lr-heatmap");
  hm.data = {
    kind: "matrix",
    rowLabels: ["Mon", "Tue", "Wed"],
    colLabels: ["00h", "06h", "12h", "18h"],
    values: [
      [3, 8, 12, 4],
      [1, 2, 9, 5],
      [0, 4, 6, 2],
    ],
  };
</script>
```

```html
<!-- Calendar mode: a GitHub-contributions-style day grid -->
<lr-heatmap value-label="commits"></lr-heatmap>
<script>
  document.querySelector("lr-heatmap").data = {
    kind: "calendar",
    days: [
      { date: "2026-01-01", value: 3 },
      { date: "2026-01-02", value: 0 },
    ],
    firstDayOfWeek: 1,
  };
</script>
```

**9.0 migration:** replace the independent `mode`, `rowLabels`, `colLabels`, `values`, `days`,
`firstDayOfWeek`, `columnX`, `rowY`, `weekdayLabelText`, and `monthLabelText` members with one
`data` assignment as shown above. There are no runtime aliases: this removes stale cross-mode state
and gives every scale/count/paint/selection/event path the same bounded projection. Replace the old
magic `value-label="value"` localization sentinel by removing the attribute; a supplied `"value"`
is now literal.

**Known gotchas:**

- Matrix projection is capped at 10,000 renderable cells. Calendar input is capped at 10,000
  records and 530 weeks, and the color-step/legend-stop/annotation projections are each capped at
  256 entries. `[part="projection-limit"]` and the generated accessible summary disclose every
  truncation. The semantic grid mounts at most 400 cell buttons while preserving full navigation.
- Calendar duplicates use a first-valid-wins ISO-date identity. Invalid dates are dropped. `data.columnX`
  and `data.rowY` results must be finite, nonnegative, monotonic and non-overlapping; an invalid,
  throwing or hostile result safely falls back to the normal coordinate for that position.
- Annotation, controlled selection and keyboard focus use independent concentric canvas rings;
  selection/focus also use distinct dash patterns so forced-color rendering does not collapse the
  three public states into one overwritten outline.
- The legend is a wrapping flex row. Long unbroken stop labels, the trailing `valueLabel`, and
  annotation labels wrap within the host instead of forcing the heatmap wider than its allocation.
- `legendStops` _replaces_ the lo/hi gradient bar rather than adding to it: supplying it removes
  `[part="legend-lo"]`, `[part="legend-hi"]` and the bar from the DOM, so a stylesheet targeting
  those parts silently stops applying. It is also presentation-only — it never feeds back into the
  cell colors, so the stops and a `cellColor` callback have to be kept in agreement by the consumer
  (the point of the property is that they _can_ be, from one shared function).
- the `ResizeObserver` only actually resizes the drawn grid **when `fit-to-width` is set**, in either
  mode. Without it (the default), `draw()` sizes the canvas as `PAD_LEFT + cols * cellSize` (matrix
  mode) or `CAL_PAD_LEFT + weekCount * cellSize` (calendar mode), never from the host's measured
  width, so a container-resize redraw is a geometric no-op; the stylesheet's
  `canvas { inline-size: 100% }` is also dead code in that case, since `draw()` unconditionally sets
  an inline `canvas.style.width/height` that wins over it.
- `maxCellSize`/`minCellSize` are no-ops without `fit-to-width` — an explicit `cellSize` is an exact
  request and is never clamped. And the canvas is sized _from the clamped_ cell size, so a capped
  grid deliberately leaves the host's remaining width unfilled: the canvas simply ends early rather
  than stretching to fill. Position it with ordinary CSS on the host if you want it centered or
  end-aligned.
- the host is `role="group"` (not `role="img"`) with a dimensions+range summary `aria-label`
  (calendar mode: a day-count + range summary instead). In default canvas mode,
  `[part="canvas"]` is itself a named `role="application"`, focusable, keyboard-operable,
  per-cell-interactive control (roving arrow-key focus, shared light-DOM announcements,
  `lr-cell-click`). `role="img"` would flatten that interactive subtree for some assistive tech.
  With `accessibleCells`, the canvas becomes `aria-hidden` and the native cell-button overlay owns
  the interactive semantics instead.
- `NaN`/non-finite cell values in matrix mode are correctly treated as no-data now (alongside `-1`),
  and repeated DPR crossings (moving the window across displays with different pixel ratios) no
  longer leak a `MediaQueryList` listener per crossing — both previously-known issues are fixed.
- calendar mode's date labels (used by the default `cellText` template and the tooltip/announcement
  text) now format via `effectiveLocale` (`toLocaleString(effectiveLocale, ...)`) instead of a hardcoded
  `'en'` — fixed. The canvas-drawn axis chrome is now locale-aware too: month labels use
  `toLocaleString(effectiveLocale, ...)` (previously hardcoded `'en'`) and weekday labels are derived via
  `Intl.DateTimeFormat(effectiveLocale, { weekday: 'short' })` (previously a literal English `['', 'Mon',
'', 'Wed', '', 'Fri', '']` array) — same sparse every-other-day spacing, just locale-correct text.

---

## `lr-sequence-strip`

A compact, one-thin-cell-per-item strip visualizing a sequence of categorical states, with an
optional secondary per-cell marker. Pure CSS/flex — no chart.js, no SVG, no canvas — sized/named
consistently with the sparkline/heatmap family, and read as a glanceable aggregate. `[part="base"]`
is a labeled `role="list"` and each cell a named `role="listitem"` (`aria-label`, `aria-posinset`,
`aria-setsize`), so the sequence is walkable item by item rather than collapsed into one summary
string. Exactly one cell is tabbable at a time (roving `tabindex`); ArrowLeft/ArrowRight and
Home/End move the stop — direction-aware, so the arrows swap under RTL — and focusing a cell shows
the same `[part="tooltip"]` detail that pointer hover does. That tooltip is positioned from the
active cell, not from the center of the whole strip. The tooltip is visual only and is not
wired through `aria-describedby`, because the cell's own `aria-label` already exposes the identical
text and describing it again would duplicate the announcement. Cells are actionable: clicking a
cell, or pressing Enter/Space on the roving cell, emits `lr-item-activate`. Selection is controlled,
so the consumer updates `selectedIndex` when it accepts that activation. Setting `showLegend`
additionally renders a static `[part="legend"]` key below the strip, so the color-to-category
mapping is readable without visiting each cell.

A standard host `aria-label` names the host itself and is not copied verbatim to the internal
list; `accessible-label` remains the list-specific override and otherwise the generated
category-count summary names it. When an
`items` refresh occurs while a cell owns focus, its `id` remains the sole roving stop; removal
clamps focus to the nearest survivor, or to the stable list base when no cells remain. Unfocused
refreshes do not move focus. A queued Arrow/Home/End focus is bound to the current item-array
identity and connection generation, so a same-turn replacement or disconnect/reconnect cannot
focus an unrelated cell that merely inherited the old numeric index.

High-cardinality strips retain at most the first 10,000 assigned items and categories as detached,
frozen canonical snapshots; reassign either collection after changing it. They mount a bounded
window of at most 200 cells around the roving stop rather than creating one DOM node per retained
item. `aria-posinset`/`aria-setsize` retain positions and the total count from that bounded model;
Home/End and arrows shift the window before moving focus, so every retained item remains keyboard
reachable. `[part="window-range"]` visibly discloses the currently projected numeric range and
total. The optional legend likewise mounts at most 200 categories and exposes
`[part="legend-limit"]` as a rendered/total numeric disclosure.

**Properties:**

- `items: readonly SequenceStripItem[] = []` (attribute: false) — `{ readonly id, readonly
categoryId, readonly marker?, readonly label? }`;
  `marker` renders a small bottom marker on that cell independent of the category color (e.g. a
  subagent-dispatched turn); `label` is per-item hover/focus tooltip text _and_ that cell's own
  `role="listitem"` accessible name, falling back to the matching category's own nonblank `label`,
  then localized `sequenceStripUnnamedCategory` (`"Unnamed category"` in the built-in English
  catalog) when unset — it is not read by `[part="base"]`'s auto-generated `aria-label`, which
  summarizes by category/count only
- `categories: readonly SequenceStripCategory[] = []` (attribute: false) — `{ readonly id,
readonly color, readonly label? }`; `color`
  is the cell background for every item whose `categoryId` matches `id`; invalid CSS colors,
  declaration-breaking input, `url()`, and unmatched categories render `transparent`. `label` is
  used in the auto-generated `aria-label` summary and as the hover-tooltip fallback text, falling
  back to localized `sequenceStripUnnamedCategory` when omitted or blank rather than exposing the
  internal `id`. Both collection properties are cloned and frozen at assignment,
  bounded to the first 10,000 source entries, and require reassignment after changes; empty/blank
  ids are omitted and duplicates use the first valid entry, so identity is deterministic
- `accessibleLabel?: string` (attribute `accessible-label`) — overrides the auto-generated
  `aria-label` (a per-category "label: count" summary, e.g. `"Text: 2, Tool: 1"`). Unset computes the
  summary from `items`/`categories`; a standard host `aria-label` remains a distinct host name
- `showLegend: boolean = false` (attribute `show-legend`, reflected) — renders a static
  `[part="legend"]` key below the strip, one swatch + label row per `categories` entry, in array
  order. The key describes the _scheme_, not the current data: a category with no matching item
  still gets a row, and an item whose `categoryId` matches no entry adds none. Deliberately
  non-interactive — it toggles nothing and emits nothing (`lr-graph-legend` is the interactive,
  filtering legend). Because it only repeats the category names `[part="base"]`'s own `aria-label`
  summary already announces, the legend is `aria-hidden` — visible on screen, announced exactly
  once — and it wraps onto further rows in a narrow allocation rather than overflowing
- `markerLabel?: string` (attribute `marker-label`) — names what an item's `marker` _means_ (e.g.
  `"Subagent"`). Setting it does two things: with `showLegend` on it adds one trailing
  `[part="legend-item"]`, whose `[part="legend-marker-swatch"]` reproduces the cell's own marker
  treatment, and it adds the marker to the auto-generated `aria-label` summary, which is otherwise
  per-category only. The marker count is reported as its own clause rather than folded into any
  category's count. Unset (the default) changes nothing: no extra legend row, no extra summary clause

- `selectedIndex: number = -1` (attribute `selected-index`) — the currently selected item, or `-1`
  for none. **Controlled:** activating a cell emits `lr-item-activate` and does *not* move the
  selection itself, so the consumer stays the single source of truth and the strip cannot drift from
  a playback index it does not own (its natural companion is `lr-sequence-playback`). Mirrors the
  shape `lr-lite-chart`'s `selectedIndices` and `lr-heatmap`'s `selectedCell` already establish. An
  out-of-range or non-integer value selects nothing. The selected cell carries `aria-current="true"`
  and `data-selected`; the selection is drawn as a ring rather than a background change, because a
  cell's background is data (its category colour) and tinting it would misreport the category

The single-member `orientation: 'horizontal'` property was **removed in 9.0.0**: nothing read it and
the stylesheet never mentioned it, so the reflected attribute styled nothing. Delete the attribute;
the strip has always laid out horizontally.

**Events:** `lr-item-activate` — `detail: { index: number; id: string; item: SequenceStripItem }`,
fired when a cell is clicked or activated with Enter/Space on the roving-tabindex focus. Not
cancelable: nothing in the component branches on `defaultPrevented`. Bubbles and composed, like every
library event.

**Slots:** none.

**CSS parts:** `base` (the root strip, `role="list"`), `cell` (each item's `role="listitem"` cell,
background-colored by its category, carrying the roving `tabindex`, and activatable by click or
Enter/Space — it has a pointer cursor plus paired hover/press treatments, and `[data-selected]` when
it is `selectedIndex`), `marker` (the small bottom
marker on a cell whose item sets `marker: true`), `tooltip` (the detail tooltip showing the active
item's label, hidden until a cell is hovered or focused),
`legend` (the static category key rendered below the strip when `showLegend` is set — `aria-hidden`,
as it repeats the strip's own `aria-label`), `legend-item` (one swatch + label pair, one per
`categories` entry, plus one trailing marker row when `markerLabel` is set), `legend-swatch` (the
color chip, matching that category's cell color), `legend-marker-swatch` (the marker row's chip
instead: a neutral chip carrying the same bottom bar a `marker: true` cell paints, in the same
`--lr-sequence-strip-marker-color`), `legend-label` (the category's nonblank `label`, or localized
`sequenceStripUnnamedCategory`), `window-range` (bounded item projection/total), and `legend-limit`
(bounded legend/total).

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
  const strip = document.querySelector("lr-sequence-strip");
  strip.categories = [
    { id: "text", color: "#4f46e5", label: "Text" },
    { id: "tool", color: "#16a34a", label: "Tool" },
  ];
  strip.items = [
    { id: "1", categoryId: "text", label: "Turn 1: text" },
    { id: "2", categoryId: "tool", marker: true, label: "Turn 2: tool call" },
    { id: "3", categoryId: "text", label: "Turn 3: text" },
  ];
</script>
```

**Known gotchas:**

- the activation event is `lr-item-activate`, not `lr-cell-click`. Click and Enter/Space emit the
  activated item's `index`/`id`, but do not mutate the controlled `selectedIndex`; listen for the
  event and update that property when the application accepts the activation.
- an `items` entry whose `categoryId` has no matching `categories` entry still renders its own cell
  (background `transparent`) rather than being dropped, so a strip stays the same length as `items`
  regardless of `categories` coverage.
- **9.0 migration:** rename category `{ key }` to `{ id }` and item `{ category }` to
  `{ categoryId }`. Reassign after changes; caller mutation no longer changes the installed
  snapshot. Category clauses use effective-locale `Intl.ListFormat` punctuation.

---

## `lr-tree` / `lr-tree-item`

An expand/collapse hierarchy (document/graph navigation tree). Mirrors `wa-tree`/`wa-tree-item` and
`sl-tree`/`sl-tree-item`.

**Renamed in 8.0.0 — breaking:** the child element is `<lr-tree-item>` (class `LyraTreeItem`), not
`<lr-tree-node>`/`LyraTreeNode`. It was the only child element in the library whose tag diverged
from both upstreams, so `wa-tree-item`/`sl-tree-item` markup had nothing to rename to. The shared
data types moved to `tree-types.ts` to free the name and are still re-exported from `tree.js`. A
leftover `<lr-tree-node>` is an unregistered tag: it never
upgrades, `<lr-tree>` does not count it as an item at all, and the tree renders its empty state
with the stale markup sitting inert in the light DOM — no error anywhere.

**9.0 type/API cleanup:** rename the structured-data type `TreeItem` to `LyraTreeNodeData`, use
`LyraVariant` for `TreeBadge.tone` instead of `TreeBadgeTone`, and replace a singular `badge` value
with `badges: [{ text: String(value) }]`. The former item-controller fields (`activeId`, `ancestry`,
`depth`, `setSize`, `posInSet`) and context setters were never consumer state; they are now private
owner context maintained by `<lr-tree>`.

**Two child models are accepted, and they never interleave.**

- **Declarative** (mirrors the upstream markup, so a tag rename is the whole migration): write
  nested `<lr-tree-item>` elements as light-DOM children, each carrying its own
  `label`/`expanded`/`disabled`/`selected` attributes. `<lr-tree-item>` moves its nested children
  onto an internal `children` slot itself, so you never write `slot=`.
- **Data**: leave `<lr-tree>` empty and assign `data`, a `LyraTreeNodeData[]` of plain objects. This is this
  library's own original shape and is where per-row icons, secondary descriptions and badges live —
  the declarative model has none of those. `<lr-tree>` creates and reconciles the
  `<lr-tree-item>` children by `id`, and each item renders its own subtree into its own shadow root.
  Every reachable `LyraTreeNodeData.id` must be nonblank and globally unique. Malformed rows and
  later duplicates are omitted before rendering; the first valid depth-first occurrence wins
  and cannot receive focus, selection, expansion, or reorder requests. Supplying unique refreshed
  data releases that fail-closed state.

A tree containing any author-written `<lr-tree-item>` child is read purely as the declarative model
and `data` is ignored. The empty state renders only when neither model has any items.

Both child models use the same selection, roving-focus, checkbox-cascade, icon, and lazy-loading
engine. The upstream lifecycle names are normalized to the library-wide `lr-` prefix;
`lr-node-toggle` and `lr-node-select` remain as additive Lyra notifications. In multiple modes the
tree role explicitly exposes `aria-multiselectable="true"` (and explicit `"false"` otherwise),
while each treeitem host is the sole selected/checked/mixed semantic owner; checkbox-shaped chrome
is decorative and cannot duplicate the row's accessible name.

### `lr-tree`

Implements the full WAI-ARIA treeitem keyboard pattern: a single owner-controlled roving `tabindex`
across every reachable `<lr-tree-item>` and
ArrowUp/Down/Right/Left/Home/End/Enter/Space handled by one delegated `keydown` listener (native
`KeyboardEvent`s are `composed: true` and bubble across shadow-DOM boundaries, so a press inside a
deeply-nested node's own shadow root still reaches it).

**Properties:**

- `data: readonly LyraTreeNodeData[] = []` (attribute: false) — the object child model; ignored
  while any author-written `<lr-tree-item>` child is present. Assignment installs a detached,
  recursively frozen snapshot: mutate caller data only before assignment, then reassign after
  changes. Normalization accepts at most 1,000 valid nodes and 64 descendant levels, never invokes
  caller accessors, and exposes `dataTruncated = true` when malformed or over-budget input was
  omitted. Collapsed branches do not instantiate descendants; disclosure projects only normalized
  children while `aria-setsize` preserves the declared sibling count. `LyraTreeNodeData` is
  `{ readonly id: string; readonly label: string; readonly children?: readonly LyraTreeNodeData[];
readonly selected?: boolean; readonly disabled?: boolean; readonly lazy?: boolean; readonly
badges?: readonly TreeBadge[]; readonly icon?: unknown; readonly description?: string; readonly
accessibleLabel?: string }`. `TreeBadge` is `{ readonly text: string; readonly tone?:
LyraVariant; readonly label?: string }`. `badges` renders tone-mapped chips in order. A nonempty
  `label` makes that chip a named `img`; when the override is omitted or empty, no generic role or
  redundant `aria-label` is added and the visible `text` contributes to the treeitem name naturally.
  `icon` renders as a decorative leading visual, `description` as secondary visible row text, and
  `accessibleLabel` names the `role="treeitem"` host without changing its visible label. An
  author-supplied host `aria-label` takes precedence by presence and is never overwritten or
  removed by later object refreshes; removing the author attribute restores the current data name.
  `id` is the event, roving-focus, reconciliation, and reorder identity and must be unique across
  the complete reachable hierarchy; malformed/blank rows and later duplicates are omitted as described above
- `selection: 'single'|'multiple'|'leaf'|'leaf-multiple' = 'single'` — self-managed selection for
  both child models. `single` selects one item; `leaf` selects one loaded leaf; `multiple` displays
  checkboxes and cascades through enabled descendants; `leaf-multiple` applies that cascade only
  to leaves. Partially-selected branches expose `indeterminate`
- `label: string = ''` — accessible-name fallback for the tree; `role="tree"` lives on an internal
  `[part="base"]` element. A host `aria-label` takes precedence by attribute presence, including an
  explicit empty string; removing it restores the `label` fallback. External `aria-labelledby`
  idrefs are not forwarded across the shadow boundary.
- `reorderable: boolean = false` (reflected) — opts into keyboard reordering. Unset, no `lr-reorder`
  is ever emitted, Ctrl/Cmd+Arrow behaves exactly like a plain Arrow press, and the internal live
  region is not rendered at all.

**Read-only getters:** `selectedItems: readonly LyraTreeItem[]` returns a new frozen snapshot of
selected item elements in document order, including derived fully-selected parents in either
multiple mode. `dataTruncated: boolean` reports bounded/malformed normalization as described above.

**Keyboard:** ArrowDown/ArrowUp move the roving focus to the next/previous _visible_ node.
ArrowRight expands a collapsed node (focus stays put; a second ArrowRight then steps into the first
child) or moves into an already-expanded node's first child. ArrowLeft collapses an expanded node, or
moves focus to its parent. Home/End jump to the first/last visible node. Enter/Space activate
`select()` on the focused node. While `reorderable`, **Ctrl/Cmd**+ArrowUp/ArrowDown moves the focused
node within its own parent's child list instead of navigating. Ctrl/Cmd rather than Alt: Alt+Arrow is
browser back/forward on Windows and Linux. ArrowUp/ArrowDown are not direction-sensitive, so this
binding is deliberately **not** RTL-swapped — "down" always means later in the sibling list.
If a same-id data refresh disables an expanded branch, that reused branch collapses immediately;
enabled descendants are never left visibly stranded outside this navigation walk.

**`inert` excludes an item and its whole subtree from that walk, exactly as `disabled` does.**
`role="treeitem"` and the roving `tabindex` both live on the `<lr-tree-item>` host itself, so an
inert item literally refuses `focus()` — stepping the roving index onto one would leave focus behind
on `<body>` and kill every later arrow press. Marking the focused item inert therefore moves the
roving stop to the next reachable row instead of stranding it, and the state is observed live
(`attributeFilter: ['selected', 'disabled', 'inert', 'lazy']`). Two deliberate limits:

- **Only inertness _inside_ the tree counts** — the item's own `inert`, or that of an ancestor item
  between it and the `<lr-tree>`. An inert ancestor _outside_ the tree (the page behind an open
  modal) inerts every item uniformly, and excluding them all would empty the walk, null out
  `activeId`, and leave the tree with no `tabindex="0"` stop for anything to restore once the dialog
  closes. That case needs no handling: focus cannot be inside the tree at all.
- **Selection ignores it.** An inert subtree is temporarily non-interactive, not deselected, so
  `selectedItems` and the multiple-mode cascade are unchanged and a modal that inerts the page can
  never silently wipe a tree's selection.

**Methods:** `expandAll(): Promise<void>`, `collapseAll(): Promise<void>` (both iterative, bounded,
and resolved only after the affected rendered item cascade settles).

**Events:** `lr-selection-change` (`detail: { selection }`, where both the detail and selection
snapshot are frozen) and `lr-reorder` (`detail: { nodeId, parentNodeId, fromIndex, toIndex }`, only while `reorderable`).
Like every other event here it is a **request**: `data` is host-owned and is never mutated by this
component, so nothing moves until the host reassigns a reordered `data` — focus then follows the
moved node. The live region likewise announces a completed move only after the rendered sibling
order confirms the exact requested swap. Ignored or rejected requests stay silent, and unrelated
updates do not prematurely discard an asynchronously persisted request. `parentNodeId` is `null` for a
top-level item, and `fromIndex`/`toIndex` are **sibling-scoped
indices**, not positions in the flattened visible list. The move is constrained to one sibling list
and never fires at a subtree boundary, so a reorder can never become a reparent: Ctrl+ArrowDown on
the last child of a subtree is ambiguous (the visually next row is a top-level uncle, so "move down"
could mean either "swap with the next sibling" — there is none — or "reparent up a level"), and
reparenting is a structural edit with no keyboard affordance distinguishing the two. Such a request
is simply not made: no event, no announcement, focus stays put. Item events listed below bubble
through the tree as well.

**Slots:** default — top-level `<lr-tree-item>` elements, each nesting its own children (the
declarative model). Leave it empty and assign `data` for the object model; the same slot then holds
the items `<lr-tree>` generates. `expand-icon` and `collapse-icon` provide tree-wide disclosure
icons; an item-level slot with the same name takes precedence.

**CSS parts:** `base` and `tree` are aliases on the same `role="tree"` root; `empty` is the
empty-state message shown when neither child model has any items.

**Themeable custom properties:** shared tokens `--lr-space-xs`/`-s`, `--lr-color-brand-quiet`,
`--lr-color-text-quiet`, `--lr-color-border`, `--lr-color-text`, `--lr-radius`,
`--lr-focus-ring-*` (row `:focus-visible` ring, driven by `:host(:focus-visible)` since the host
itself is the focusable `role="treeitem"`), plus `--indent-size`, `--indent-guide-color`,
`--indent-guide-offset`, `--indent-guide-style`, and `--indent-guide-width`.

**Optional peer deps:** none.

### `lr-tree-item`

One row of the tree, in either child model. `role="treeitem"` (plus
`aria-expanded`/`aria-level`/`aria-setsize`/`aria-posinset`/`aria-selected` and the roving
`tabindex`, driven by `<lr-tree>`) live on the _host_ element itself, not an internal row `<div>` —
so this node's own nested children (whether rendered in its own shadow root or projected from the
light DOM, as further `role="group"` content) are genuine DOM descendants of the treeitem, matching
the WAI-ARIA treeitem pattern's containment expectation.

**Properties — declarative model** (write these as attributes; `item` data seeds the matching state
when assigned):

- `label: string = ''` — the row's label, used only when nothing is slotted into the default slot
- `disabled: boolean = false` (reflected) — removes the item from roving focus and blocks
  select/toggle activation
- `selected: boolean = false` (reflected) — renders the selected state and is exposed as
  `aria-selected`
- `lazy: boolean = false` (reflected) — defers expansion, renders the spinner, and emits
  `lr-lazy-load` until children arrive or `lazy` is cleared

**Properties — data model:**

- `item?: LyraTreeNodeData` (attribute: false) — the whole subtree as one object, normally assigned by
  `<lr-tree>` from its `data`. An assigned `item` **wins** for label/disabled/children and seeds
  `selected`/`lazy`; a refreshed object identity re-seeds those values. Light-DOM children are
  ignored while `item` is assigned. Outside an owning tree, an omitted `item.selected` leaves
  `aria-selected` off the host; an owning tree always publishes explicit true/false state. Assign
  `undefined` to return safely to the declarative model and reset data-seeded selected/lazy state

**Properties — shared:**

- `expanded: boolean = false` (reflected)
- `loading: boolean` (read-only) — a lazy expansion is waiting for children
- `indeterminate: boolean` (read-only) — an enabled branch has some but not all selectable
  descendants selected

**Read-only getters** — each answers for whichever child model is in use, which is what lets
`<lr-tree>` drive both with one implementation:

- `nodeId: string` — this item's identity: `item.id` in the data model, or a generated per-element
  id in the declarative one (where the markup carries no id of its own). It is the `nodeId` every
  `lr-node-toggle` / `lr-node-select` / `lr-reorder` detail carries, and what the tree tracks its
  roving tabindex by
- `isDisabled: boolean` — `item.disabled` in the data model, the `disabled` property in the
  declarative one
- `nodeLabel: string` — this item's spoken name, used for the tree's reorder announcements: a host
  `aria-label` is authoritative in both models; otherwise `item.accessibleLabel || item.label` in
  the data model, or flattened accessibility-visible slotted label text (nested items excluded)
  followed by the `label` fallback in the declarative one. Direct and forwarding-slot
  text/ARIA/visibility mutations update the name
- `hasChildren: boolean` — whether this node has at least one child in whichever model is in use.
  Leaf nodes never expose `aria-expanded` and cannot expand or collapse. It also reports `false`
  past the owner controller's 64-level bound, which stops runaway recursion; cyclic object graphs
  are detected by private ancestry identity

**Methods:** `expand()`, `collapse()` (each a no-op if already in that state, disabled, loading, or a leaf),
`select()` (fires `lr-node-select`; a no-op while disabled), and host `click()` (forwards exactly
once to the same selection path and is likewise disabled-gated). `childItems(): LyraTreeItem[]` returns
this node's **direct** child `<lr-tree-item>` elements — from its own shadow root in the data model,
from its own light-DOM children in the declarative one. A grandchild is not included; it lives under
its own parent. `getChildrenItems({ includeDisabled = true } = {})` is the upstream-compatible
public spelling over the same direct-child list.

**Events:** `lr-node-toggle` (`detail: { nodeId, expanded }`, fired by `expand()`/`collapse()` — via
the toggle button or ArrowRight/ArrowLeft), `lr-node-select` (`detail: { nodeId }`, fired by `select()`
— via clicking anywhere in the row or Enter/Space) — dispatched from `lr-tree-item`,
bubble/compose up through `lr-tree`'s light DOM. `lr-expand`/`lr-collapse` fire when a transition
begins; `lr-after-expand`/`lr-after-collapse` fire after the matching themeable duration. Rapid
opposite transitions and disconnects invalidate stale after-events. Collapse keeps the subtree
mounted through its real opacity animation and removes it only when the animation completes;
reduced motion settles immediately, and duration parsing is finite/nonnegative/timer-capped.
`lr-lazy-load` requests data
with `detail: { item, generation }`; `lr-lazy-change` reports `detail: { item, loading }` when the
pending state starts or ends. Disabling or disconnecting an item invalidates the pending generation.

**Slots:** default — the row's label content in the declarative model. `children` — where nested
`<lr-tree-item>` children are projected; **assigned by the component**, so write the nested items in
the default slot and never set `slot="children"` yourself. `expand-icon` and `collapse-icon`
override the owning tree's corresponding icon for one item. The label/children slots are unused in
the data model.

Visual slot selection is separate from `nodeLabel` extraction: flattened element-only and visible
`aria-hidden` content still chooses the authored slot instead of the `label` fallback, while hidden
content is omitted from the spoken name. Host `aria-label` remains authoritative by presence.

**CSS parts:** `base` and `tree-item` are aliases on the same outer wrapper around the row and child
group; `row`, `toggle`, `icon`, `content`, `label`, `description`, `badge`, `group`, `item`,
`item--disabled`, `item--expanded`, `item--indeterminate`, `item--selected`, `indentation`,
`expand-button`, `spinner`, `spinner__base`, `children`, `checkbox`, `checkbox__base`,
`checkbox__control`, `checkbox__control--checked`, `checkbox__control--indeterminate`,
`checkbox__checked-icon`, `checkbox__indeterminate-icon`, and `checkbox__label`. `badge`
is applied to every `item.badges` chip; chips carry
`data-tone="neutral|brand|success|warning|danger"`. `icon` is `aria-hidden="true"`; `content`
groups the primary label and optional wrapping secondary description while preserving one
interactive treeitem per row. `icon`, `description` and `badge` render only in the data model —
the declarative model has no icon/description/badge inputs, so a row written as markup renders
`row`/`toggle`/`content`/`label` (and `group` while expanded) and nothing else.
`item` and its four state aliases are real painted row containers: consumer background, border,
padding, and opacity rules reach the visible row rather than a boxless wrapper.
The enabled disclosure `toggle` has its own pointer-hover feedback in addition to the row's hover
treatment; disabled toggles remain visually inert.
In the data model, every recursively rendered child forwards this complete part list under the
same names, so one selector on the outer item, such as `lr-tree-item::part(row)`, reaches matching
parts at every rendered depth. Declarative children remain light-DOM hosts and can be matched
directly as `<lr-tree-item>` elements.

**Themeable custom properties:** `--indent-size` (default `var(--lr-space-l)`, applied once per
nesting depth), `--indent-guide-color` (default `var(--lr-color-border)`),
`--indent-guide-offset` (default `0`, the guide's block-axis inset at both ends),
`--indent-guide-style` (default `solid`), and `--indent-guide-width` (default `0`); these mirrored
properties are consumed directly by every `<lr-tree-item>` and may be set on an item or inherited
from `<lr-tree>`. `--lr-tree-depth` is internal and set inline per row for indentation;
`--show-duration`/`--hide-duration` both default through `--lr-duration-base`;
`--lr-tree-selected-color` and `--lr-tree-selected-bg` for the selected row; and paired
`--lr-tree-checkbox-checked-border-color`, `--lr-tree-checkbox-checked-bg`,
`--lr-tree-checkbox-checked-color`, `--lr-tree-checkbox-indeterminate-border-color`,
`--lr-tree-checkbox-indeterminate-bg`, and `--lr-tree-checkbox-indeterminate-color` independently
theme the two multiple-selection checkbox states (brand border/background and on-brand glyph
fallbacks); and paired
`--lr-tree-badge-{neutral|brand|success|warning|danger}-color` /
`--lr-tree-badge-{neutral|brand|success|warning|danger}-bg` properties for each badge tone. Each
badge property falls back to its corresponding shared semantic token. The expanded names are
`--lr-tree-badge-neutral-color`, `--lr-tree-badge-neutral-bg`, `--lr-tree-badge-brand-color`,
`--lr-tree-badge-brand-bg`, `--lr-tree-badge-success-color`, `--lr-tree-badge-success-bg`,
`--lr-tree-badge-warning-color`, `--lr-tree-badge-warning-bg`, `--lr-tree-badge-danger-color`,
and `--lr-tree-badge-danger-bg`.

**Optional peer deps:** none.

The data model — icons, descriptions and badges live here:

```html
<lr-tree></lr-tree>
<script>
  document.querySelector("lr-tree").data = [
    {
      id: "1",
      label: "Root",
      description: "Two child documents",
      accessibleLabel: "Root, two child documents",
      icon: document.createTextNode("◇"),
      children: [
        { id: "1a", label: "Child A" },
        { id: "1b", label: "Child B", badges: [{ text: "3" }] },
      ],
    },
  ];
</script>
```

The declarative model — the same shape a renamed `wa-tree`/`sl-tree` subtree lands in, with no
`slot=` anywhere and no `data` assignment:

```html
<lr-tree label="Documents">
  <lr-tree-item label="Root" expanded>
    <lr-tree-item label="Child A"></lr-tree-item>
    <lr-tree-item label="Child B" disabled></lr-tree-item>
  </lr-tree-item>
</lr-tree>
```

**Known gotchas:**

- all four previously-known ARIA gaps in this pair are fixed: the treeitem row is now genuinely
  keyboard-operable with a roving tabindex and full arrow-key navigation (not just the expand/collapse
  button); the expanded-children `role="group"` is now a real DOM descendant of its `role="treeitem"`
  host rather than a shadow-DOM sibling; by-id reconciliation (preserving `expanded` state across
  data reassignment) now applies at every depth via a keyed `repeat()`, not just depth 0; and
  `role="tree"` now has an accessible name via the new `label` property.
- `lr-tree`'s `getUpdateComplete()` cascades through owner-controlled descendants
  `<lr-tree-item>`'s own `updateComplete` (see `update-cascade.ts`) so that code awaiting the
  tree's `updateComplete` does not run before a reachable nested node has finished rendering its
  roving `tabIndex`. The same 64-level/1,000-node work bounds apply to context, focus, selection,
  and disclosure walks.
- row enrichment is intentionally structured rather than an unrestricted renderer: use `icon`,
  `label`, `description`, `badges`, and `accessibleLabel`. This keeps the host as the single
  `role="treeitem"` interaction target and preserves the APG keyboard model.
- `lr-file-tree` does **not** forward `reorderable`, and deliberately so: its `LyraTreeNodeData[]` is derived
  from `nodes` on every render and keyed by filesystem path, an order it does not own.
- in the declarative model, appending a child while the parent is collapsed still registers: a
  `childList` MutationObserver assigns the `children` slot and requests an update, because
  `slotchange` alone cannot see a child added to a slot that is not currently rendered. Editing a
  label in place is picked up the same way.
- a declarative row whose default slot holds only whitespace around its nested items still shows the
  `label` attribute — indentation does not count as slotted label content, which is what makes the
  common `<lr-tree-item label="…">` + nested-children shape render its label.

---

## `lr-flow-canvas`

A pannable/zoomable DAG workflow canvas: positions HTML node cards, draws SVG edges between their
handles, runs a shared layered auto-layout for unpositioned nodes, and owns all selection/drag/
connect interaction. It is readonly by default; opt into editor gestures with `nodes-draggable`,
`connectable`, and `droppable`. The component snapshots model inputs instead of retaining mutable
caller aliases, and reports edit intent for the host to apply.

Flow records and companion payloads are readonly public contracts. Consumers that need the types
without registering a component can import them from the side-effect-free module:

```ts
import type {
  FlowEdge,
  FlowHandle,
  FlowLayoutChangeDetail,
  FlowNode,
  FlowRunDecoration,
  FlowRunDecorations,
  FlowStructureSnapshot,
} from "@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js";
```

**Properties:**

- `nodes: readonly FlowNode[] = []` (attribute: false) — each record has readonly `id`, optional
  `type`, `position`, `data`, `accessibleLabel`, `inputs`, and `outputs`. A missing `position` opts
  into layered layout. String `data.label` and `data.description` feed the declarative fallback
  card. Assignment takes a detached, deeply frozen snapshot of plain arrays/records, omitting blank
  ids and later duplicates first-wins before layout, focus, selection, gestures, companion
  snapshots, and events. At most the first 10,000 source nodes are retained, with finite nested
  depth/entry budgets; reassign `nodes` after changes. Replacing the model cancels node-drag and
  connect gestures whose ids belonged to the old model and silently prunes selected ids that no
  longer exist.
- `edges: readonly FlowEdge[] = []` (attribute: false) — readonly `id`, `source`, `target`, optional
  handle ids, optional drawn `label`, and optional `tone: LyraVariant`. The canonical brand value is
  `brand`; the former `accent` value and `FlowEdgeTone` alias are not part of this contract. Blank
  ids and later duplicates are omitted first-wins before render, focus, selection, gestures,
  companion snapshots, and events. At most the first 10,000 source edges are retained, with finite
  nested depth/entry budgets; reassign `edges` after changes. Dangling endpoint references remain
  visible through the component's documented fail-closed edge-list/stub paths.
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected) — downstream layout/handle axis
- `nodesDraggable: boolean = false` (attribute `nodes-draggable`)
- `connectable: boolean = false`
- `droppable: boolean = false` — accepts drops carrying the `FLOW_PALETTE_MIME_TYPE` payload a
  `lr-node-palette` drag sets, emitting `lr-node-add`. The decoded payload must be a plain record
  with a non-empty string `type`; text fields and total payload size are bounded.
- `locked: boolean = false` (reflected) — freezes pan/zoom/drag/connect without touching the other
  gesture flags. Enabling it during a pan, node drag, pointer/keyboard connection, or palette drop
  cancels the active preview, rolls pan/node geometry back, clears transient state, and retires the
  window pointer listeners so a later release cannot commit.
- `selectedNodeIds: readonly string[] = []`, `selectedEdgeIds: readonly string[] = []` (attribute:
  false) — seed or replace selection. Each assignment snapshots at most the first 10,000 ids,
  omits blank/later duplicates first-wins, and prunes identities absent from the current canonical
  node/edge model. Reassign after changes. Activation and clear-selection gestures update frozen
  arrays before emitting `lr-selection-change`; model shrinkage prunes stale ids without claiming
  a user selection gesture occurred.
- `minZoom: number = 0.25` (attribute `min-zoom`), `maxZoom: number = 2` (attribute `max-zoom`)
- `grid: number = 8` — snap step in content px for drags/nudges/drop positions (`0` disables
  snapping); also the dotted background's base spacing
- `layerGap: number = 64` (attribute `layer-gap`), `nodeGap: number = 24` (attribute `node-gap`) —
  auto-layout layer/sibling spacing. The canvas measures rendered cards in layout space before its
  first pass; live changes to orientation, gaps, or card size trigger a new pass.
- `decorations: FlowRunDecorations | null = null` (attribute: false) —
  `Record<nodeOrEdgeId, FlowRunDecoration>`, where `FlowRunDecoration` has `status` plus optional
  `progress`, `durationMs`, and `detail`; assignment is detached, deeply frozen, bounded to 10,000
  keys plus finite nested depth/entry budgets, and invalid status entries are omitted. Reassign the
  record after changes. Usually supplied by `lr-flow-run-status`.
- `accessibleLabel: string | null = null` (attribute `aria-label`)
- `viewport` (readonly getter) — a frozen `{ x, y, zoom }` snapshot

**Methods:** `setViewport({ x, y, zoom })`, `zoomIn()`, `zoomOut()`, `resetZoom()`,
`fit(options?: { padding?: number })` (frames every node), `focusNode(id, options?: { zoom? })`
(pans/zooms to one node and moves roving focus onto it), `toContentPoint(clientX, clientY)` (maps a
pointer position to content coordinates, RTL-aware), `registerCompanion(cb: (snapshot:
FlowStructureSnapshot) => void): () => void` — the subscription `lr-flow-minimap` uses to read
live node/edge/viewport geometry without this canvas ever importing the minimap.
All viewport-mutating methods, including `focusNode()`, are inert while `locked`; coordinate mapping
and companion subscription remain available because neither mutates viewport or edit state.
Each companion observer receives its own deeply frozen `FlowStructureSnapshot`: readonly node and
edge geometry/status arrays, viewport `{ x, y, zoom, width, height, minZoom, maxZoom }`, and the
effective `locked`, `orientation`, `layerGap`, and `nodeGap`. Zoom bounds are finite, positive, and
sorted even when public inputs are invalid or reversed.

**Events:** `lr-node-activate` (`detail: { nodeId }`), `lr-edge-activate` (`detail: { edgeId, source, target
}`), `lr-selection-change` (`detail: { nodeIds, edgeIds }`), `lr-node-move` (`detail: { nodeId,
position, previous }`), `lr-connect` (`detail: { source, target, sourceHandle, targetHandle }`),
`lr-node-add` (`detail: { type, position }`, from a palette drop), `lr-selection-delete`
(`detail: { nodeIds, edgeIds }`), `lr-viewport-change` (`detail: { x, y, zoom }`),
`lr-layout-change` (`detail: { positions, truncated }`, fired after an auto-layout pass places
previously unpositioned nodes). Every detail and nested coordinate/array is readonly and frozen.

**Slots:** default (consumer-authored cards matched by `node-id` and assigned to generated
`node-{id}` slots), `top-start`, `top-end`, `bottom-start`, `bottom-end`. Each node always has a
declarative shadow-DOM fallback card, so SSR and hydration do not depend on imperative light-DOM
card creation. An authored card replaces only its matching fallback; unmatched cards are unslotted
with a warning. Opposite-side companion slots share wrapping rails in narrow allocations.

**CSS parts:** `base`, `viewport`, `background`, `edges`, `edge`, `edge-label`, `edge-hit-area`,
`arrowhead`, `stub`
(a dangling-edge stub line), `connection-line` (in-progress connect gesture), `node`, `empty`,
`node-control` (the native per-node roving/activation control), `live-region`, `edge-list` (a
visually hidden list only for dangling/unrenderable edges), `layout-limit` (a visible notice whose
announcement uses the shared light-DOM polite sink), `overlay-rail`, and the
fallback-card parts `node-card`, `node-card-base`, `node-card-surface`, `node-card-header`,
`node-card-heading`, `node-card-status`, `node-card-progress`, `node-card-body`, `node-card-toolbar`,
`node-card-handle`, `node-card-handle-input`, and `node-card-handle-output`. A node whose `type`
normalizes to a safe part token also exposes `node-type-{value}`. A selected node wrapper carries
`data-selected`; its hidden `node-control` exposes the state as `aria-pressed`.

`live-region` is a visually hidden, `aria-hidden` mirror of the latest item/gesture message. The
actual messages are flushed to the document's shared light-DOM polite sink; mount is silent, and
identical repeated messages are appended as separate announcements.

**Themeable custom properties:** `--lr-canvas-reserved-height` (default
`var(--lr-size-24rem)`) controls the host's default block size and matches the pre-upgrade
reservation stylesheet; an explicit outer `block-size` still wins. `--lr-flow-canvas-grid-size`
(default: the finite `grid` property, or `8px`; dotted background spacing) can be set on the canvas
or a theme ancestor to override that property-derived fallback. Each edge tone colors its stroke
and the arrowhead marker it references:
`--lr-flow-canvas-edge-neutral-color` (default `var(--lr-color-border)`),
`--lr-flow-canvas-edge-brand-color` (default `var(--lr-color-brand)`),
`--lr-flow-canvas-edge-success-color` (default `var(--lr-color-success)`),
`--lr-flow-canvas-edge-warning-color` (default `var(--lr-color-warning)`), and
`--lr-flow-canvas-edge-danger-color` (default `var(--lr-color-danger)`).
`--lr-flow-canvas-march-duration` (default
`var(--lr-duration-ambient)`, running-edge march animation duration; this is a time-only value, not
the `--lr-transition-ambient` duration/easing shorthand, because the animation supplies its own
`linear` timing function), and
`--lr-flow-canvas-node-selected-outline-color` (default `var(--lr-color-brand)`) controls the
selected-node outline. It is an inherited inline fallback, so it can be set on the canvas or a theme
ancestor without retinting the library-wide brand token. The same pattern applies to:
`--lr-flow-canvas-node-connect-invalid-outline-color` (default `var(--lr-color-danger)`) — outline of
a node that is an invalid connect-gesture drop target; `--lr-flow-canvas-node-connect-target-outline-color`
(default `var(--lr-color-brand)`) — outline of a node that is a valid connect-gesture drop target; and
`--lr-flow-canvas-drop-active-outline-color` (default `var(--lr-color-brand)`) — outline of the
viewport itself while a palette item is dragged over it (`droppable`). A fifth,
`--lr-flow-canvas-node-hover-outline-color` (default `var(--lr-color-border-strong)`) — the
mouse-hover preview of a node's own `:focus-visible` ring — exists for a different reason than the
four above. Set it to `transparent` to opt out of the hover treatment.

**Optional peer deps:** none.

```html
<lr-flow-canvas
  id="canvas"
  nodes-draggable
  connectable
  droppable
  style="height:480px"
>
  <lr-flow-controls slot="bottom-start" for="canvas"></lr-flow-controls>
  <lr-flow-minimap slot="bottom-end" for="canvas"></lr-flow-minimap>
  <lr-flow-run-status slot="top-start" for="canvas"></lr-flow-run-status>
</lr-flow-canvas>
<script>
  const canvas = document.getElementById("canvas");
  canvas.nodes = [
    { id: "a", data: { label: "Fetch" } },
    { id: "b", data: { label: "Transform" } },
  ];
  canvas.edges = [{ id: "a-b", source: "a", target: "b" }];
  canvas.addEventListener("lr-node-move", (e) => {
    canvas.nodes = canvas.nodes.map((n) =>
      n.id === e.detail.nodeId ? { ...n, position: e.detail.position } : n
    );
  });
</script>
```

**Known gotchas:**

- `nodes` and `edges` are controlled inputs: move, connect, add, and delete events are requests the
  host applies back. Selection is hybrid state: `selectedNodeIds`/`selectedEdgeIds` accept external
  replacement, while node/edge activation and clear-selection gestures update them internally and
  emit `lr-selection-change`.
- Auto-layout (via the dependency-free `layeredLayout()` util) only ever positions nodes that are
  missing an explicit `position`; a node the host has already positioned is left exactly where it is
  and, when its resolved center is nonnegative and within the safe-integer range, is used as a fixed
  anchor for the rest of the layout pass. Negative and larger finite coordinates remain rendered
  and caller-controlled but are omitted from the bounded utility's fixed-anchor input. The utility
  bounds virtual ordering work. If that ceiling is reached, the canvas renders a localized `layout-limit` status and sets
  `lr-layout-change.detail.truncated` to `true`; positions remain usable. Call the public utility
  directly with `maxVirtualWaypoints` when an application needs a different work ceiling.
- `droppable` only accepts drags carrying the exact `FLOW_PALETTE_MIME_TYPE` MIME type a
  `lr-node-palette` drag sets — the two components can never disagree on the payload shape because
  they share one exported constant.
- Pan/drag/zoom track the pointer's physical direction; under an RTL ancestor the pan and node-drag
  deltas are mirrored so content still visually follows the cursor, matching every other
  RTL-mirrored surface in this library.

**Additional API surface:**

- `part="edge-hit-area"` — The transparent wide pointer target behind an edge.
- `part="node-control"` — The visually hidden, roving selection button for a node.
- `--lr-flow-canvas-node-selected-outline-color` — Outline color of a selected node. Default: `var(--lr-color-brand)`.

---

## `lr-flow-node`

The card a workflow node renders as: header/body/toolbar chrome, tool-lifecycle status tones, and
the named connection-handle elements edges anchor to. Used as `lr-flow-canvas`'s default card and
as a slotted override; also renders standalone (palette previews, docs). Purely presentational —
activation, selection, movement, and connection are all `lr-flow-canvas` events; this component
owns none of that.

**Properties:**

- `nodeId: string = ''` (attribute `node-id`, reflected) — identity used to match an authored card
  to a canvas node; the empty default leaves the attribute absent
- `flowType: string = ''` (attribute `data-node-type`, reflected) — consumer taxonomy forwarded by
  the canvas; use this stable hook or the canvas's normalized `node-type-*` part for type-specific
  presentation
- `heading: string = ''`
- `status: 'pending' | 'running' | 'success' | 'error' | 'denied' | null = null` (reflected)
- `progress: number | null = null` — renders a determinate `[part="progress"]` bar when set
- `statusDetail: string = ''` (attribute `status-detail`) — appended to the status line
- `durationMs: number | null = null` (attribute `duration-ms`) — formatted into the status line
- `selected: boolean = false` (reflected)
- `compact: boolean = false` (reflected) — tighter card padding for dense canvases and palette
  previews; the border, background, shadow and the `selected`/`status="running"` treatments all stay
- `inputs: readonly FlowHandle[] = [{ id: 'in' }]`, `outputs: readonly FlowHandle[] = [{ id: 'out'
}]` (attribute: false) — detached, frozen snapshots of at most the first 10,000 readonly
  `{ id, label? }` handles; blank ids and later duplicates are omitted first-valid/first-wins;
  reassign a collection after changes
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected) — which physical edge handles
  render on; mirrors the adopting canvas's own `orientation`

**Events:** none — purely presentational, activation/drag/connect all live on `lr-flow-canvas`.

**Slots:** default (body content), `icon` (leading header glyph), `header` (replaces the built-in
heading row entirely), `toolbar` (action row at the block-end edge; revealed by hover/focus on
hover-capable devices and always visible with a coarse pointer or no hover).

**CSS parts:** `base` (the row wrapping the input handles, the card and the output handles — it
carries no card chrome of its own), `card` (the bordered, filled node card), `header`, `icon`,
`heading`, `status` (never color-only — always paired with text), `progress`, `body`, `toolbar`,
`handle` (every handle dot), `handle-input`, `handle-output`.

**Themeable custom properties:** `--lr-flow-node-min-inline-size` (default `11rem`),
`--lr-flow-node-compact-padding` (default `var(--lr-space-xs)`) and `--lr-flow-node-compact-gap`
(default `var(--lr-space-2xs)`) — `[part="card"]`'s padding and row gap while `compact` — and
`--lr-flow-node-selected-outline-color` (default `var(--lr-color-brand)`) — the card's outline color
while `selected`. Like the other state-scoped custom properties here, it is an inline `var()`
fallback at its point of use rather than a `:host` declaration, so it can be set on the element _or any
ancestor_ (a canvas retunes every card at once); overriding the selection color otherwise means
hijacking the library-wide `--lr-color-brand` token and repainting everything else that reads it.
`--lr-flow-node-running-border` (default `var(--lr-color-brand)`) — the card's border color while
`status="running"`, independent of `--lr-flow-node-selected-outline-color` so a consumer can retint
just one of the two states without the other following along — and `--lr-flow-node-running-glow` (default
`var(--lr-color-brand-quiet)`) — the box-shadow color of the running-state ring around the card, and
the pulse keyframes' peak color. The status dot uses the shared
`--lr-flow-status-{pending|running|success|error|denied}-color` hooks, defaulting respectively
to border-strong, brand, success, danger, and warning; `--lr-flow-status-color` is the no-status
fallback. The explicit status hooks are `--lr-flow-status-pending-color`,
`--lr-flow-status-running-color`, `--lr-flow-status-success-color`,
`--lr-flow-status-error-color`, and `--lr-flow-status-denied-color`.
`--lr-flow-node-progress-track-color` (default
`var(--lr-color-border)`) and `--lr-flow-node-progress-fill-color` (default
`var(--lr-color-brand)`) independently retint the determinate progress track and fill. All of
these hooks inherit, so one canvas-level override can retint every descendant node without
changing a library-wide semantic token.

**Optional peer deps:** none.

```html
<lr-flow-node
  node-id="a"
  heading="Fetch"
  status="running"
  progress="40"
></lr-flow-node>
```

**Known gotchas:**

- A running node's card pulses (`?data-pulse`) unless `prefers-reduced-motion` is set — the same
  reduced-motion exception every animated surface in this library follows.
- `status` drives a status chip with a localized label plus `statusDetail`/`durationMs`, never a
  color-only indicator.
- All card chrome lives on `[part="card"]`, not `[part="base"]` — `base` is only the flex row that
  holds the input handles, the card and the output handles. Style the box through `::part(card)`.
- Empty `header`, body, and toolbar rows are removed from layout and update when slot contents are
  added or removed. A populated toolbar remains visible on coarse-pointer/no-hover devices rather
  than depending on an unavailable hover gesture. Invalid status/orientation inputs normalize to
  the documented canonical values.
- Selection uses an outline, while the running lifecycle uses its own border and glow; the two
  remain simultaneously visible.
- `--lr-flow-node-min-inline-size` was previously overridden by a duplicate declaration and had no
  effect. It now sets the card's minimum inline size again, so a node that was relying on the card
  collapsing below `11rem` will render wider than it used to.

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
- `label: string = ''` — accessible name for the map region. A host `aria-label` takes precedence,
  followed by `label`, then the localized default

**Events:** none.

**Slots:** none.

**CSS parts:** `base`, `map` (the scaled SVG), `node` (one rect per node), `viewport` (the
exact visible view rectangle), `viewport-hit-area` (the transparent draggable/focusable target),
`instructions` (visually hidden keyboard help), and `live-region` (the `aria-hidden` mirror of the
latest viewport-change text).

**Themeable custom properties:** `--lr-flow-minimap-inline-size` (default `12rem`),
`--lr-flow-minimap-block-size` (default `8rem`), plus the shared
`--lr-flow-status-color` and the explicit palette hooks
`--lr-flow-status-pending-color`, `--lr-flow-status-running-color`,
`--lr-flow-status-success-color`, `--lr-flow-status-error-color`, and
`--lr-flow-status-denied-color`.
`--lr-flow-minimap-viewport-min-size` (default `var(--lr-icon-button-size)`, normally 40px) floors
only the transparent `viewport-hit-area` along each axis. The visible `viewport` remains the exact
viewport-to-content ratio. The token inherits from ancestors; set it to `0` to opt out.

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
- A locked snapshot makes the hit area unfocusable and inert: no pointer, click, wheel, or keyboard
  shortcut can mutate the canvas.
- Dragging the viewport rectangle calls the canvas's `setViewport()` directly; there's no separate
  event to wire up. A completed drag consumes only the browser-synthesized click following its
  `pointerup`; a canceled or lost-capture drag leaves the next genuine map click available for
  click-to-center navigation.
- On a canvas whose node bounds dwarf the visible viewport — the case the minimap exists for — the
  raw viewport rectangle can collapse to a couple of pixels. The separate transparent hit area is
  floored and grown symmetrically around the exact visible rectangle; keyboard and drag math still
  read the canvas viewport directly.

**Additional API surface:**

- `part="instructions"` — Visually hidden keyboard instructions for the viewport.
- `part="live-region"` — Visually hidden, `aria-hidden` mirror of the latest viewport-change text.
  The initial companion snapshot is silent. Keyboard, map-click, and wheel viewport changes append
  their next rAF-coalesced snapshot to the document's shared light-DOM polite sink; a completed
  viewport drag appends its final position once, while canceled/lost-capture drags remain silent.
  Repeated identical snapshots are still separate additions.

---

## `lr-flow-controls`

The canvas's button cluster: zoom in/out, fit, and interaction lock, so every flow surface ships the
same affordances without hosts rebuilding them. Manipulates only view state, never `nodes`/`edges` —
no editing commands live here. Zoom-in/out disabled state reads the canvas snapshot's effective
finite, sorted bounds, so invalid or reversed raw `minZoom`/`maxZoom` values cannot disable an
otherwise available direction.

**Properties:**

- `for: string = ''` — id of the target `lr-flow-canvas`; empty resolves to the nearest ancestor
- `orientation: 'vertical' | 'horizontal' = 'vertical'` (reflected) — button-cluster layout axis
- `hideLock: boolean = false` (attribute `hide-lock`) — omits the lock/unlock toggle button
- `frame: 'card' | 'plain' = 'card'` (reflected) — container treatment, on the library-wide `frame`
  vocabulary. `'plain'` drops `[part="base"]`'s border, background, padding, corner radius and its
  floating-surface `box-shadow`, for a cluster placed in a host toolbar or panel that already draws
  its own surface. There is deliberately no `compact`: the padding is already the smallest spacing
  step and the only remaining room is the buttons' `--lr-icon-button-size` hit-area floor. The
  canonical type is `LyraFrame`; the former component-local appearance alias is removed.

**Events:** none dispatched directly — each button calls the resolved canvas's own `zoomIn()`/
`zoomOut()`/`fit()`, or toggles its `locked` property.

**Slots:** default — extra host buttons appended to the cluster, styled by the same group. A slotted
`<button>` is matched by a `::slotted(button)` rule that gives it the built-in controls' treatment:
the shared `--lr-icon-button-size` hit-area floor, the chrome-less transparent box, and the same
hover/press/disabled/focus-visible affordances. Only the slotted element itself is styled — markup
the consumer nests inside it is left alone — so an icon or label child keeps whatever the host
page gives it.

**CSS parts:** `base` (the `role="group"` wrapper; drops its floating-surface chrome under
`frame="plain"`), `zoom-in`, `zoom-out`, `fit`, `lock` (omitted when `hideLock`).

**Themeable custom properties:** `--lr-flow-controls-lock-active-color` (default
`var(--lr-color-brand)`, pressed lock-button foreground), plus shared tokens —
`--lr-icon-button-size` (each button's minimum hit area, unchanged by `frame`), `--lr-shadow-m`,
`--lr-color-surface`, `--lr-color-border`, `--lr-radius`, `--lr-space-2xs`,
`--lr-focus-ring-width`/`-color`/`-offset`.

**Optional peer deps:** none.

```html
<lr-flow-canvas id="canvas" style="height:480px">
  <lr-flow-controls slot="bottom-start" for="canvas"></lr-flow-controls>
</lr-flow-canvas>
```

**Known gotchas:**

- `for` resolution is identical across all three companions: a non-empty `for` is strict and never
  falls back; only an empty `for` chooses the nearest ancestor. Id changes, target replacement, and
  a canvas that upgrades after the companion are observed in the companion's own document/root.
  Wrong-tag or wrong-capability targets fail closed.
- `frame="plain"` drops the `box-shadow` along with the border and background — unlike most
  `plain` escapes in this library, which only reset the border/background/padding/radius. A lift
  shadow with no surface under it reads as a stray smudge, so the whole floating-surface treatment
  goes together (same as `lr-flow-run-status`'s `plain`).
- Under a narrow allocation the group wraps without overflowing, while each button retains the
  shared hit-area floor.

---

## `lr-flow-run-status`

Execution-state presentation for a `lr-flow-canvas`: pushes a `FlowRunDecorations` map into the
resolved canvas (the canvas itself renders the node/edge paint) and renders a compact run-summary
strip. Summary/count text and slotted host chrome wrap within narrow allocations. Does not execute,
poll, or time anything — pure pushed state; `durationMs` is host-computed.

**Properties:**

- `for: string = ''` — id of the target `lr-flow-canvas`; empty resolves to the nearest ancestor
- `decorations: FlowRunDecorations = {}` (attribute: false) — a detached, deeply frozen readonly
  record bounded to 10,000 keys plus finite nested depth/entry budgets and pushed onto the resolved
  canvas; invalid status entries are omitted, and consumers reassign the record after changes
- `hideSummary: boolean = false` (attribute `hide-summary`) — omits the "{done} of {total} steps
  complete" strip, keeping only the decoration push
- `label: string = ''` — accessible name for the summary strip
- `frame: 'card'|'plain' = 'card'` (reflected) — container treatment, on the library-wide `frame`
  vocabulary. `'plain'` removes the border, background, shadow, padding and radius, so a summary
  strip dropped straight into a host toolbar that already draws its own frame does not double it.
  `'card'` is the standalone floating-strip presentation. The canonical type is `LyraFrame`; there
  is no component-local appearance alias.

**Events:** none dispatched directly.

**Slots:** default — extra host chrome appended to the strip (e.g. a cancel button or a usage
badge).

**CSS parts:** `base`, `summary` (the "{done} of {total} steps complete" line), `count` (one per
status present, text + tone dot, never color-only), `live-region` (a visually-hidden, `aria-hidden`
mirror of the last step-transition announcement).

`live-region` carries no live-region role of its own — it is a styling and inspection surface. The
announcement itself goes to the library's shared **light-DOM** polite region, appended to the
consumer's `<body>` and marked `data-lr-live-region="polite"`, because a live region inside a
shadow root is not reliably announced (JAWS with Firefox ignores one outright). Assert against that
document-level region rather than `::part(live-region)`.

**Themeable custom properties:** shared `--lr-flow-status-color` and the explicit
`--lr-flow-status-pending-color`, `--lr-flow-status-running-color`,
`--lr-flow-status-success-color`, `--lr-flow-status-error-color`, and
`--lr-flow-status-denied-color` hooks, also consumed by `lr-flow-node` and `lr-flow-minimap`.
Set the palette on a canvas/theme ancestor to keep all three presentations in sync.

**Optional peer deps:** none.

```html
<lr-flow-canvas id="canvas" style="height:480px">
  <lr-flow-run-status slot="top-start" for="canvas"></lr-flow-run-status>
</lr-flow-canvas>
<script>
  document.querySelector("lr-flow-run-status").decorations = {
    a: { status: "success", durationMs: 820 },
    b: { status: "running", progress: 40 },
  };
</script>
```

**Known gotchas:**

- Purely a pushed-state conduit: it never starts, stops, or times a run itself — the host recomputes
  `decorations` (including `durationMs`) on whatever cadence its own execution engine ticks at.
- `for` resolution matches `lr-flow-minimap`/`lr-flow-controls`.
- The public identity is `lr-flow-run-status` / `LyraFlowRunStatus`. The former overlay name is
  removed rather than retained as a second runtime tag or public type.

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
number; tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'; color?: string }[]`. `value` is an _absolute_
  quantity measured against `total`, never a pre-computed percentage.
  `color`, when supplied, is a sanitized arbitrary CSS color that takes precedence over `tone`.
- `total: number = 0` — the full capacity segments are measured against (e.g. a model's context
  window size).
- `shape: ContextMeterShape = 'bar'` (`'bar' | 'ring'`, reflected) — the v9 geometry name;
  `variant` remains reserved for semantic tone across Lyra.
- `label: string = ''` — overall accessible caption, e.g. `"128K context window"`. Also rendered
  visually (`[part="label"]`) when set.
- `showLegend: boolean = false` (attribute `show-legend`, reflected) — renders a static
  `[part="legend"]` key below the meter, one swatch/label pair per `segments` entry, each swatch
  painted from that segment's resolved `color`/`tone`. Without it a segment's own label is exposed
  only through a hover `title` (desktop-only, undiscoverable) and the visually-hidden breakdown
  list, so a meter split across more than two or three categories reads as unlabeled colour to a
  sighted user. Non-interactive: it toggles nothing and emits nothing, mirroring
  `lr-sequence-strip`'s `showLegend` rather than the interactive `lr-graph-legend`. The whole
  subtree is `aria-hidden`, since `segment-list` already exposes the same names. Under
  `shape="ring"` the host stops being a fixed square so the key flows below the ring instead of
  being clipped.

Accessible summaries, segment tooltips, and ring titles format normalized nonnegative quantities
using `effectiveLocale`. A host `aria-label` names the host without being duplicated on the nested
meter owner, which retains its generated aggregate summary.

**Events:** none.

**Slots:** none.

**CSS parts:** `base` (a `<div>` for `bar`, an `<svg>` for `ring`), `semantic` (the visually hidden
meter semantics), `track` (the unfilled/empty capacity), `segment` (one occupied segment — carries
`data-tone` and, for custom colors, `--lr-context-meter-segment-color`), `segment-list` (the hidden
category list), `segment-item` (one hidden category/value entry), `label`, and — only under
`showLegend` — `legend`, `legend-item`, `legend-swatch` (carrying the same `data-tone` and custom
color hook as `segment`) and `legend-label`

**Themeable custom properties:** `--lr-context-meter-segment-color` is set per segment when its
`color` field is supplied, and is read by both `segment` and its matching `legend-swatch` so the
two can never disagree. `--lr-context-meter-legend-swatch-size` (default `var(--lr-size-0-625rem)`)
sizes a legend chip on both axes. Otherwise the component consumes shared tokens
`--lr-space-xs`, `--lr-color-text-quiet`, `--lr-font`, `--lr-radius`, `--lr-color-border`,
`--lr-color-surface` (the bar variant's inter-segment seam), `--lr-color-brand`,
`--lr-color-success`, `--lr-color-warning`, `--lr-color-danger`, `--lr-transition-base`.

**Optional peer deps:** none.

```html
<lr-context-meter label="128K context window" total="128000"></lr-context-meter>

<lr-context-meter shape="ring" total="128000"></lr-context-meter>
<script type="module">
  const [meter, ringMeter] = document.querySelectorAll("lr-context-meter");
  meter.segments = [
    { label: "System prompt", value: 2200, tone: "neutral" },
    { label: "Conversation history", value: 61000, tone: "brand" },
    { label: "Retrieved context", value: 30800, tone: "warning" },
  ];
  ringMeter.segments = segments;
</script>
```

An internal visually-hidden semantic node carries `role="meter"` plus `aria-valuenow`,
`aria-valuemin`, and `aria-valuemax` whenever `total > 0`; without a valid positive total it uses
`role="group"` and omits numeric meter attributes. Its accessible name is the generated summary;
an authored host `aria-label` remains on the host as a distinct overall name. A separate
visually-hidden segment list exposes
each labeled quantity, while the visible track, segments, ring SVG, and visible label remain
`aria-hidden`. The summary's "used" figure is the sum of
`segments[].value`, clamped to `total` whenever `total > 0` so the announced text can never claim
more than 100% used (e.g. `segments` summing to `150000` against `total="128000"` still announces
`"128,000 of 128,000 used"`) — matching what the _visual_ meter shows, since each segment's ratio is
independently clamped so the running cumulative fill across all segments can never exceed 100% of the
bar/ring either: an over-`total` `segments` array renders as a fully (not over-) filled meter, with
later segments truncated or squeezed to zero width/arc-length as the budget runs out. `total <= 0`
(or non-finite) renders zero segments — an empty track/ring — and the announced summary falls back to
just `"{used} used"` with no `"of {total}"` clause, regardless of what's in `segments`. Ring geometry
(a 40-radius circle, 12px stroke, centered at 50,50) intentionally matches `lr-gauge`'s own radial
numbers, so the two circular-meter components in the library share one visual scale.

**Known gotchas:**

- The ring variant's per-segment `<title>` and the bar variant's per-segment `title=` attribute are
  native mouse-hover tooltips only — they sit inside `aria-hidden` markup. Screen readers use the
  hidden meter/group summary and segment list instead.
- `shape="ring"` fixes the host at `8em × 8em` (`:host([shape='ring'])`) — the bar shape's
  `inline-size: 100%` does not apply in ring mode; resize it via `font-size` or an explicit
  width/height override on the host instead.
- Segment order is significant for the ring's cumulative `stroke-dashoffset` — later entries in
  `segments` render further around the circle (starting at 12 o'clock, going clockwise); there's no
  independent sort/z-order control.

**Additional API surface:**

- `part="segment-item"` — One visually-hidden segment label/count pair.
- `part="segment-list"` — The visually-hidden list exposing the segment breakdown.
- `part="semantic"` — The visually-hidden meter/group carrying aggregate range semantics.

---

## `lr-calendar`

Responsive month calendar with event markers and an agenda view.

**Properties:**

- `events: CalendarEvent[] = []` (attribute: false) — `{ readonly id?, readonly date, readonly
title, readonly color?, readonly data? }`; `date` is an ISO `YYYY-MM-DD` string and `color` is
  sanitized before being used as the marker background. The former ignored `start`/`end` fields
  are not part of the contract; use one event per displayed date
- `value: string = ''` — the selected ISO date
- `viewDate: string` (attribute `view-date`, defaults to the 1st of the current month) — the visible
  month; an unparseable value falls back to the current month
- `view: CalendarView = 'month'`, where `CalendarView = 'month' | 'agenda'` (reflected) — agenda
  lists the effective visible month's events, date-sorted. Foreign tokens normalize and reflect to
  `month`
- `firstDayOfWeek: LyraCalendarFirstDayOfWeek = 'auto'` (attribute `first-day-of-week`) — which
  weekday the grid starts on. **Breaking in 10.0.0:** the default was a hardcoded `1` (Monday)
  regardless of locale; it now derives from the effective locale through the same
  `resolveFirstDayOfWeek()` contract `<lr-date-picker>`/`<lr-date-input>` already use, so an unset
  `<lr-calendar>` renders Sunday-first under `en-US` and Monday-first under `fr-FR` instead of
  disagreeing with a date picker on the same page. **Also breaking in 10.0.0:** the bare `0`–`6`
  integer form is gone; the value is now one of the shared weekday-name tokens (`'auto'`, then
  `'sun'` through `'sat'`), which pins the week start independent of locale. Pass `'mon'` to keep
  the pre-10.0.0 rendering.
- `accessibleLabel: string = ''` (attribute `aria-label`) — names the host. The nested calendar
  section retains the localized purpose name rather than duplicating an authored host name; when
  set programmatically without a host attribute, this value names the section

**Keyboard:** the month grid is a fixed 6×7 matrix (leading/trailing days of adjacent months fill it
out) with one roving tab stop — `focusedDate`, else `value`, else today, else the first rendered day.
Arrows move by 1 day (Left/Right swapped under RTL) or 7; stepping past the rendered grid rolls
`viewDate` to the target's month and emits `lr-view-change`. Enter/Space select.

**Events:** `lr-date-select` (`detail: { date }`), `lr-event-select` (`detail: { event }`),
`lr-view-change` (`detail: { viewDate }`, from the prev/next buttons and out-of-grid arrow moves).

**Slots:** none.

**CSS parts:** `header` and `navigation` are aliases on the header wrapper; `nav` is shared by both
month-navigation buttons; `previous-button` and `next-button` identify each direct button;
`nav-glyph` is the chevron (`scaleX(-1)`-mirrored under RTL); `title`, `weekdays`, `weekday`,
`grid`, `week` (`display: contents`), `day`, `date`, `event` (a month-view marker), `agenda`, and
`agenda-event`.

**Themeable custom properties:** `--lr-calendar-day-min-block-size` (default `var(--lr-size-6rem)`)
and `--lr-calendar-day-min-block-size-narrow` (default `var(--lr-size-4rem)`, applied at container inline-size
≤ 28rem); `--lr-calendar-day-selected-bg` (default `var(--lr-color-brand-quiet)`) for a selected
day's background; `--lr-calendar-day-outside-color` (default `var(--lr-color-text-quiet)`) and
`--lr-calendar-day-outside-bg` (default `var(--lr-color-surface)`) for adjacent-month days; and
`--lr-calendar-day-today-outline-color` (default `var(--lr-color-brand)`) for today's outline.
These state hooks use inline fallbacks at their paint rules, so an application theme can set them
on an ancestor. They keep persistent selection, outside-month chrome, and today's outline
independent from shared tokens that also drive unrelated component states.

Month-view `[part='event']` markers are real keyboard-focusable buttons inside a non-interactive
`role="gridcell"` day container; Enter/Space activates the same `lr-event-select` path as a pointer.
Their target stays at least 24×24 CSS px even in the narrow month layout. Agenda view likewise
renders each event as a `<button part="agenda-event">`.

## `lr-timeline` and `lr-timeline-item`

Read-only chronological sequence by default. `lr-timeline` is a `role="list"` flex container; each
`lr-timeline-item` is a light-DOM child that sets `role="listitem"` on itself and renders its own
marker plus the trailing rail segment reaching toward the next item's marker. The last item's rail is
suppressed purely in CSS (`::slotted([role='listitem']:last-child)`) — no JS coordination anywhere.
Items have no keyboard navigation or selection model: a passive record display, by design (an
item's `title`/`description` routinely hold focusable content, so wrapping the row in `role="button"`
would trip `nested-interactive`). The opt-in clustered time scale adds only native count-marker
buttons; it does not make the individual rows interactive.

**`lr-timeline` properties:** `orientation: 'vertical' | 'horizontal' = 'vertical'` — note the
opposite default from `lr-stepper`; `horizontal` makes `[part='base']` a horizontally scrollable row.
`accessibleLabel?: string` (attribute `aria-label`) overrides the localized `"Timeline"` name —
omitting it reads back `undefined` and falls back to that default, while an explicitly empty
`aria-label` stays empty
(the `role="list"` element is in the shadow root and never inherits a host attribute). Read-only
`itemCount: number` is the live count of default-slot `<lr-timeline-item>` assignments (including
flattened forwarding slots); unrelated slotted elements and text nodes are ignored.
`scale: 'flow' | 'time' = 'flow'` (attribute `scale`, type `LyraTimelineScale`) chooses how items
are distributed along the main axis. `'flow'` is the default even sequence, where `timestamp` is
rendered as text but carries no positional meaning. `'time'` positions each item at its true
proportion of the range, so a gap of weeks and a gap of decades stop looking identical. `'time'`
needs a definite extent to distribute along — `--lr-timeline-time-extent` (default
`var(--lr-size-20rem)`), applied as `block-size` when vertical and `inline-size` when horizontal —
because items are absolutely positioned and a percentage against an auto-sized track resolves to
zero. `collision: 'overlap' | 'stack' | 'cluster' = 'overlap'` (attribute `collision`, type
`LyraTimelineCollision`) chooses what `scale="time"` does with items landing on nearly the same
position: `'overlap'` leaves them stacked on one another, `'stack'` steps each colliding item one
lane along the **cross** axis (indent per lane: `--lr-timeline-collision-offset`, default
`var(--lr-space-l)`), and `'cluster'` replaces every group of at least two colliding items with one
count marker. The group's first member in author order becomes its representative and renders the
button in that item's existing list/Tab position; the remaining members are hidden, so visual,
semantic, and keyboard order do not diverge merely because clustering is enabled. Stack mode and
the cluster floor treat items within 1.5% of the axis as colliding.
Cluster mode widens that floor to the rendered count action's footprint on the currently allocated
axis, then reclusters when the allocation or rendered action size changes, so interactive marker
hit areas do not overlap.
Cluster windows are bounded from their first sorted position rather than transitively chaining every
dense neighbour, so a large history becomes a useful sequence of markers rather than one axis-wide
cluster. An isolated item remains an ordinary timeline item. Activating a count marker is a
notification only; it never expands or selects items internally.
`rangeStart` / `rangeEnd` (`Date | string | number`, attribute: false) pin the axis instead of
deriving it from the earliest/latest item; a reversed or non-finite pair falls back to the derived
range. An item with no parseable `timestamp` (including one supplied only through the `timestamp`
slot, which carries no machine-readable instant) keeps document order and is spread evenly, so a
partially-timestamped list degrades rather than stacking at the origin. Reassigning an item's
`timestamp` reclusters without requiring a slot mutation. Positions are written to
each child as a private `--_lr-timeline-item-offset` custom property and removed again on a switch
back to `'flow'`. Cluster mode adds and removes a private visibility marker on non-representative
members and temporarily changes only the representative item's shadow presentation; switching
mode, shrinking the data, or disconnecting restores every ordinary row. If regrouping would remove
the focused row content or count action, focus moves to the replacement cluster action, the first
surviving item action, or the timeline list as a programmatic fallback.

**`lr-timeline-item` properties:** `timestamp?: Date | string | number` (attribute: false — `Date`
isn't attribute-serializable; invalid input normalizes to unset and renders no timestamp UI),
`sync: boolean = false` (forwarded to the internal `<lr-relative-time>`; no effect when the
`timestamp` slot is filled), `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' =
'neutral'` (marker tone), `active: boolean = false` (reflected — a static marker ring plus an
optional pulse disabled under `prefers-reduced-motion: reduce`, with explicit `aria-current="true"`
or `"false"` on the host).

**Events:** `lr-timeline` emits `lr-cluster-activate` when a `collision="cluster"` marker is
activated by pointer, Enter, or Space. Its non-cancelable, bubbling, composed
`detail: LyraTimelineClusterActivateDetail` is `{ items: readonly LyraTimelineItem[] }`: a fresh
frozen snapshot of the cluster members in document order, preserving each element's identity.
`LyraTimelineClusterActivateDetail {
  items: unknown;
}`
Use it to open a consumer-owned popover, dialog, or detail view. `lr-timeline-item` emits no events.
Read the reactive `itemCount` property after changing assigned items; the internal slot's
non-composed `slotchange` event is not a host-level public signal.

**Slots:** `lr-timeline`'s default slot holds the items, in display order. On an item the **default
slot is the title** (there is no `title` slot), plus `marker-icon` (marker glyph override; an empty
slot falls back to a color-coded dot), `timestamp` (wins outright over the
`timestamp` property whenever it has assigned content), and `description` (its part is hidden
entirely when empty).

**CSS parts:** timeline `base` — the `role="list"` flex container (no separate `list` part). Item:
`cluster` — the native count button rendered while that item represents a cluster, with a 40px
minimum action surface; `cluster-count` — its painted count pill; `base`, `track`
(marker + rail spine, always the opposite axis from `base`), `marker`
(`aria-hidden="true"`, decorative), `rail` (the connecting segment; `visibility: hidden` rather than
removed on the last item, so marker alignment stays consistent), `content`, `header` (flex row
wrapping `title` and `timestamp`; wraps at narrow widths rather than truncating), `title`,
`timestamp` (hidden when there's nothing to show), `description`.

**Themeable custom properties:** `--lr-timeline-gap` (default `var(--lr-space-l)`) — declared on
`lr-timeline` but consumed inside each item via inheritance across the slot boundary; it is both the
inter-item spacing and the length each rail bridges. `--lr-timeline-cluster-size` (default
`var(--lr-size-2rem)`) sizes the painted count pill, `--lr-timeline-cluster-bg` (default
`var(--lr-color-brand)`) sets its background, and `--lr-timeline-cluster-color` (default
`var(--lr-color-on-brand)`) sets its foreground. `--lr-scroll-fade-size` (default `2rem`) controls
each horizontal-overflow edge fade; forced-colors mode removes the masks while retaining native
scrolling. On the item: `--lr-timeline-marker-size`
(default `var(--lr-size-1-25rem)`, both dimensions so the dot stays circular),
`--lr-timeline-rail-width` (default `var(--lr-border-width-medium)`), `--lr-timeline-rail-color`
(default `var(--lr-color-border)`), `--lr-timeline-marker-color` (default
`var(--lr-color-text-quiet)`, with a private default that changes per `variant`), and
`--lr-timeline-active-ring-color`
(defaults to the effective marker color). All five item hooks inherit from theme
ancestors; setting one directly on an item wins over both the inherited value and variant default.

Version 9 removes the legacy item `icon` slot; migrate marker glyphs to `slot="marker-icon"`.
Timeline orientation/rail coordination now uses private implementation-prefixed cross-shadow
properties. The only supported spacing input remains `--lr-timeline-gap`; stop overriding the five
former `--lr-timeline-item-*` plumbing names.

## `lr-file-tree`

A file-explorer preset over `<lr-tree>` + `<lr-file-icon>`: path-keyed nodes with
git-status/diff-count badges, lazy directory loading, and select/open events.

**Properties:** `nodes: readonly FileTreeNode[] = []` (attribute: false; clone-owned/frozen,
cycle-safe snapshot omitting empty/blank paths and retaining the first duplicate path, bounded to
the first 10,000 inspected source positions across 64 descendant levels; reassign after changes),
`selectedPath: string | null = null` (attribute `selected-path`), and `label?: string` — an
accessible-name override for the internal `<lr-tree>`, where omission reads back `undefined` and falls
back to the localized default while an explicitly empty string renders as an empty label.
`additions`/`deletions` are normalized once to finite nonnegative integers before localized visible
and accessible diff summaries. A host `aria-label` wins by presence when naming the internal tree,
including an explicit empty string; removing it restores `label` or the localized fallback.

**Methods:** `setChildren(path, children)` supplies a lazily-loaded directory's children.
`revealPath(path)` expands every ancestor directory and scrolls the target row into view, resolving
`true` once found. `expandAll()` and `collapseAll()` forward to the underlying `<lr-tree>`.

**Events:** `lr-file-select` (frozen readonly `detail: { filePath, node }`, a row was activated),
`lr-file-open` (frozen readonly `detail: { filePath, node }`, Enter/click on an already-selected file
row), and `lr-load-children` (frozen readonly `detail: { filePath }`, a lazy unloaded directory
expanded).

**CSS parts:** `base` — the root wrapper.

## `lr-env-list`

A masked key/value list for environment variables and secrets, with per-row reveal and copy.
Masking is presentational, not a security boundary: the real value sits in a DOM property
regardless of mask state. Names, revealed values, and localized action text wrap within narrow
allocations; the name track uses at most 40% of the available inline size.

**Properties:** `entries: readonly EnvEntry[] = []` (attribute: false; clone-owned/frozen snapshots
of at most the first 10,000 source entries; malformed records, blank names, and later duplicate
names are skipped first-wins before render, reveal state, copy actions, and events; reassign after
changes), `revealable: boolean = true` (reflected), `copyable: boolean = true`
(reflected), and `label?: string`. An omitted label uses localized `envListLabel`; an explicit empty
string remains empty. A host `aria-label` wins by attribute presence, including when empty.

**Events:** `lr-reveal-change` (frozen readonly `detail: { envName, revealed }`); `lr-copy` (frozen
readonly `detail: { ok: true, text }`, emitted only after clipboard fulfillment, with `text` equal
to the real unmasked value); `lr-copy-error` (frozen readonly
`detail: { ok: false, text, reason, error }`); and `lr-error` (compatibility failure notification
without raw platform error text). Failure is announced through the localized `copyFailed` string
in the owning document's shared polite live region; copy intent is never announced as success.

**CSS parts:** `base` (the `<dl>` root), `name` (the `<dt>` text), `value-cell` (the `<dd>` wrapping
an entry's value text and buttons), `value` (carries `data-masked`), `reveal-button`, and
`copy-button`.

**Themeable custom properties:** `--lr-env-list-reveal-active-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-env-list-reveal-active-border` (default
`var(--lr-color-brand)`) — the background and border color of a pressed (revealed) reveal toggle.
Both are inline `var()` fallbacks at their point of use rather than `:host` declarations, so either
can be set on the element _or any ancestor_. They exist because
`::part(reveal-button)[aria-pressed='true']` is invalid CSS — Shadow Parts forbids an attribute
selector after `::part()` — so restyling the pressed state otherwise required overriding the
library-wide brand tokens.

## `lr-document-library`

Controlled searchable and filterable document inventory with versions, tags, owners, freshness,
sorting, and bulk selection. It composes the table's bounded 100-row default, so a large document
collection stays reachable through pagination without mounting an unbounded grid.

**9.0 migration:** `lr-filter-change.detail.text` is now `searchTerm`, backed by the public
`searchTerm`/`search-term` axis. Replace `sortDirection: 'ascending'|'descending'` with
`sortDir: 'asc'|'desc'`; document sorting now uses the same cancelable `lr-sort-request` followed
by accepted `lr-sort` transaction and `{ phase, sortKey, sortDir }` vocabulary as `lr-table`.

**Properties:** clone-owned frozen `documents: readonly LibraryDocument[] = []` (at most the first
10,000 source documents and 10,000 tags per document are retained; document records, nested tags,
and dates are snapshotted on assignment; malformed records (including missing/non-string names or
non-string tag entries), blank ids, and later duplicate ids are omitted first-wins before filters,
counts, selection, rows, and events; reads are detached so `Date`
mutators cannot reach retained state; reassign after changes), `filter`, `label`, `loading`,
clone-owned frozen `selectedDocumentIds: readonly string[] = []` (at most 10,000 unique ids; reassign after
changes), public controlled `searchTerm: string = ''`
(`search-term`), `sortKey: LibraryDocumentSortKey = 'name'` (`sort-key`), canonical
`sortDir: 'asc'|'desc' = 'asc'` (`sort-dir`), and clone-owned frozen
`tagFilter: readonly string[] = []` (at most 10,000 unique tags; reassign after changes).

**Events:** `lr-filter-change` emits a fresh frozen readonly
`{ searchTerm, tags, matchCount }`; cancelable `lr-sort-request` proposes frozen readonly
`{ phase: 'request', sortKey, sortDir }`; accepted `lr-sort` commits the same canonical vocabulary
with `phase: 'commit'`; `lr-selection-change` emits a fresh frozen readonly `{ documentIds }`; and
`lr-open` emits frozen readonly `{ documentId }`.

**CSS parts:** `base`, `toolbar`, `search`, `tag-filter`, `selection-bar`, `selection-count`,
`clear-selection`, `table`, `row`, `cell`, `header-cell`, `document-name`.

`selection-bar` is visible ordinary content, not a shadow live region. Initial declarative
selection stays silent; every post-mount `selectedDocumentIds` change appends the localized selected count
to the document's shared light-DOM polite sink, including zero and repeated equal counts.
Internal search, tag-filter, and checkbox native `input`/`change` plus prefixed `lr-input`/
`lr-change` aliases, the tag combobox's lifecycle/filter/clear/invalid events, table pagination and
priority-column visibility events, and the table's click-anywhere selection event stop at the
component's translation boundary. The table is still in multiple-selection semantics so
`selectedDocumentIds` reaches row `aria-selected`; document selection itself remains checkbox-owned, while
row activation opens the document. Listen for the document-library events above; one interaction
emits one documented host contract without also leaking a composed child event.

## `lr-graph-query-builder`

Form-associated editor for a typed graph relationship/path query, including entity anchors,
relationship and node-type filters, hop limits, validation, and saved queries.

The normalized `value` present at the first update is the form reset default. Later property writes
and user edits change only the live query; `form.reset()` restores that initial model, clears
interaction/touched state and the save-name draft, and retains a caller-set custom validity message
like a native control.

Removing a focused relationship/node filter chip moves focus to the adjacent chip, or to that
filter's add picker when no chips remain. `savedQueries` is controlled: when the host applies a
focused accepted `lr-query-delete` notification, focus follows the adjacent saved-query delete
action, or the stable save-name input when the list becomes empty. Updates that did not remove the
focused control never move external focus.

**Properties and getters:** clone-owned frozen `value: GraphQuery`; `customError` (`custom-error`),
`label`, `labels`, `name`, `disabled`, `effectiveDisabled`; clone-owned frozen
`nodeTypeOptions: readonly GraphQueryTypeOption[]`, `relationshipTypeOptions: readonly
GraphQueryTypeOption[]`, and `savedQueries: readonly GraphQuerySavedItem[]`; `hopLimit`, frozen
`errors`, `form`, `validity`, `validationMessage`, and `willValidate`. Type-option values and saved
query ids are nonblank unique first-wins identities; malformed/hostile records are skipped, nested queries
are normalized snapshots, collections are capped at 500 options / 200 saved queries, and strings
at 256 characters. `value.relationshipTypes` and `value.nodeTypes` are each capped at 500 entries.
Create and reassign a new value, options array, or saved-query array after changes; mutating a
previous caller-owned object cannot change the builder's assigned snapshots.

**Methods and form callbacks:** `getForm()`, `focus(options?)`, `blur()`, `click()`,
`checkValidity()`, `reportValidity()`, `setCustomValidity(message)`, `formDisabledCallback(disabled)`,
`formResetCallback()`, and `formStateRestoreCallback(state, mode?)`.

`setCustomValidity(message)` (new in 8.0.0) is the standard channel for a server-side rejection
("no graph is loaded for that tenant") that neither of the control's own constraints can express. A
non-empty `message` raises `customError` and becomes `validationMessage`, so the builder fails
`checkValidity()`, blocks submission and matches `:state(invalid)`; `''` clears it. Clearing
restores the control's own computed validity rather than forcing it valid — a query with no
`startId` stays `valueMissing` — and the custom error survives both intrinsic recomputation (every
field edit) and `form.reset()`, exactly like a native control, where only another
`setCustomValidity('')` clears it. The message is caller-supplied and is used verbatim, never
localized, and it is whole-control state exposed as `errors.base`; intrinsic errors remain keyed
by their field csspart. The start-ID `lr-input` is natively required, matching
the aggregate `valueMissing` constraint. `focus(options?)` and `click()` target the first rendered
field (start/end/hop-limit/direction/save-name, in that order), `blur()` releases whichever nested
owner contains deep focus, and all entry actions are inert while directly or fieldset disabled.

The group is named by a host `aria-label` when present; otherwise `aria-labelledby` points to the
visible label element, so slotted/property/localized label text is also the announced name.

**Events:** all query/model details are readonly frozen snapshots. `lr-validity-change` publishes
effective native validity, including custom errors and own/fieldset validation barring.
`lr-invalid` is a cancelable bubbling/composed alias; vetoing it suppresses the native invalid
default. Run, save, load, and delete share one two-phase contract: cancelable
`lr-before-query-run`, `lr-before-query-save`, `lr-before-query-load`, and
`lr-before-query-delete` requests precede any local effect; non-cancelable `lr-query-run`,
`lr-query-save`, `lr-query-load`, and `lr-query-delete` notifications follow only when accepted.
The matching before/accepted pair reuses one frozen payload: `{ query }` for run,
`{ name, query }` for save, `{ queryId, query }` for load, and `{ queryId }` for delete.
Run validates before its request. Save veto preserves the draft name. Load requests frozen
`{ queryId, query }` before changing `value`, so veto preserves the current query; its accepted event
fires after the new value is applied. Delete remains controlled, so the host removes the accepted
id from `savedQueries`. The full set is `lr-input`, `lr-validity-change`, `lr-invalid`, and those
eight phased action events.

Migration note: veto save in `lr-before-query-save`, not `lr-query-save`; the existing
`lr-query-*` action events are accepted, non-cancelable notifications. **Slots:** `actions`,
`label`, `hint`, `error`. **CSS
parts:** `base`, `label`, `hint`, `error` (the three form-control chrome parts every
form-associated control in this library exposes — see `lr-select`), `path-fields`, `start-input`,
`end-input`, `relationship-picker`, `relationship-chips`, `node-type-picker`, `node-type-chips`,
`direction`, `filter-group`, `min-hops`, `max-hops`, `footer`, `run-button`, `save-button`,
`save-row`, `save-name-input`, `saved-queries`, `saved-queries-label`, `saved-list`, `saved-item`,
`saved-load-button`, `saved-delete-button`, `saved-empty`.

**Themeable custom properties:** the Run button exposes `--lr-graph-query-builder-run-bg`,
`--lr-graph-query-builder-run-border-color`, and `--lr-graph-query-builder-run-color` for its
resting longhands plus `--lr-graph-query-builder-run-hover-bg` and
`--lr-graph-query-builder-run-active-bg`; the Save button exposes
`--lr-graph-query-builder-save-bg`, `--lr-graph-query-builder-save-border-color`,
`--lr-graph-query-builder-save-color`, `--lr-graph-query-builder-save-hover-bg`, and
`--lr-graph-query-builder-save-active-bg`. Saved-query actions use
`--lr-graph-query-builder-saved-load-color`, `--lr-graph-query-builder-saved-load-active-bg`,
`--lr-graph-query-builder-saved-delete-color`,
`--lr-graph-query-builder-saved-delete-hover-color`,
`--lr-graph-query-builder-saved-delete-active-color`, and
`--lr-graph-query-builder-saved-delete-active-bg`. Unset hooks preserve the current shared
surface/text/brand/danger colors and hover/active mixes. They are inline `var()` fallbacks at the
longhand that consumes them, so an override on a parent themes every descendant builder without
being shadowed by a declaration on the component host.

**Additional API surface:**

- `errorText` — Caller-supplied outer error text. Field-level validation remains on the affected controls. Type: `string`.
- `hint` — Supporting text rendered below the outer label. Type: `string`.
- `error-text` attribute — Caller-supplied outer error text. Field-level validation remains on the affected controls.
- `hint` attribute — Supporting text rendered below the outer label.
- `hint` slot — Supporting text for the complete form control.
- `part="hint"` — Supporting text for the complete form control.

## `lr-condition-builder`

Composable flat condition builder for tabular or dashboard data: condition rows combined with an
AND/OR combinator, distinct by name and model from `lr-graph-query-builder`.

**9.0 migration:** `lr-query-builder` / `LyraQueryBuilder` / `QueryBuilder*` were renamed without
aliases to `lr-condition-builder` / `LyraConditionBuilder` / `ConditionBuilder*`. Update the tag,
granular import path, class/type imports, selectors, and framework bindings together.

**Properties:** clone-owned readonly `fields`, clone-owned readonly `value`, and `disabled`.
Structured inputs are bounded (200 fields and conditions, 500 options per field, 256 characters
per string), malformed records and blank field names/option values/condition ids are skipped,
duplicates use the first valid record, and unknown closed-vocabulary values normalize to their
documented fallback. A retained, known operator and its value payload are not rewritten merely
because they disagree with the current field metadata. That preservation also applies when fields
arrive after `value` or their operator/type definition later changes.
Returned arrays and records are frozen snapshots, so mutate-and-reuse does not bypass Lit's
assignment boundary. Create and reassign a new `fields` array or `value` record after changes.

`validationIssues` is a live frozen list of `{ conditionId, code }` rows, where `code` is
`field-unavailable`, `operator-not-allowed`, `operator-arity`, or `value-type`.
`invalidConditionIds` projects their ids in model order, `checkValidity()` tests the current model,
and `reportValidity()` additionally focuses the first affected field/operator/value control. The
root group and every condition render explicit `aria-invalid="true"|"false"`. A non-finite
controlled number is therefore preserved and reported as `value-type`; numeric text entered through
the UI still becomes unset when parsing overflows. Check validity before sending restored data to a
backend, particularly because JSON serializes non-finite numbers as `null`.

`ConditionBuilderField.min`/`max` accept finite numbers for `type: 'number'` and bounded strings for
`type: 'date'`; `step` accepts a positive finite number for numeric fields. These constraints are
forwarded to the composed `lr-input`/`lr-date-input`. They are omitted for other field types, and
leaving all three unset preserves the previous unconstrained controls.

**Methods:** `addCondition()` appends a condition using the first available field and emits a frozen
`lr-add-condition`; it is a no-op while disabled or when there are no fields. `checkValidity()` and
`reportValidity()` validate without changing `value`.
`removeCondition(id)` removes the matching condition and emits `lr-remove-condition`
(`detail: { conditionId }`); it is a
no-op while disabled or when the id is absent.

**Events:** `lr-input`, `lr-add-condition`, `lr-remove-condition`; all details and nested model
snapshots are readonly and frozen. **CSS parts:** `base`, `conditions`,
`condition`, `field-select`, `operator-select`, `value`, `combinator`, `add-button`,
`remove-button`, `empty`.

`conditions` is a semantic list and every `condition` is a list item, so repeated Field/Operator/
Value labels retain a row relationship in the accessibility tree. The localized, indexed remove
name continues to identify each row's destructive action.

At allocations of 320px or less, each condition stacks its composed field/operator/value controls
into one column. Long field labels and localized operator text remain contained and ellipsize inside
the nested `lr-select` triggers in both LTR and RTL; they do not widen the host or document.

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-data-calendar-calendar-contracts`** — Supporting data types and helpers for this component family.
  `CalendarEvent {
  id: unknown;
  date: unknown;
  title: unknown;
  color: unknown;
  data: unknown;
}`

- **`components-data-condition-builder-condition-builder-contracts`** — Supporting data types and helpers for this component family.
  `ConditionBuilderCondition {
  id: unknown;
  field: unknown;
  operator: unknown;
  value: unknown;
}`
  `ConditionBuilderField {
  name: unknown;
  label: unknown;
  type: unknown;
  options: unknown;
  operators: unknown;
  placeholder: unknown;
  min: unknown;
  max: unknown;
  step: unknown;
}`
  `ConditionBuilderFieldOption {
  value: unknown;
  label: unknown;
}`
  `ConditionBuilderValidationIssue {
  conditionId: unknown;
  code: unknown;
}`
  `ConditionBuilderValue {
  combinator: unknown;
  conditions: unknown;
}`

- **`components-data-context-meter-context-meter-contracts`** — Supporting data types and helpers for this component family.
  `ContextMeterSegment {
  label: unknown;
  value: unknown;
  tone: unknown;
  color: unknown;
}`

- **`components-data-data-grid-data-grid-types-contracts`** — Supporting data types and helpers for this component family.
  `DataGridCellContextMenuDetail {
  originalEvent: unknown;
  rowKey: unknown;
  columnId: unknown;
  column: unknown;
  value: unknown;
  row: unknown;
  index: unknown;
}`
  `DataGridCellDetail {
  rowKey: unknown;
  columnId: unknown;
  column: unknown;
  value: unknown;
  row: unknown;
  index: unknown;
}`
  `DataGridColumn {
  id: unknown;
  field: unknown;
  label: unknown;
  align: unknown;
  width: unknown;
  minWidth: unknown;
  maxWidth: unknown;
  flex: unknown;
  formatter: unknown;
  value: unknown;
  row: unknown;
  sortable: unknown;
  sortFn: unknown;
  comparator: unknown;
  left: unknown;
  right: unknown;
  leftRow: unknown;
  rightRow: unknown;
  sortDescFirst: unknown;
  sortUndefined: unknown;
  searchable: unknown;
  filterable: unknown;
  filterType: unknown;
  filterFn: unknown;
  filter: unknown;
  hidden: unknown;
  hideable: unknown;
  resizable: unknown;
  movable: unknown;
  pinnable: unknown;
  pinned: unknown;
  footer: unknown;
  rows: unknown;
  aggregation: unknown;
  aggregatedFormatter: unknown;
}`
  `DataGridColumnMoveDetail {
  columnOrder: unknown;
  columnId: unknown;
  finished: unknown;
}`
  `DataGridColumnPinDetail {
  columnId: unknown;
  side: unknown;
}`
  `DataGridColumnResizeDetail {
  columnId: unknown;
  width: unknown;
  finished: unknown;
}`
  `DataGridColumnState {
  order: unknown;
  widths: unknown;
  visibility: unknown;
  pinning: unknown;
}`
  `DataGridColumnVisibilityDetail {
  columnId: unknown;
  visible: unknown;
}`
  `DataGridCopyOptions {
  columnIds: unknown;
  includeHeaders: unknown;
  format: unknown;
  escapeFormulas: unknown;
  delimiter: unknown;
}`
  `DataGridCsvOptions {
  delimiter: unknown;
  includeHeaders: unknown;
  columnIds: unknown;
  escapeFormulas: unknown;
}`
  `DataGridDataErrorDetail {
  error: unknown;
  request: unknown;
}`
  `DataGridExportOptions {
  fileName: unknown;
  delimiter: unknown;
  includeHeaders: unknown;
  columnIds: unknown;
  escapeFormulas: unknown;
}`
  `DataGridFacets {
  uniqueValues: unknown;
  minMax: unknown;
}`
  `DataGridFilter {
  id: unknown;
  value: unknown;
}`
  `DataGridGroupDetail {
  key: unknown;
  columnId: unknown;
  value: unknown;
  rows: unknown;
}`
  `DataGridPageDetail {
  page: unknown;
  pageSize: unknown;
}`
  `DataGridRequest {
  sort: unknown;
  filters: unknown;
  search: unknown;
  page: unknown;
  pageSize: unknown;
  signal: unknown;
}`
  `DataGridResponse {
  rows: unknown;
  total: unknown;
}`
  `DataGridRowDetail {
  rowKey: unknown;
  key: unknown;
  row: unknown;
}`
  `DataGridScrollOptions {
  align: unknown;
}`
  `DataGridSelectionDetail {
  selectedRowKeys: unknown;
  selectedKeys: unknown;
  selectedRows: unknown;
}`
  `DataGridSort {
  id: unknown;
  desc: unknown;
}`
  `DataGridStateFilter {
  id: unknown;
  value: unknown;
}`
  `DataGridState {
  sort: unknown;
  filters: unknown;
  search: unknown;
  selectedRowKeys: unknown;
  expandedRowKeys: unknown;
  selectedKeys: unknown;
  expandedKeys: unknown;
  page: unknown;
  pageSize: unknown;
  order: unknown;
  widths: unknown;
  visibility: unknown;
  pinning: unknown;
}`

- **`components-data-document-library-document-library-contracts`** — Supporting data types and helpers for this component family.
  `DocumentLibraryFilterChangeDetail {
  searchTerm: unknown;
  tags: unknown;
  matchCount: unknown;
}`
  `DocumentLibraryOpenDetail {
  documentId: unknown;
}`
  `DocumentLibrarySelectionChangeDetail {
  documentIds: unknown;
}`
  `DocumentLibrarySortCommitDetail {
  phase: unknown;
  sortKey: unknown;
  sortDir: unknown;
}`
  `DocumentLibrarySortRequestDetail {
  phase: unknown;
  sortKey: unknown;
  sortDir: unknown;
}`
  `LibraryDocument {
  tags: unknown;
  owner: unknown;
  updatedAt: unknown;
  freshness: unknown;
  id: unknown;
  name: unknown;
  mimeType: unknown;
  uri: unknown;
  version: unknown;
}`

- **`components-data-env-list-env-list-contracts`** — Supporting data types and helpers for this component family.
  `EnvEntry {
  name: unknown;
  value: unknown;
  secret: unknown;
}`

- **`components-data-file-tree-file-tree-contracts`** — Supporting data types and helpers for this component family.
  `FileTreeNode {
  path: unknown;
  name: unknown;
  kind: unknown;
  mimeType: unknown;
  gitStatus: unknown;
  additions: unknown;
  deletions: unknown;
  children: unknown;
  hasChildren: unknown;
}`

- **`components-data-flow-canvas-flow-types-contracts`** — Supporting data types and helpers for this component family.
  `FlowEdge {
  id: unknown;
  source: unknown;
  target: unknown;
  sourceHandle: unknown;
  targetHandle: unknown;
  label: unknown;
  tone: unknown;
}`
  `FlowHandle {
  id: unknown;
  label: unknown;
}`
  `FlowLayoutChangeDetail {
  positions: unknown;
  x: unknown;
  y: unknown;
  truncated: unknown;
}`
  `FlowNode {
  id: unknown;
  type: unknown;
  position: unknown;
  x: unknown;
  y: unknown;
  data: unknown;
  accessibleLabel: unknown;
  inputs: unknown;
  outputs: unknown;
}`
  `FlowRunDecoration {
  status: unknown;
  progress: unknown;
  durationMs: unknown;
  detail: unknown;
}`
  `FlowStructureEdgeSnapshot {
  id: unknown;
  source: unknown;
  target: unknown;
  status: unknown;
}`
  `FlowStructureNodeSnapshot {
  id: unknown;
  x: unknown;
  y: unknown;
  width: unknown;
  height: unknown;
  status: unknown;
}`
  `FlowStructureSnapshot {
  nodes: unknown;
  edges: unknown;
  viewport: unknown;
  locked: unknown;
  orientation: unknown;
  layerGap: unknown;
  nodeGap: unknown;
}`
  `FlowViewportSnapshot {
  x: unknown;
  y: unknown;
  zoom: unknown;
  width: unknown;
  height: unknown;
  minZoom: unknown;
  maxZoom: unknown;
}`

- **`components-data-funnel-funnel-contracts`** — Supporting data types and helpers for this component family.
  `LyraFunnelStage {
  label: unknown;
  value: unknown;
  color: unknown;
}`

- **`components-data-graph-query-builder-graph-query-builder-contracts`** — Supporting data types and helpers for this component family.
  `GraphQueryDeleteDetail {
  queryId: unknown;
}`
  `GraphQuery {
  startId: unknown;
  endId: unknown;
  relationshipTypes: unknown;
  nodeTypes: unknown;
  direction: unknown;
  minHops: unknown;
  maxHops: unknown;
}`
  `GraphQueryLoadDetail {
  queryId: unknown;
  query: unknown;
}`
  `GraphQueryRunDetail {
  query: unknown;
}`
  `GraphQuerySaveDetail {
  name: unknown;
  query: unknown;
}`
  `GraphQuerySavedItem {
  id: unknown;
  name: unknown;
  query: unknown;
}`
  `GraphQueryTypeOption {
  value: unknown;
  label: unknown;
}`

- **`components-data-heatmap-calendar-grid-contracts`** — Supporting data types and helpers for this component family.
  `CalendarDay {
  date: unknown;
  value: unknown;
}`

- **`components-data-heatmap-heatmap-scale-contracts`** — Supporting data types and helpers for this component family.
  `linearAlpha(/* public names: value, lo, hi */): unknown`
  `sqrtStep(/* public names: count, max, steps */): unknown`

- **`components-data-heatmap-heatmap-contracts`** — Supporting data types and helpers for this component family.
  `CalendarCellPos {
  week: unknown;
  weekday: unknown;
  date: unknown;
}`
  `HeatmapAnnotation {
  row: unknown;
  col: unknown;
  date: unknown;
  label: unknown;
}`
  `HeatmapCalendarData {
  kind: unknown;
  days: unknown;
  firstDayOfWeek: unknown;
  columnX: unknown;
  index: unknown;
  rowY: unknown;
  weekday: unknown;
  weekdayLabelWidth: unknown;
  weekdayLabelText: unknown;
  jsWeekday: unknown;
  monthLabelText: unknown;
  jsMonth: unknown;
  year: unknown;
}`
  `HeatmapLegendStop {
  value: unknown;
  color: unknown;
  label: unknown;
  partOfRamp: unknown;
}`
  `HeatmapMatrixData {
  kind: unknown;
  rowLabels: unknown;
  colLabels: unknown;
  values: unknown;
}`
  `HeatmapSelectedCell {
  row: unknown;
  col: unknown;
  date: unknown;
}`
  `hexToRgb(/* public names: hex */): unknown`
  `MatrixCellPos {
  row: unknown;
  col: unknown;
}`
  `normalizeBucketCount(/* public names: bucketCount */): unknown`
  `resolveRgb(/* public names: color, fallbackHex, ownerDocument */): unknown`

- **`components-data-pagination-pagination-contracts`** — Supporting data types and helpers for this component family.
  `LyraPaginationChangeDetail {
  page: unknown;
  pageSize: unknown;
}`

- **`components-data-sequence-strip-sequence-strip-contracts`** — Supporting data types and helpers for this component family.
  `LyraSequenceStripActivateDetail {
  index: unknown;
  id: unknown;
  item: unknown;
}`
  `SequenceStripCategory {
  id: unknown;
  color: unknown;
  label: unknown;
}`
  `SequenceStripItem {
  id: unknown;
  categoryId: unknown;
  marker: unknown;
  label: unknown;
}`

- **`components-data-stat-stat-contracts`** — Supporting data types and helpers for this component family.
  `StatRow {
  label: unknown;
  value: unknown;
  exactValue: unknown;
}`

- **`components-data-table-table-contracts`** — Supporting data types and helpers for this component family.
  `TableColumn {
  key: unknown;
  label: unknown;
  headerCell: unknown;
  column: unknown;
  width: unknown;
  minWidth: unknown;
  maxWidth: unknown;
  resizable: unknown;
  sortable: unknown;
  sortValue: unknown;
  row: unknown;
  align: unknown;
  priority: unknown;
  sticky: unknown;
  footer: unknown;
  rows: unknown;
  cellStyle: unknown;
  cellTitle: unknown;
  heatValue: unknown;
  editTrigger: unknown;
  editValue: unknown;
  editType: unknown;
  cell: unknown;
}`
  `TableSortCommitDetail {
  phase: unknown;
  sortKey: unknown;
  sortDir: unknown;
}`
  `TableSortRequestDetail {
  phase: unknown;
  sortKey: unknown;
  sortDir: unknown;
}`

- **`components-data-tree-tree-types-contracts`** — Supporting data types and helpers for this component family.
  `LyraTreeNodeData {
  id: unknown;
  label: unknown;
  selected: unknown;
  disabled: unknown;
  lazy: unknown;
  children: unknown;
  badges: unknown;
  icon: unknown;
  description: unknown;
  accessibleLabel: unknown;
}`
  `TreeBadge {
  text: unknown;
  tone: unknown;
  label: unknown;
}`

- **`components-data-word-cloud-word-cloud-layout-contracts`** — Supporting data types and helpers for this component family.
  `WordCloudWord {
  text: unknown;
  weight: unknown;
  color: unknown;
  group: unknown;
}`

- **`components-data-word-cloud-word-cloud-contracts`** — Supporting data types and helpers for this component family.
  `WordCloudLegendItem {
  label: unknown;
  color: unknown;
}`
