## `lr-sparkline`

Zero-dependency inline SVG trend chart (mirrors `<wa-sparkline>`). Its default allocation is one
`em` tall at a `4 / 1` aspect ratio, so it can sit directly in text; authored block size changes
both dimensions through the aspect ratio.

An empty or removed `data` attribute uses the `values` collection. With no usable fallback samples,
no trend path is rendered. Attribute removal preserves `null` property readback, and supplying later
space-separated samples restores the attribute-driven path.
Derived values reuse the input array identity. Reassign after changes, or call `requestUpdate()`
after mutating the current array, to refresh the projection.
Large inputs retain at most 500 plotted samples, using the first and last finite samples plus
bucket minima and maxima in source order. The accessible summary reports the full finite count
and actual final value. Admission scans the current array or numeric string once without keeping
a second full numeric array; this existing input path still performs synchronous work proportional
to input length. Invalid samples are omitted, so plotted positions refer to finite-sample order.

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

**Prepared whole-source input:**

- `preparedData: LyraPreparedSeriesData | null = null` (attribute: false) — accepts exactly one
  ordered series with at most 500 semantic samples. While non-null it takes precedence over
  `data` and `values`, without reading either legacy input. Clearing it restores the legacy route.
  Invalid, accessor-backed, multiseries or oversized descriptors show localized unavailable text
  through `status`; they are never resampled or replaced by the raw fallback.
- Geometry uses original numeric x positions against the full `xDomain`, mirrored for RTL, and
  the full `yDomain`; explicit `min`/`max` still override the y scale. Source-index order is kept
  even when x is nonmonotonic. `breakBefore` splits every curve mode and each fill, so gaps are
  never joined. Valid empty/all-invalid input remains an empty graphic.
- The generated accessible summary reports full valid/invalid counts, displayed sample count,
  full y domain and endpoint trend. The naming precedence above still applies.
- Assignment, including the same reference, or explicit keyless `requestUpdate()` recaptures
  mutable descriptors. Named presentation updates reuse the bounded capture. Disconnect releases
  captured geometry; reconnect captures it again. The property still retains the caller's input
  and its closures until replaced or cleared.

Prepare data in host code with `prepareLyraSeriesData`, imported from
`@aceshooting/lyra-ui/utilities/data-preparation.js` (the same module exports
`LyraPreparedSeriesData`). Preparation scans all source positions in bounded yielding chunks and
accepts an `AbortSignal`; the host owns that work, cancellation and assignment of the current
result. Sparkline never calls `getPoint` or `queryRange` and starts no asynchronous source request.
It adds no table, CSV or source-selection event.

**Events:** none.

**Slots:** none.

**CSS parts:** `sparkline` and deprecated `base` are aliases on the same outer SVG, `fill` is the
area path for solid/gradient appearance, `line` is the stroke path, and the additive `bar` is each
extension-mode rectangle. `status` is the visible invalid-prepared-input message.

**Themeable custom properties:** `--fill-color` (area/gradient stop color), `--line-color` (stroke
color), and `--line-width` (stroke width). Each reads through the live CSS cascade; line/fill
default to the selected `trend`'s semantic Lyra tokens and `--line-width` falls back to
`--lr-border-width-medium`. Declare `--line-width` on the sparkline itself because this unprefixed name can also reach other elements that read it.
No canvas bridge or manual refresh is needed.

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
  values. Every legacy rendering mode (`mark="line"` with any appearance, or `mark="bar"`)
  retains at most 500 finite samples from `values` or numeric `data`: the first and last finite
  samples plus each source bucket's minimum and maximum, deduplicated and kept in source order.
  Buckets follow array positions or token offsets in the source string; plotted x positions follow
  finite-sample order. Values are never averaged, and global extrema are retained, so the automatic
  scale covers the full finite input range. `mark="bar"` renders at most 500 `<rect>`s; line marks
  bound the sample count in their path geometry. Prepared input is already bounded and is not
  reduced again.
- Point order mirrors under RTL while the numeric sample order remains unchanged. There are no
  animations, so reduced-motion mode needs no alternate timing branch.
- **9.0 migration:** rename additive `type="bar"`/`"line"` to `mark="bar"`/`"line"`. Replace
  `type="area"` with `mark="line" appearance="solid"`. `values` is now property-only, matching its
  array type; use mirrored `data` for declarative space-separated samples.

---

## `lr-stat`

KPI/stat card — value + unit + label + optional icon/trend/caption.

Passive slotted content preserves normal pointer activation and Control/Meta/Shift intent. The
platform primary modifier and Shift activate a new browsing context through the real anchor;
listeners may cancel that activation. Nested interactive controls retain their own actions.
Temporary target and relation values are restored after activation unless the listener changed those
attributes itself.

Removing `caption` or `sub` omits the attribute fallback without hiding assigned slot content.
Removal retains `null` property readback; explicit empty strings remain empty and later supplied
values render normally.

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
- `target?: string` — forwarded to the anchor while `href` is active; a nonempty target always adds
  `noopener noreferrer` to the anchor's `rel`
- `rel?: string` — author link-relationship tokens (`nofollow`, `external`, …) merged with that
  guard; `opener` is dropped
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
- `size?: LyraSize` (reflected, unset by default) — density on the library's one size ladder,
  `'2xs'|'xs'|'s'|'m'|'l'|'xl'` or `'small'|'medium'|'large'`. `s` and the steps below it select the
  compact density (tighter padding and gap for constrained spaces); `m` and above keep the default
  density, and leaving it unset renders exactly as before. An unsupported value normalizes to unset
  and removes the attribute.
- `frame: 'card'|'plain' = 'card'` (reflected) — container treatment, on the library-wide `frame`
  vocabulary. `'card'` keeps the bordered, filled, padded box that stretches to fill its
  parent; `'plain'` removes the border, background, padding, corner radius **and** the
  `block-size: 100%` stretch, so the stat can sit inline in prose, a toolbar, or a table cell.
  `plain` wins over the compact density when both are set (there is no padding left to tighten), and it drops
  `emphasis`'s accent edge — that edge is card chrome — while `emphasis`'s brand value tint still
  applies. A `plain` stat with a safe `href` swaps the card's border-color/lift hover affordance
  (invisible with no border) for an underline on `[part="value"]`; the `:focus-visible` ring is
  unchanged
- `orientation: 'vertical'|'horizontal' = 'vertical'` (reflected) — layout axis. `'vertical'` stacks
  label, value, trend, sub and caption. `'horizontal'` lays label, value+unit, trend, sub and caption
  out on a single wrapping baseline row; `[part="spark"]` and `[part="rows"]` have no sensible place
  on a text baseline and stay stacked on their own full-width line beneath that row

**Events:** none.

**Slots:** `start` (leading icon), `caption` (rich caption content —
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
Present metric and row labels expose the `term` role; their named values expose `definition`,
which supports these accessible names. A unit-only headline value also exposes `definition`
and includes the unit in its name. Values without a label or unit remain plain text; setting
`exactValue` still adds the existing focus stop and exact-value tooltip in an unlinked stat.

**Themeable custom properties:** `--lr-stat-bg` (default `var(--lr-color-surface)`) is
`[part="base"]`'s RESTING background — the tier a dashboard sits at all day, and the companion to
the linked card's existing pressed `--lr-stat-link-active-bg` (whose own default now mixes from
`--lr-stat-bg`, so one override retints both); `frame="plain"` still drops the fill entirely.
`--lr-stat-padding` (default `var(--lr-space-m)`) and
`--lr-stat-gap` (default `var(--lr-space-xs)`) control `[part="base"]`'s padding and gap in every
rendering path — the default card, the compact density (`size="s"` and below; own defaults `var(--lr-space-s)` /
`var(--lr-size-0-125rem)`), `frame="plain"` (own default `0` for padding), and the internal
`.linked-content` wrapper used when `href` is set, so one override reaches a linked and an
unlinked stat identically. `--lr-stat-trend-good-color` (default `var(--lr-color-success)`)
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

Duplicate root-row references appear once in rows, paging, facets, and CSV; the first caller-owned
record is retained. Interactive descendants (including open-shadow native controls) run without
`lr-cell-click`; passive content activates the cell.

```js
import "@aceshooting/lyra-ui/components/lr-data-grid.js";
```

Give the grid an accessible name with `label` or a host `aria-label`; the host attribute wins.
Collection inputs are clone-owned readonly snapshots: reassign `data`, `columns`, `groupBy`, and controlled
arrays after changes. Same-array rebinding/in-place mutation is ignored; call `requestUpdate()` after
row edits. Column records copy/freeze synchronously; row identities remain caller-owned.
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

Row details remain virtualized as part of their owning row's measured block. `--max-height: none`
still opts out of row virtualization. Wide grids mount columns intersecting the inline viewport
plus overscan, pinned columns, and the focused column; ARIA column positions refer to the complete
visible column sequence. Above 50 columns, CSS-resolved widths stay stable while scrolling; newly
mounted content fits those widths. Column definitions/widths, row projection, allocation, font
changes and explicit refresh recalculate them. Header, body and footer share these tracks.
Search and text filters reuse folded cells, sorting is independent of query changes, and
footers/aggregates reuse results until their row/column inputs change. Call `requestUpdate()` after
changing borrowed row content or callback-dependent external state in place.

**Properties:**

- `appearance: 'outlined' | 'plain' = 'outlined'` (`appearance`, reflected).
- `childRows: string | ((row) => readonly Row[] | undefined) | null = null` (`child-rows`) — dot path or
  callback for nested rows. Tree sorting stays within each parent and paging keeps a subtree with
  its top-level parent. Projection is iterative, cycle-safe, and bounded to `maxRows` total rows and
  64 descendant levels; exceeding a budget renders the localized `tree-limit` notice.
- `columnOrder: readonly string[] = []` (JS-only) — empty preserves declaration order.
- `columns: readonly DataGridColumn<Row>[] = []` (JS-only).
- `data: readonly Row[] = []` (JS-only) — client rows, or the currently loaded server page.
  Flat input beyond `maxRows` rows shows the localized `row-limit` notice; nested input retains its
  `tree-limit` notice when the node or depth budget is reached.
- `maxRows: number = 10000` (`max-rows`) — client-row and tree-descendant admission limit,
  normalized to 1–100,000. Set it before assigning `data`; after raising it, reassign the source
  array to restore excluded rows. Admission reads at most `maxRows` source positions through own
  data descriptors while preserving row object identities. Tree depth remains bounded to 64
  descendant levels, and column definitions retain at most 10,000 entries. Controlled selected
  and expanded keys remain independent of this row-admission cap.
- `dataSource: ((request) => Promise<{ rows, total }>) | null = null` (JS-only) — providing it
  enables server behavior.
- `error: boolean = false` (`error`, reflected) — replaces the body row with the failed-load
  `<lr-empty>` while keeping the header, toolbar, and pager mounted. `loading` takes precedence,
  then `error`, then empty/no-column/no-result states. It is host-controlled: `dataSource`
  rejections emit `lr-data-error` but retain prior rows. Set `error = true` in that listener if a
  rejection should replace them.
- `errorHeading?: string` (`error-heading`) — failed-load heading override. Omitted localizes
  `<lr-table>`'s own `tableLoadFailed` default.
- `errorDescription: string = ''` (`error-description`) — failed-load supporting copy.
- `expandedRowKeys: readonly Array<string | number> = []` (JS-only).
  The mirrored `expandedKeys` spelling remains a compatibility alias for this same state.
- `filterDebounce: number = 250` (`filter-debounce`) — finite server search/filter delay.
- `filteredCount: number` (read-only, JS-only) — matching client rows before paging.
- `dataTruncated: boolean` (read-only, JS-only) — true when projection drops input over `maxRows` rows
  or 64 nesting levels; controlled `selectedRowKeys` remain because omitted keys may exist.
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
- `rowKey: string | ((row: Row) => DataGridKey | null | undefined) | null = null` (`row-key`) — dot
  path/callback for stable identity. Selection/expansion keys accept iterables and read back frozen.
- `searchFn: ((value, term, row) => boolean) | null = null` (JS-only).
- `searchTerm: string = ''` (JS-only).
- `selectable: '' | 'single' | 'multiple' | 'none' = 'none'` (`selectable`, reflected) — a bare
  `selectable` attribute means `multiple`.
- `selectableRows: ((row) => boolean) | null = null` (JS-only).
- `selectedRowKeys: readonly Array<string | number> = []` (JS-only).
  The mirrored `selectedKeys` spelling remains a compatibility alias for this same state.
- `selectedRows: readonly Row[]` (writable, JS-only) — assigning rows that belong to the current source
  maps them to `selectedRowKeys`; detached rows are ignored and single-selection mode keeps the first.
- `selectionMode: 'none' | 'single' | 'multiple'` (`selection-mode`) — `<lr-table>` spelling
  for `selectable`; both names read and write the same state, so they cannot drift. `selectable`
  remains canonical to mirror `wa-data-grid`; its bare `''` value reads as `'multiple'` here.
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
`minWidth` / `maxWidth`, `flex`, `formatter(value, row)`, `cellTitle(row)`, computed `value(row)`,
`sortable`, `sortFn`, `comparator`, `sortDescFirst`, `sortUndefined`, `searchable`, `filterable`,
`filterType`, `filterFn`, `hidden`, `hideable`, `resizable`, `movable`, `pinnable`, `pinned`,
`footer`, `aggregation`, and `aggregatedFormatter`. A column with neither `field` nor `value` is an
action column: its formatter receives `undefined`, and it is not sorted or searched by default.
An omitted or explicitly blank (or whitespace-only) `label` both render the same humanized
`field`/`id` fallback for the header cell — only a non-blank `label` overrides it.
`cellTitle(row) => string | undefined` mirrors `<lr-table>`'s `columns[].cellTitle`, setting the
native `title` for ellipsized text or a timestamp behind relative text. Returning `undefined` or
`''` omits `title`, preserving an ancestor's tooltip.

Built-in sort algorithms are `alphanumeric`, `alphanumericCaseSensitive`, `text`,
`textCaseSensitive`, `datetime`, and `basic`; `comparator` takes precedence. Built-in filter types
are `text`, `equals`, `number-range`, `date-range`, `set`, `includes-any`, and `includes-all`;
`filterFn` takes precedence in client mode. A `date-range` `[start, end]` includes the end day;
`YYYY-MM-DD` bounds/values use local midnight through day end, not UTC. Group aggregations are
`sum`, `min`, `max`, `mean`,
`median`, `count`, `unique`, `uniqueCount`, `extent`, or a callback.

**Methods:**

- `autoSizeColumn(columnId)` and `autoSizeColumns()` manage measured widths. `sizeColumnsToFit()`
  reserves visible effective zero-flex column widths and selection-control allocation before
  dividing the remaining width proportionally among flexible columns. Fixed widths are preserved;
  min/max clamps still apply, and an all-fixed grid is unchanged. Maximum clamps can leave unused
  space, while incompatible minimum widths can still overflow.
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

**Server mode:** `dataSource` receives `{ sort, filters, search, page, pageSize, signal }`. A new
query immediately aborts and supersedes the previous request, including while its replacement
waits for `filterDebounce`. Obsolete results and errors cannot update the grid even when a loader
ignores the signal. A rejected current request keeps prior rows and emits `lr-data-error`.
Filter/search requests use `filterDebounce`; sorting and paging load immediately.
For event-driven loading, set `server`, listen to the mirrored `request` event, and assign `data`,
`total`, and `loading` yourself. The redundant Lyra-only `lr-data-request` event was removed in
9.0.0; rename that listener to `request`. Each dispatch carries a fresh frozen detail that cannot
mutate the component or loader request.

**Keyboard:** headers/cells share one roving stop; scrollable `body` is focusable for panning.
Arrows traverse cells. At a row's first cell, ArrowRight expands a collapsed tree/detail/group row;
ArrowLeft collapses an expanded row or focuses a collapsed nested tree row's parent. Otherwise they
navigate. Row/group selection controls and group expand buttons are not Tab stops: Space on a row
cell toggles selection, and on group rows only in `multiple` mode. Header select-all, filter,
column-menu, and resize controls remain Tab stops. Selection controls are named by localized
"Select" plus the first visible cell; selection sets `aria-multiselectable`. Alt+Arrow/Cmd+Arrow
stay browser history. Separator ArrowLeft/ArrowRight resizes 10px (Shift: 50px); Home/End set min/
authored max. Home/End reach a row's first/last cell; Ctrl+Home/End reach grid ends; PageUp/Down page; Enter
sorts/activates; Space selects; Shift+Arrow reorders headers; Ctrl+A selects the current page;
Ctrl+C copies; Shift+F10 requests a cell context menu. Inline arrows swap under RTL; formatter
descendants keep their own keys.

**Events:** `lr-request` followed by `request` for a server-data request (each carries sort,
filters, search, page, page size, and an abort signal); `lr-cell-click` and cancelable `lr-cell-contextmenu` (canonical `rowKey`/
`columnId` plus row, column, value, and display index; vetoing the latter suppresses the native menu);
`lr-column-move`, `lr-column-pin`, `lr-column-visibility-change`; `lr-column-resize`
(`detail: { columnId, columnKey, width, finished }`; `columnKey` mirrors the table's name for the
same id; `finished` marks commit); cancelable `lr-column-resize-request`
(`{ columnId, columnKey, width }`)
proposes committed keyboard/drag-end widths; veto
keeps the previous width and discards preview. `pointerup` commits; cancel/lost capture restores the
exact pre-gesture width, emits it with `finished: false` after live movement, never canceled
`finished: true`. `lr-data-error`, `lr-filter-change`, `lr-page-change`;
`lr-search-change` (`{ searchTerm }` after user edits/clears `with-search`, not programmatic
writes); `lr-row-collapse`, `lr-row-expand`, `lr-group-collapse`, and `lr-group-expand` (`{ key, columnId, value, rows }` group snapshots); `lr-row-select` (canonical
`{ selectedRowKeys, selectedRows }`, plus `selectedKeys`);
row expand/collapse details use canonical `rowKey` plus mirrored `key`. Cancelable
`lr-sort-request` (readonly `{ sort }`) precedes `lr-sort-change`; veto leaves sort unchanged
and suppresses `lr-sort-change`.
Grid detail is `{ sort }`; `<lr-table>` emits `lr-sort` with `{ phase, sortKey, sortDir }`.
`lr-copy` (`{ ok: true, text }` on fulfillment); `lr-copy-error` (`{ ok: false, text, reason, error }` on failure); `lr-error` is a compatibility notice without raw
platform text. `lr-retry-request` (`detail: null`, cancelable) means the built-in retry
button was activated while `error` is set; its default clears `error`, and veto leaves it set.
All library events bubble and are composed. Cancelable events: `lr-cell-contextmenu`,
`lr-column-resize-request`, `lr-sort-request`, and `lr-retry-request`. Details and owned collections
are frozen. Toolbar-search and column-filter inputs re-emit `focus`/`blur` once from the host as
bubbling, composed native `FocusEvent`s, preserving `relatedTarget`.

**Row context menus with `lr-context-menu`.** Wrap the grid in an `lr-context-menu` region and
leave `lr-cell-contextmenu` **un-prevented**: preventing it suppresses the native menu, and the
context menu ignores a native event that is already prevented (the opposite polarity from its own
`lr-show`, where preventing *allows* the platform menu). For a right-click and for Shift+F10 the
grid's `lr-cell-contextmenu` arrives **before** the context menu's `lr-show`, so store its `rowKey`
and read it in `lr-show`. For the ContextMenu key the grid only emits `lr-cell-contextmenu` from the
platform's follow-up `contextmenu`, which arrives **after** `lr-show` and not on every operating
system, so rows computed from it would be stale: update the rows again in `lr-cell-contextmenu`
when the menu is already open (rows changed while open are repaired by the menu), or fall back to
`selectedRowKeys`.

**Slots:** `empty`, `loading`, `no-results`, `error` (replaces the built-in failed-load state,
including its retry button, while `error` is set).

**CSS parts:** `body`, `cell`, `column-menu`, `column-menu-button`, `columns-menu`, `data-grid`,
`drag-ghost`, `ellipsis`, `empty`, `error-row` (the single full-width row that replaces the body
content while `error` is set), `error-cell`, `error` (the built-in `<lr-empty>` host), `error-base`,
`error-icon`, `error-heading`, `error-description`, `error-actions` (all four exported from the
built-in error `<lr-empty>`'s own parts), `retry-button` (the built-in retry control), `expand-button`,
`filter-button`, `filter-panel`,
`filter-panel-clear` (clears the active column filter editor, replacing the native search-cancel
glyph the component resets; rendered only while it has a value), `first-button`,
`first-icon`, `footer`, `footer-cell`, `footer-row`, `group-count`, `group-row`, `group-value`,
`header`, `header-cell`, `last-button`, `last-icon`, `live-region`, `loading-overlay`,
`next-button`, `next-icon`, `no-results`, `page`, `page-current`, `page-size`, `pager`,
`pager-button`, `pin-indicator`, `previous-button`, `previous-icon`,
`resize-handle`, `row`, `row-detail`, `search`, `search-wrapper` (the row wrapper around `search`
and `search-clear`), `search-clear` (clears the global row-search input, replacing the native
search-cancel glyph the component resets; rendered only while it has a value),
`select-all-checkbox`, `sort-indicator`,
`sort-number`, `table`, `toolbar`, `row-limit`, `tree-limit`.

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
`--transition-duration`. Defaults resolve through Lyra design tokens. The optional
`--lr-theme-table-row-height` supplies a minimum alongside the grid's existing size-specific
baseline. Density scales that baseline and minimum together; it never makes every size share one
fixed row height. `--row-height` and `--header-row-height` remain explicit component overrides,
subject to a 24px minimum and the active density's target floor. Virtual-row estimates read the
same resolved height as the CSS, and measured content may make individual rows taller.
`--lr-theme-border-radius-container` changes the outer frame while control corners keep their own
radius; `--border-radius` continues to override both. Set `--max-height: none` to
render every row instead of a virtual window. `--border-color` (default `var(--lr-color-border)`)
paints the control boundaries (search, buttons, page size) and, unless the separate grid-line hook
is set, the grid lines too. `--lr-data-grid-line-color` (default
`var(--border-color, var(--lr-color-border-subtle))`) paints only the decorative grid lines: the
outer edge, header, row, cell and footer separators, and the toolbar and pager rules. It defaults to
the subtle tier, so a theme such as the shadcn preset softens the grid while the controls keep a
3:1 boundary. Three grid-specific hooks reach formatter and row
detail content inside the shadow root: `--lr-data-grid-cell-color` (default `inherit`) controls
body-cell text, `--lr-data-grid-cell-link-color` (default `var(--lr-color-brand)`) controls nested
anchors, and `--lr-data-grid-cell-link-hover-color` (default
`var(--lr-data-grid-cell-link-color, var(--lr-color-brand))`) controls those anchors on hover,
focus-visible, and active interaction. Set the link color to `revert` to restore the user-agent
default. Six independent interaction-background hooks preserve those state boundaries:
`--lr-data-grid-control-hover-bg` and `--lr-data-grid-control-active-bg` theme
search, toolbar, pager, and resize controls; `--lr-data-grid-page-size-active-bg` themes
the page-size selector when pressed; `--lr-data-grid-row-active-bg` themes pressed data
rows; and `--lr-data-grid-sortable-header-hover-bg` and
`--lr-data-grid-sortable-header-active-bg` theme sortable header states. They default to
live `color-mix()` values of the effective grid accent and transparent, using the corresponding
`--lr-color-mix-hover` or `--lr-color-mix-active` token (the page-size pressed state intentionally
uses the hover mix), so an accent override remains coherent while each surface can still be
overridden independently.

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

Sort/select-aware table with a bounded 100-row default page, filtering, pagination, and loading
states. Sort requests are cancelable; accepted client requests update `sortKey`/`sortDir` and order
rows, while server mode leaves that state controlled. `columns[].heatValue` opts into a shared heat
scale; `rowTotal`/`grandTotal` position caller-computed totals in a trailing column.

Effective locale changes recollate and filter the current view while keeping activation and edit
lookups aligned with the rendered page. Direct row focus uses the same stable-key restoration rules;
programmatic locale changes do not emit a row action.

Header cells and body rows use separate roving tab stops. When a controlled `columns` or rendered
row collection changes while one of those stops owns focus, the table keeps the same stable key if
it survives and otherwise clamps focus to the nearest surviving index. Moving focus outside the
table before the update is applied always wins; nested editors and controls keep their independent
focus contracts.

For historical migration mappings, see the [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
Current property and event contracts follow.

**TypeScript:** `LyraTable<T, K extends string | number = string | number>` takes a second type
parameter for the row-key type. `K` types `rowKey`'s return value,
`selectedRowKeys`/`expandedRowKeys`, and every event detail's `rowKey`/`selectedRowKeys`, so
`LyraTable<Row, number>` reads `event.detail.rowKey` as `number` with no cast. It defaults to the
`string | number` union, so an untyped element and an existing `LyraTable<Row>` annotation compile
unchanged.

**Properties:**

- `columns: readonly TableColumn<T>[] = []` (attribute: false; clone-owned frozen collection,
  bounded to the first 10,000 source positions; blank keys and later duplicates are omitted first-wins
  before header, cell, sort, focus, and event paths; reassign to update) — `{ key, label, ariaLabel?,
headerCell?, width?, minWidth?, maxWidth?,
resizable?, sortable?, sortValue?, defaultSortDir?: 'asc'|'desc', align?: 'start'|'end',
priority?: 'medium'|'low',
sticky?: 'start'|'end', editTrigger?: 'double-click'|'always', editValue?, editLabel?: (row) => string,
editType?: 'text'|'number'|'select',
editOptions?: { value: string; label: string }[], footer?, cellStyle?, heatValue?,
cell: (row) => unknown }` — `cell` is required for every `editTrigger` except `'always'`, whose
  persistent editor renders unconditionally so the table's render path never falls back to it —
  `ariaLabel` overrides that column header's accessible name (applied as the `<th>`'s `aria-label`
  whenever set) — e.g. an icon-only `headerCell` with no plain-text `label` to fall back on; when
  `label` is blank (or whitespace-only) and `ariaLabel` is also omitted, the header's accessible
  name falls back to `key` while the visible header itself stays blank, matching a deliberate
  icon-only column —
  `sortValue(row) => string | number | null | undefined` supplies the comparable value backing
  client-mode sorting for that column: a finite number sorts numerically, a string sorts through an
  `Intl.Collator` built from the component's effective locale with `numeric: true` (so `item2`
  precedes `item10`), and `null`/`undefined`/non-finite sorts **last in both directions** so
  flipping `sortDir` never floats a block of blanks to the top. Omit it and the column sorts by its
  stringified `cell()` output instead — meaningful only when `cell()` returns a string or number, so
  define `sortValue` whenever `cell()` returns a template or element. Ignored under
  `sortMode="server"` and on a column that is not `sortable`;
  `defaultSortDir` sets this column's own initial sort direction the first time header activation
  makes it the active `sortKey`, taking precedence over the element-level `defaultSortDir` (see
  below), which remains the fallback when this is omitted — useful for giving one column in an
  otherwise-ascending table (e.g. a "last updated" column) the opposite starting direction.
  Re-activating a column that is already `sortKey` still only toggles between `'asc'` and `'desc'`,
  exactly as the element-level `defaultSortDir` already does;
  `priority` hides a column when its `[part='base']` content overflows: `'low'` hides first,
  then `'medium'` if overflow remains. It uses the `ResizeObserver` check from
  `scroll-mode="auto"`, adapts to actual overflow rather than a fixed token threshold, and can be
  reversed with `[part='reveal-columns-button']`; `sticky` pins headers/cells to the logical start
  or end while scrolling. Sticky columns stack in logical order using
  `--lr-table-sticky-offset` rather than overlap. Open overlays in a sticky cell stay on top. A sticky body cell's
  background always matches its own row's effective fill — striped, selected, hovered, or pressed —
  rather than painting a flat opaque surface over that state; a sticky header cell is unaffected
  (headers are never striped/selected) and keeps its plain surface fill, see
  `--lr-table-row-selected-bg`/`--lr-table-row-stripe-bg` below; `footer` renders a
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
  `editTrigger: 'double-click'` opens a native editor on that cell's double-click, `F2`, or `Enter`
  (one cell at a time), while `'always'` renders a persistent editor in every body cell from first paint, for a
  settings/rate-style column meant to be typed straight into — while `editValue` supplies the editor
  value and `editType` selects `'text'`, `'number'`, or `'select'` (a native `<select>` populated
  from `editOptions: { value: string; label: string }[]`, one `<option>` per entry in order; a
  `'select'` column with no `editOptions` renders an empty, valueless `<select>` instead of
  throwing); `editLabel(row) => string`, read once per row exactly like `editValue`/`cellTitle`,
  overrides that editor's accessible name — omit it and every editor in the column shares the same
  interpolated `tableEditCell` name instead (see the accessibility note under `editTrigger` below)
  `cellTitle(row) => string | undefined` is the `title` analogue of `cellStyle`, applied directly to
  the generated `<td>` — e.g. the untruncated text behind an ellipsized cell, or a formatted
  timestamp behind a relative one;
  `resizable` adds a focusable separator `[part='resize-handle']` and emits `lr-column-resize` with
  the live width in CSS pixels. Drag it, or use logical ArrowLeft/ArrowRight for 10px steps (mirrored
  under RTL), Shift+Arrow for 50px steps, Home for the minimum, and End for an explicit pixel
  `maxWidth`; explicit pixel `minWidth`/`maxWidth` values bound both input paths. The separator
  exposes its current/minimum/bounded-maximum pixel width through ARIA value attributes. Only the
  _commit_ is vetoable — see `lr-column-resize-request` under Events.
- **`cellStyle` beats `heatValue`, always.** `styleMap` writes an inline `style=` attribute, and an
  inline style outranks any stylesheet rule in the cascade regardless of specificity, while the heat
  tint is painted by a shadow-stylesheet rule. So a `cellStyle` returning
  `background`/`backgroundColor` on a column that also defines `heatValue` silently and completely
  erases that column's tint — no warning, and the cell still contributes to the shared domain, so the
  _other_ tinted columns' scale shifts around a cell that shows no tint at all. Define both on one
  column only when that override is the intent; to tint _and_ style, return only non-background
  declarations (`color`, `fontWeight`, `textAlign`, …) from `cellStyle`.
- `columns[].editTrigger: 'double-click' | 'always'` — `'double-click'` opens one transient editor:
  Enter commits/closes, Escape cancels/closes, and native `change` commits (including blur after
  a text edit). `'always'` renders
  persistent editors in every body cell of that column.
  - **Keyboard entry (`'double-click'`).** Resting editable cells carry `tabindex="-1"` and
    `[data-editable]`. From the focused row, ArrowRight enters the first editable cell and advances;
    ArrowLeft moves back, returning to the row from the first cell (directions reverse under RTL).
    These arrow-reachable cells add no page Tab stops. Without an `editTrigger` column, no editable
    cell `tabindex`/`[data-editable]` is rendered. `F2`/`Enter` on the cell or
    `editCell(rowKey, columnKey)` opens its editor; Enter on the row still activates the row.
    Commit/cancel restores focus to the opening cell.
  - **Focus (`'always'`).** Editors have no explicit `tabindex`: like row-expand toggles, they are
    ordinary Tab stops outside header/row/cell roving focus. Tab walks down the column; arrows
    navigate from the row stop but move the caret inside fields. Non-editable columns are unchanged.
  - **Value binding.** Persistent text/number editors bind the `value` content attribute, not
    `.value`, preserving native dirty-value semantics: new `rows` values update untouched editors
    but cannot replace a typed draft. Persistent selects have no equivalent protection;
    refreshed rows re-apply their selection even over an uncommitted choice. `lr-cell-edit` is
    the only mutation channel; the table never mutates `row`.
  - **Keys (`'always'`).** Enter emits `lr-cell-edit` and keeps field focus. `change` commits in
    both modes. Escape neither changes the persistent editor nor cancels
    the event, so ancestor dialogs/popovers can handle it.
  - **Re-sorts/pages.** Keyed rows move the existing input with its draft; focus is restored to the
    same logical cell after sorting. If filtering/pagination removes that row from the page, focus
    is lost rather than moved to an unrelated replacement row.
  - **Accessible names.** `editLabel(row)` overrides the default localized `tableEditCell`
    (`Edit {column}`), which has no row context. The default is adequate for the single transient
    editor. Always define `editLabel` for persistent editors: repeated identical names (e.g. fifty
    “Edit Status” comboboxes) fail WCAG 2.4.6 and 1.3.1; each row needs a distinct editor name.
- `hasHiddenPriorityColumns: boolean = false` (attribute `has-hidden-priority-columns`, reflected) —
  computed/read-only and true only while a priority column is actually hidden. It becomes false
  when `priorityColumnsVisible` reveals the columns. Measured via a `ResizeObserver` on
  `[part='base']` plus a post-render DOM check, so it settles one render cycle after a `columns`/
  `rows`/width change lands — poll for the settled value (e.g. `await el.updateComplete;` twice, or
  `waitUntil()`) rather than assuming a single `updateComplete` covers it. Setting it directly has no
  lasting effect; it is recomputed on the next render or resize. The toggle remains available while
  a narrow table is revealed, even though this property truthfully reports false
- `rows: readonly T[] = []` (attribute: false; clone-owned frozen collection bounded to the first
  `maxRows` rows, 10,000 by default; reassign a new array to update — rebinding the array `rows`, `columns`,
  `selectedRowKeys` or `expandedRowKeys` last received is a no-op). Records are retained
  here; one canonical `rowKey` projection omits blank and later-duplicate identities first-wins
  before filtering, counts, pagination, focus, actions, and events
- `maxRows: number = 10000` (attribute `max-rows`) — row and controlled-key admission limit,
  normalized to 1–100,000; non-finite values use the default. Configure it before assigning `rows`.
  After changing it, assign a new row collection to deterministically supply rows excluded by the
  previous cap. A cap change can also reread the original collection while the caller retains it;
  recovery does not depend on keeping that source alive. Column inspection remains bounded to
  10,000 source positions. Pagination still renders 100 rows by default and at most 500 per page.
  Lowering the cap also trims retained selected and expanded key sets without emitting selection
  or expansion events. Reassign controlled key collections after raising it to restore excluded keys.
  At the key cap, existing keys retain priority over a newly toggled key; selection and expansion
  events report the actual retained state.
- `layout: 'auto'|'fixed' = 'auto'` (reflected) — a **floor** on the `<table>`'s `table-layout`, not
  an override. `'fixed'` forces the fixed algorithm even when no column declares a `width`, so every
  column shares the available width evenly and long cell content is clipped/wrapped instead of
  stretching its column. The default `'auto'` still _resolves_ to `fixed` whenever a column declares
  a `width`, a column has been drag-resized, or a resize gesture is in flight — column resizing does
  not work under `table-layout: auto`, so `'auto'` can never mean "never fixed". See the gotchas for
  the two consequences of the fixed algorithm worth knowing before opting in
- `sortKey: string = ''` (attribute `sort-key`)
- `sortDir: 'asc'|'desc' = 'asc'` (attribute `sort-dir`)
- `sortIndicators: TableSortIndicators = 'active'` (attribute `sort-indicators`) — `'all'` adds a
  muted bidirectional indicator to each inactive sortable header, reserving the same space as the
  active chevron. The default retains only the active column's indicator. This presentation does
  not change keyboard interaction, client/server sorting, or `aria-sort="none"` on inactive columns.
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
  ever sorted, for any column that does not declare its own `columns[].defaultSortDir` (that
  column-level value wins first when set — see `columns` above). Re-activating the column that is
  already `sortKey` toggles between `'asc'` and `'desc'` instead, so `defaultSortDir` never
  overrides a direction the user just chose for the column they are still on. Set `'desc'` for a
  most-recent-first or highest-first table
- `viewRows: readonly T[]` (readonly; computed, no attribute) — `rows` after filtering and
  (client-mode) sorting, ignoring pagination — the same set `columns[].footer(rows)`/
  `grandTotal(rows)`/the heat-tint domain already compute over. Read this instead of
  re-implementing filtering/sorting in a consumer that needs "what the grid currently shows" (e.g.
  to export it). The frozen projection retains its identity until row, sort or filter inputs change.
  Row objects retain their existing identity contract
- `pageRows: readonly T[]` (readonly; computed, no attribute) — `viewRows` sliced to the page
  currently rendered in `<tbody>`. This frozen projection retains its identity until its row,
  sort, filter or page inputs change
- `rowsTruncated: boolean` (readonly) — `true` when the assigned rows exceed admission capacity;
  excluded rows are not shown, counted, paged or exported. The localized `row-limit` part reports
  the number actually retained, and post-mount truncation changes are announced politely.
- `rowKey?: (row: T) => K` (attribute: false) — derives each row's stable identity for
  DOM-reconciliation and the delegated row click/keydown lookup; falls back to the row's array index
  when omitted, which is only safe while `rows` never reorders — set it whenever `rows` can be
  sorted/filtered/re-ordered across renders, or selection/click can silently attach to the wrong
  row. Empty string identities and later duplicates are omitted; the first valid occurrence wins.
  The element's second type parameter (`K`, default `string | number`) is this callback's return
  type
- `selectionMode: 'none'|'single'|'multiple' = 'none'` (attribute `selection-mode`, reflected) —
  opt-in self-managed row selection; the default remains presentational
- `selectedRowKeys: ReadonlySet<string | number> = new Set()` (attribute: false) — the single selection
  store in every mode, bounded to `maxRows` keys. Single mode enforces at most one key; multiple mode
  toggles membership. Malformed and whitespace-only string keys are omitted, while valid
  unmatched/off-page keys remain controlled state for server pagination. Reads return immutable detached `ReadonlySet`
  facades; reassign a new set to update
- `filterable: boolean = false` (attribute `filterable`, reflected) — renders a localized search
  field above the grid
- `filterText: string = ''` (attribute `filter-text`) — controlled filter text. Removing the
  attribute clears the effective filter safely while retaining native removal readback; a later
  supplied value filters normally.
- `filter?: (row: T, text: string) => boolean` (attribute: false) — typed predicate used by the
  filter field; when omitted, rows are matched against their JSON representation. Default search
  reuses locale-folded text for primitive and frozen scalar records. Mutable rows, nested containers,
  accessors and custom `toJSON` retain per-query reads; reassign collections after data changes to
  invalidate sorted and aggregate projections
- `filterLabel?: string` (attribute `filter-label`) and `filterPlaceholder?: string`
  (attribute `filter-placeholder`) — omission localizes `tableFilterLabel`/
  `tableFilterPlaceholder`; any supplied string, including the built-in English text or `''`, is
  an explicit verbatim override
- `spellcheck: boolean = true`, `autocapitalize: string = ''`, `autoCorrect: string = ''`
  (attribute `autocorrect`) — forwarded to the filter input and, for a `'text'` (the default)
  `editType`, the inline cell editor; no effect on a `'number'` or `'select'` cell editor. `spellcheck="false"`
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
- `unknownTotal: boolean = false` (attribute `unknown-total`, reflected) — server pagination with
  no total, only `hasNext`: the pager's indeterminate mode (previous/next only). Ignored outside
  `paginationMode: 'server'`
- `hasNext: boolean = true` (attribute `has-next`, reflected) — whether another page exists;
  read only with `unknownTotal`
- `paginationWithSummary: boolean = false` (attribute `pagination-with-summary`, reflected) —
  pager item-range summary at the inline start, controls at the inline end
- `paginationFormat: 'standard'|'compact' = 'compact'` (attribute `pagination-format`) — pager
  `format`; invalid values resolve to `compact`
- Editable columns emit `lr-cell-edit` on commit and never mutate the supplied row object.
- `groupBy?: (row: T) => string | number` (attribute: false) — inserts a non-focusable full-width
  group row wherever this key changes between consecutive rendered rows. Supply `rows` with each
  group already contiguous; the table renders the groups in their first-appearance order in `rows`
  and never reorders them. A client-mode sort is applied **within** each group, so sorting a
  grouped table on a column unrelated to the group key reorders rows inside their groups and
  leaves the grouping intact. The one exception: when the sorted column's value is constant inside
  every group — the group column itself, most obviously — there is nothing to reorder within a
  group, so the **groups** are ordered by that value instead. To force another group order,
  pre-sort `rows` or use `sort-mode="server"`.
- `groupLabel?: (key: string | number, rows: readonly T[]) => unknown` (attribute: false) — custom group
  header content; without it, the group key is rendered as text
- `expandedContent?: (row: T) => unknown` (attribute: false) — enables a leading expand toggle and
  renders a full-width detail row beneath expanded records. The visually empty toggle-column
  header has the localized accessible name `details` (overridable through `.strings`). The returned content renders inside
  the component's shadow root, behind the `expanded-cell` part — page CSS cannot reach it, and
  `::part(expanded-cell)` only reaches the wrapping `<td>` itself, not the descendants this
  callback returns (the same `::part()` limitation a column's `cell(row)` anchors run into, see
  `--lr-table-cell-link-color` below). Style such content by returning already-styled elements —
  inline `style`, or elements that reference this table's own `--lr-*` design tokens, which
  inherit across the shadow boundary like any custom property. When script has to reach the
  rendered panel anyway, `expandedContentElement(rowKey)` (below) resolves that `<td>`;
  `rowElement(rowKey)` does not, because the panel is a sibling `<tr>` rather than part of the row
- `canExpand?: (row: T) => boolean` (attribute: false) — optional per-row gate for expansion
- `rowExpandLabel?: (row: T, expanded: boolean) => string | undefined` (attribute: false) —
  accessible name for one row's expand/collapse chevron, read once per render for that row,
  exactly like a column's `editLabel`/`cellTitle`; consumer-owned text used verbatim, never
  passed through localization. Omit it and every chevron shares the same localized
  `expand`/`collapse` name, which carries no row context — fine for a handful of rows, but each
  chevron is its own Tab stop, so a long table otherwise announces the same two names over and
  over with no way to tell the rows apart. There is no default row context to derive one from
  here: this component has no row-header notion (`rowKey` is an opaque identity, not a label)
- `expansionMode: 'none'|'single'|'multiple' = 'none'` (attribute `expansion-mode`, reflected) —
  mirrors `selectionMode` member for member, for expansion. The default `'none'` keeps
  `expandedRowKeys` fully consumer-controlled: an activation only reports `lr-row-expand-toggle`.
  `'single'` and `'multiple'` self-manage the set behind the cancelable `lr-row-expand-request`, so
  an expandable table needs no host handler at all; `'single'` keeps at most one row open and
  coerces an already-larger `expandedRowKeys` down to its first key when this property becomes
  `'single'` (no event for that fix-up — read `expandedRowKeys` back). Closing a row to make room
  for another is an ordinary expansion change, so `'single'` reports the displaced row with its own
  `lr-row-expand-toggle` (`expanded: false`) immediately **before** the accepted one — the one
  exception being a displaced row that is filtered or paged out of view, which has no `row` object
  for the detail to carry and is reported through `expandedRowKeys` alone. An unrecognized attribute
  value falls back to the controlled behaviour rather than self-managing
- `expandedRowKeys: ReadonlySet<string | number> = new Set()` (attribute: false; `ReadonlySet<K>` on a
  parameterized element) — expanded state bounded to `maxRows` keys. Who writes it depends on
  `expansionMode`: under the default `'none'` the table never mutates it and consumers reassign it
  after `lr-row-expand-toggle`; under `'single'`/`'multiple'` the table writes it on each accepted
  activation, and a `preventDefault()` on `lr-row-expand-request` hands that one change back.
  Malformed and whitespace-only string keys are omitted while valid off-view keys remain controlled
  in every mode — filtering, sorting and pagination never clear them, so a row paged or filtered out
  of view comes back expanded and a key matching no current row simply renders nothing until one
  exists again (the same convention `selectedRowKeys` follows for server pagination). Reads return
  immutable detached `ReadonlySet` facades; reassign a new set to update
- `hasMore: boolean = false` (attribute `has-more`, reflected)
- `loadingMore: boolean = false` (attribute `loading-more`, reflected) — controlled busy state.
  With `hasMore`, retains rows and focusable `more-button`, sets `aria-busy`/`aria-disabled` true,
  and blocks pointer/keyboard requests. Set before awaiting data; clear when settled and reassign
  `rows`. It never fetches/appends. `hasMore` controls button presence; `loading` remains full-table.
- `loadingMoreLabel?: string` (attribute `loading-more-label`) — omission renders localized
  `tableLoadingMore` (`'Loading more rows'`); supplied strings including `''` are verbatim. After mount,
  transitions into loading announce through the shared polite light-DOM sink only while the
  continuation is visible and `loading` is false; initial busy state is silent.
- `moreLabel?: string` (attribute `more-label`) — omission renders localized `loadMore` (`'Load more'` in the built-in English catalog); a supplied string, including `''`, renders verbatim
- `error: boolean = false` (attribute `error`, reflected) — replaces `<tbody>`'s row content with
  a built-in failed-load state while keeping the surrounding `<thead>`, filter field, and
  pagination mounted — unlike either data-empty branch below, which this state overrides and which
  replace that chrome too. Precedence when more than one state could apply at once: `loading` beats
  `error` beats every empty branch, so a `loading` table never shows a stale `error`, and an
  `error` table never falls through to "no rows"/"no columns" copy underneath it.
- `errorHeading?: string` (attribute `error-heading`) — omission renders localized
  `tableLoadFailed` (`'Could not load data'` in the built-in English catalog); a supplied string,
  including `''`, renders verbatim. Has no effect once the `error` slot is filled.
- `errorDescription: string = ''` (attribute `error-description`) — never localized, the same
  contract as `emptyDescription`. Has no effect once the `error` slot is filled.
- `announce: boolean = false` (reflected) — opts the table into announcing a failed-load state it
  already carries when it first mounts, through the same shared assertive region and the same
  heading text the later `error` transition announces, so the two paths cannot drift. Leave unset
  for a table that is part of the page a user is arriving on: the built-in error state renders in
  document order and repeating it is noise. Set it when the table is created in response to a user
  action — a reload that rejects mounts a fresh `error` table whose failure would otherwise never
  be spoken. Read once, on the first update: a later reconnection or adoption stages the same
  state again rather than replaying the announcement, and later `error` transitions announce
  either way. Deliberately not forwarded to the composed `[part='error']` `<lr-empty>`, whose own
  `announce` stays unset so the failure is spoken once, not twice. Remove any host
  `role="status"`/`role="alert"` hand-added before this property existed once it is set —
  otherwise the failure is announced a third time, through the native role as well.
- `emptyHeading?: string` (attribute `empty-heading`) — unset, localized `noData` (`'No data'`) when empty or `noMatches` (`'No matches'`) when filtering leaves none; supplied text including `''` is verbatim
- `emptyDescription: string = ''` (attribute `empty-description`)
- `emptyColumnsHeading?: string` (attribute `empty-columns-heading`) — heading of the built-in
  no-columns state; omission renders localized `noColumns` (`'No columns configured'` in the built-in English catalog); a supplied string,
  including `''`, renders verbatim.
- `emptyColumnsDescription: string = ''` (attribute `empty-columns-description`) — description of
  the built-in no-columns state.
- `emptySize?: LyraSize` (attribute `empty-size`) — size of the built-in `[part='empty']` state on
  the shared size ladder: `s` and the steps below it render it compact, `m` and above spacious.
  Leave it unset (the default) to keep each empty branch's own built-in default — the two
  shadow-root-level branches (no columns, no rows) render spacious, while the filtered-to-zero
  branch, which sits inside `[part='base']` alongside the filter field, renders compact. An
  unsupported value normalizes to unset. Has no effect once the `empty` slot is filled.
- `revealColumnsLabel?: string` (attribute `reveal-columns-label`) — the reveal button's label
  while `priority`-hidden columns are hidden; omission renders localized
  `showAllColumns` (`'Show all columns'` in the built-in English catalog), while a supplied string (including `''`) is verbatim
- `columnsHideLabel?: string` (attribute `columns-hide-label`) — the same button's label once
  the columns have been revealed; omission renders localized `showFewerColumns` (`'Show fewer columns'` in the built-in English catalog), while a supplied string (including `''`) is verbatim.

- `priorityColumnsVisible: boolean = false` (attribute `priority-columns-visible`, reflected) —
  forces responsive priority columns visible and is updated by the built-in reveal button.
  Priority-hidden columns hide their header, body, and footer cells together at the same measured
  overflow point in either direction; revealing columns restores all three bands.
- `storageKey?: string` (attribute `storage-key`) — when set, persists `priorityColumnsVisible` to
  `localStorage` (namespaced as `lr-table:${storageKey}`) and restores it on the next mount, without
  overwriting a `priorityColumnsVisible` the consumer declared on that same mount
  (`priority-columns-visible` present, or a `.priorityColumnsVisible=${…}` binding) — including a
  binding that pins it to `false`, its own default. Unset (the default) touches storage not at all.
  The same "explicit beats persisted" guarantee `lr-app-rail` gives each of its `persist`-selected
  fields and `lr-widget` gives `collapsed`; all three share one mechanism
- `priorityColumnsToggleAvailable: boolean` (readonly; computed, no attribute) — whether the
  reveal/hide control is currently offered at all, the public counterpart of the measurement
  `[part='reveal-columns-button']` itself renders from. True while at least one `priority` column is
  actually hidden at the current allocation, and it stays true once `priorityColumnsVisible` has
  revealed them (otherwise the control would remove itself the moment it was used). Always `false`
  with no `priority` column declared — the state the development-mode inert-configuration warning
  describes. Remeasured after every render and container resize, so read it after
  `await table.updateComplete`
- `heatTintScale?: { min?: number; max?: number }` (attribute: false) — overrides the auto-derived
  heat-tint domain (min/max of every `heatValue` result across every currently-rendered row —
  post-sort, pre-pagination, the same rows `footer(rows)` already sees). Unset (the default) computes
  the domain automatically from the data, spanning every `heatValue`-defining column together — a
  single shared scale across the whole grid, not one scale per column
- `rowTotal?: (row: T) => unknown` (attribute: false) — renders a trailing `<td>`
  (`[part='row-total-cell']`) on every body row holding this row's total. Same "consumer
  computes/renders, table only positions" contract as the existing per-column `footer(rows)` — does
  not assume addition, so a non-sum aggregate works identically. Omit for no trailing column at all
  (unchanged output). Its column header uses the localized `tableRowTotal` name.
- `grandTotal?: (rows: readonly T[]) => unknown` (attribute: false) — renders the bottom-right cell (row-total
  column × footer row). Only rendered when both `rowTotal` is set **and** at least one column defines
  `footer` — otherwise there is no footer row for it to occupy, and this renders nothing

**Methods:**

- `rowElement(rowKey)` — the rendered `<tr>` for one row key, or `null` when that row is not in the
  current render output (filtered out, paged away, never present)
- `cellElement(rowKey, columnKey)` — the rendered `<td>` at a row/column pair, on the same terms;
  `columnKey` is the column's own `key`
- `expandedContentElement(rowKey)` — the rendered `[part='expanded-cell']` holding that row's
  `expandedContent(row)` output, or `null` when the row is not currently rendered, is not expanded,
  or the table sets no `expandedContent`
- `editCell(rowKey, columnKey)` — opens the inline editor at that row/column pair, exactly as a
  double-click, `F2`, or `Enter` on the cell's own focus stop would (see `columns[].editTrigger`
  below) — the entry point for a consumer's own key binding or menu action. A no-op for an unknown
  row key, an unknown column key, or a column with no `editTrigger`. For an `editTrigger: 'always'`
  column (already open from first paint) it moves focus into that editor instead of opening
  anything.

The first three exist for code that has to reach content a `cell(row)`/`expandedContent(row)` callback
rendered into this component's shadow root — measuring it, scrolling it into view, or applying a
style `::part()` cannot express, since only pseudo-classes may follow a part selector. One method per
callback, and the split is not cosmetic: the expansion panel is a **sibling** `<tr part='expanded-row'>`
of the data row rather than a descendant of it, so `rowElement(rowKey)` cannot reach
`expandedContent` output at all — use `expandedContentElement(rowKey)` for that half. All three read
the DOM as it stands, so `await table.updateComplete` first and treat `null` as "not rendered right
now". The `data-row-key`, `data-col-key` and `data-expanded-row-key` attributes they resolve are
documented stable API: `data-col-key` is the column's own `key`, while `data-row-key` (on the data
row) and `data-expanded-row-key` (on the panel row) are a type-tagged encoding of the row key
(`string:a` vs `number:1`) that keeps a numeric key distinct from the string that stringifies the
same way. The panel deliberately does **not** repeat `data-row-key`, so a `[data-row-key]` query
still resolves exactly one element per row. Prefer these three methods over building a selector from
any of the attributes — a consumer-supplied key is not safe to interpolate into CSS unescaped.

**Events:** `lr-sort-request` (cancelable frozen readonly
`detail: { phase: 'request', sortKey, sortDir }`) precedes `lr-sort` (frozen readonly
`detail: { phase: 'commit', sortKey, sortDir }`) only when accepted. Client mode also updates its
sort properties; server mode leaves them controlled. Other events are `lr-row-activate`
(a row was activated by pointer or Enter/Space, `detail: { row }`), `lr-load-more`,
`lr-priority-columns-visibility-change` (frozen readonly `detail: { visible }`), and the expansion
pair `lr-row-expand-request` (**cancelable**, frozen readonly `detail: { row, rowKey, expanded }`,
emitted only while `expansionMode` is `'single'` or `'multiple'`; `preventDefault()` skips the
built-in `expandedRowKeys` write and suppresses the following toggle) and `lr-row-expand-toggle`
(frozen readonly `detail: { row, rowKey, expanded }`, where `expanded` is the state the activation
resolves to; under the default `expansionMode: 'none'` the table does not mutate `expandedRowKeys`,
while under a self-managed mode the write has already landed when it fires, and `'single'` fires it
once more — with `expanded: false`, immediately ahead of the accepted one — for the row it closed to
make room, unless that row is out of view), and
`lr-selection-change` (frozen readonly `detail: { selectedRowKeys }`, not cancelable) when selection is
enabled — fired both from a row activation and from a `selectionMode` flip to `'single'` that coerces
an existing multi-row selection down to one key (skipped on the very first render, since an
already-inconsistent initial `selectionMode`/`selectedRowKeys` pairing is a starting state, not a
live transition), `lr-filter-change`
(frozen readonly `detail: { filterText }`), and `lr-page-change` (frozen readonly `detail: { page }`) from the
filter/pagination surfaces, and `lr-cell-edit` (`detail: { row, columnKey, value }`) for editable
columns, and `lr-column-resize` (`detail: { columnKey, width }`, `width` in CSS pixels) on every pointer or
keyboard resize step. These notifications are non-cancelable. A final pointer width or keyboard step
first proposes `lr-column-resize-request` with the same detail. Preventing the request preserves the
previous accepted width; a pointer drag's live preview is discarded. A request listener that applies
its own width keeps that value. Existing code that prevented `lr-column-resize` must move its veto
handler to `lr-column-resize-request`.
The internal filter input's composed native `input`/`change` events are contained; only
`lr-filter-change` crosses the host boundary. Cell-editor `input`/`change` events are likewise
contained while an accepted edit publishes `lr-cell-edit`. Internal filter/cell-editor native
`focus` and `blur` are re-dispatched from the host as bubbling, composed events (the native ones
are neither). `lr-retry-request` — the built-in `[part='retry-button']` was activated, only rendered while
`error` is set. **Cancelable**: the default action clears `error`; calling `preventDefault()` leaves
it set, for a consumer that owns its own retry timing (e.g. it wants to keep the banner up until a
fresh load has actually started, or failed again immediately).

**Slots:** `empty` — replaces the built-in empty state on the two _data_-empty branches (no rows at
all, and filtered/paginated down to zero). Left unfilled, the built-in `[part='empty']` `<lr-empty>`
renders as this slot's fallback content. The no-columns branch is deliberately **not**
slot-replaceable: it reports a configuration problem (`emptyColumnsHeading`), not "this query returned
nothing", and one slot covering all three would collapse that distinction. Everything else comes
from `columns`/`rows`. `error` — replaces the built-in failed-load state, including its retry
button, while `error` is set. Left unfilled, the built-in `[part='error']` `<lr-empty>` renders as
this slot's fallback content.

**CSS parts:** `base`, `table`, `caption`, `head`, `header-cell`, `row`, `row-limit` (localized
notice when the assigned row collection exceeds admission capacity), `cell`, `more-button`, `sort-icon`
(each sort indicator), `sort-icon-active` (the active chevron, rotated per `sortDir`),
`sort-icon-inactive` (the muted bidirectional indicator under `sort-indicators="all"`), `reveal-columns-button`
(shown when priority columns are hidden or when a narrow allocation is currently force-visible),
`foot` (the `<tfoot>`, only rendered when at least one
column defines `footer`), `footer-row`, `footer-cell`, `row-total-cell` (each body row's trailing
`<td>` holding `rowTotal(row)`, rendered only when `rowTotal` is set — the corresponding footer-row
cell, holding `grandTotal`, is a `footer-cell` instead, matching every other footer cell),
`expand-toggle-cell`, `row-expand-toggle`,
`row-expand-icon`, `expanded-row`, `expanded-cell`, `filter-label`, `filter`, `filter-clear`
(clears the filter field, replacing the native search-cancel glyph the component resets; rendered
only while it has a value), `loading` (under
`loadingAppearance="spinner"` the visible block holding the spinner; under `"skeleton"` the
visually-hidden, `aria-hidden` announcement mirror, since the placeholder rows are the visible
affordance; the part has no live-region role in either appearance),
`skeleton` (each canonical `shape="rect"` `<lr-skeleton>` placeholder inside a skeleton-mode body cell — the placeholder rows
and cells reuse the ordinary `row`/`cell`/`row-total-cell` parts, which is exactly what keeps them
geometrically identical to real rows, so `skeleton` is the part to target for the placeholder's own
look: `::part(skeleton) { --lr-skeleton-h: 2em; }`), and
`pagination` (the pager host; re-exported as `pagination-summary`,
`pagination-controls`, `pagination-pages`, `pagination-page`, `pagination-page-current`,
`pagination-page-field`, `pagination-page-input`, `pagination-page-count`, `pagination-button`), `cell-editor`, `group-row`, `group-cell`, and `resize-handle` (the focusable column
separator, with a finite explicit ARIA maximum even when no CSS `maxWidth` was supplied). The built-in empty state is addressable rather than fixed: `empty` is the `<lr-empty>`
host in all three empty states, and it re-exports that element's own inner parts as `empty-base`,
`empty-icon`, `empty-heading`, `empty-description` and `empty-actions`. Note that the no-columns and
no-rows states return the empty element as the shadow root's own root, with no `[part='base']`
wrapper around it — `::part(base)` does not apply in those two states, only in the filtered-to-zero
one — and that `empty` disappears entirely once the `empty` slot is filled. `error` — the built-in
`<lr-empty>` host rendered in the row body while `error` is set. Unlike `[part='empty']`'s no-rows
branches, its surrounding `<thead>`, filter, and pagination stay mounted rather than being replaced
along with it. It re-exports that element's own inner parts as `error-base`, `error-icon`,
`error-heading`, `error-description`, and `error-actions` (which wraps `retry-button`, the built-in
retry control). `error-row` — the single full-width `<tr>` replacing the row content while `error`
is set; `error-cell` — the `<td>` inside it, spanning every column, that holds the failed-load
content. Both exist only in the in-grid branch: when `columns` is empty there is no grid to keep
mounted, so the failed-load content renders standalone and neither part is present (`error` and its
re-exported inner parts still are).

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

**Themeable custom properties:** `--lr-table-row-height` is an optional minimum for header, body
and footer rows. It wins over `--lr-theme-table-row-height`, whose value follows density; the
24px and active density target floors still apply. Both are unset by default, so content and padding
continue to determine row height. Cell content can always grow a row beyond the minimum.
`--lr-table-row-min-height` is the shared theme-supplied minimum used when
`--lr-table-row-height` is unset; an explicit table-level `--lr-table-row-height` takes precedence.
`--lr-table-cell-color` (default `inherit`),
`--lr-table-cell-link-color` (default `var(--lr-color-brand)`) and
`--lr-table-cell-link-hover-color` — an anchor returned from a column's `cell(row)` renders inside
the component's shadow root, where page CSS cannot reach it and `::part()` cannot select past the
first compound selector to reach it either, so without these it computes to the UA default link
blue; set `revert` for the UA default. `--lr-table-cell-padding` (default `var(--lr-space-s)`) sets
the padding of a header cell, a body cell, and the row-total cell; `--lr-table-cell-padding-compact`
(default `var(--lr-space-xs) var(--lr-space-s)`) is the same hook for the group-header cell and the
footer cell, which default to a tighter block/inline shorthand rather than sharing the first token
outright — two hooks instead of one preserve that distinction. `--lr-table-font-size` (default
`inherit`) sets the `<table>` element's font size; the rest of the font shorthand (family,
weight, etc.) keeps inheriting from the host regardless of this override. `--lr-table-surface` (default `var(--lr-color-surface)`) is the one surface the frame, resting/striped rows, sticky header and sticky columns, expanded rows and footer all paint, so recolouring a raised panel needs one declaration; `--lr-table-radius` (default `var(--lr-radius-container)`) is the frame radius, and the frame clips painted content to it (`overflow: clip` while `scroll-mode="auto"` content fits, so no scroll container appears and the sticky header still pins to the page; `page` mode clips the same way while content fits and falls back to `overflow: visible` only when the table is wider than its host, so it still overflows the page). `--lr-table-max-height` (default `none`; controls the scrollable
body's `max-block-size`). `--lr-table-heat-tint-lo` (default `var(--lr-color-brand-quiet)`) and
`--lr-table-heat-tint-hi` (default `var(--lr-color-brand)`) — the `color-mix()` ramp endpoints
for heat-tint mode's per-cell background, consulted only on columns/rows that define `heatValue`;
`--lr-table-resize-min-width` (default `var(--lr-size-3rem)`) and
`--lr-table-resize-handle-opacity` (default `0.12`) control resizable-column behavior.
`--lr-table-resize-handle-hover-bg` (default
`var(--lr-color-brand)`), `--lr-table-resize-handle-hover-opacity` (defaulting to that
opacity), `--lr-table-resize-handle-active-bg` (defaulting to the hover background), and
`--lr-table-resize-handle-active-opacity` (defaulting to twice the hover opacity) independently
retune the rendered interaction states. These heat-tint/resize hooks are not redeclared on the component host: set them on
`lr-table` or on a theme ancestor, and a table-level value wins through the normal cascade.
State-scoped hooks below use inline `var()` fallbacks, so values on `lr-table` or an ancestor remain
effective. Shadow Parts cannot select an attribute after `::part()`.
`--lr-table-row-selected-bg` (default `var(--lr-color-brand-quiet)`) paints a selected row and its
own `sticky` cell when `aria-selected="true"`.
`--lr-table-row-stripe-bg` (default `transparent`) — the background of alternating body rows,
including each row's own `sticky` column cell. The
component marks the alternating rows itself; this does not affect group, expanded, hover, or selected rows. A
row's hover and pressed fills reach its `sticky` column cell the same way, through an internal
custom property rather than a themeable token, since neither state has a public hook today.
`--lr-table-header-sorted-bg` (default `var(--lr-color-surface)`) and `--lr-table-header-sorted-color` (default
`inherit`) restyle the **currently-sorted** column's header cell (`[aria-sort]` other than `none`),
including a `sticky` column's own header cell. The opaque surface default prevents body rows from
showing through the sticky header while it scrolls.
The `sort-icon` part styles only the indicator; these tokens style the header cell. Use `::part(sort-icon-inactive)` and
`::part(sort-icon-active)` to style the two indicator states without private selectors.
`--lr-table-sticky-offset` (default `0`) is measured and written inline per column by the component
so multiple `sticky` columns stack instead of overlapping; it is a read-out, not a knob you set.
`--lr-table-heat-t` is likewise component-written (each `[data-heat]` cell's position on the ramp).
`[part="base"]`, the table's own scroll container, also honors the opt-in theme-level
`--lr-theme-scrollbar-width`/`--lr-theme-scrollbar-gutter` hooks (defaults `auto`/`auto`) — set either on `:root` or any ancestor for one
declaration to retheme every internal scroll container in the library, including
`lr-virtual-list`, `lr-scroller`, `lr-carousel`, `lr-code-block`, and `lr-code-editor`.

**Optional peer deps:** none.

```html
<lr-table
  id="t"
  sort-key="name"
  sort-dir="asc"
  aria-label="Items"
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
  t.addEventListener("lr-row-activate", (e) =>
    console.log("activated", e.detail.row)
  );
</script>
```

**Known gotchas:**

- Sorting toggles `asc`/`desc`; consumers own any third, unsorted state. Veto `lr-sort-request`
  to prevent state change and commit.
- `sortValue`/`cell` use column identity. In-place mutation (`t.columns[0].sortValue = …`)
  neither renders nor re-sorts; assign a new `columns` array.
- Single/multiple selection both use `selectedRowKeys`. No checkbox column is synthesized;
  implement bulk selection through `headerCell()`/`cell()`.
- Host `aria-label` (or native `ariaLabel`) names the internal `<table role="grid">` verbatim,
  bypassing localization; its presence wins even when empty. `caption: string = ''` supplies an
  optional visible `<caption>` (`caption` part); without a host label it also names the grid through
  `aria-labelledby`.
  Without either name, first render issues one development-only `console.warn`; production and
  unknown/unbundled runtimes stay silent.
- `revealColumnsLabel`/`columnsHideLabel` only label `[part='reveal-columns-button']`, which
  requires a `priority` column. Setting either without one is inert and issues the same one-time,
  development-only warning; production and unknown/unbundled runtimes stay silent.
- Headers and body rows each have one roving `tabindex="0"`. Left/Right/Home/End navigate headers;
  Up/Down/Home/End navigate rows. Down enters the body from a header; Up from the first row
  returns to the header. Enter/Space sort or activate. Priority-hidden columns are skipped.
- `cell()` controls retain their actions. Delegated clicks/Enter/Space inspect the composed path
  for buttons, links, inputs, selects, textareas, summaries, media with controls, editable content,
  non-negative `tabindex`, or roles `button`, `checkbox`, `combobox`, `listbox`, `menu`, `menuitem`,
  `option`, `radio`, `separator`, `slider`, `spinbutton`, `switch`, `tab`, `textbox`.
  Open-shadow controls expose these semantics. Passive custom elements (formatters/badges) remain
  row activation surfaces; a hyphenated tag alone is not an exemption. Closed-shadow controls can
  opt out with `data-table-interactive` on their visible host.
- Fixed layout (explicit or resolved from `'auto'`) uses the first row, including headers, to
  determine widths when none are declared. Revealing priority columns through
  `[part='reveal-columns-button']` can therefore resize every column. Fixed layout ignores
  `columns[].minWidth`/`maxWidth`; declare `width` for a specific size.
- Skeletons cannot stabilize content-sized columns: default `table-layout: auto` placeholders
  lack intrinsic width, so arriving data re-measures columns as any data change can. Declare
  `columns[].width` or `layout="fixed"` for identical loading/loaded widths. Initial declarative
  loading is silent; each later transition into either loading appearance, including repeated
  cycles, appends localized loading text to the shared light-DOM polite sink. `base` exposes
  `aria-busy`; `loading` is an `aria-hidden` mirror, not a live region. Placeholders disable their
  own `<lr-skeleton>` announcements to avoid one announcement per row.
- `cellTitle` returning `''`/`undefined` omits `title`, preserving ancestor tooltips; inline editing
  also suppresses it. Some screen readers replace the cell's accessible name with `<td title>`
  rather than supplementing its content (also a caveat of `lr-stat`'s `exactValue`). Use it only
  to expand visible information, never as the sole source of information.
- To replace a persistent editor with an externally authoritative value, re-key its row (`rowKey`)
  or use transient `editTrigger: 'double-click'`. Otherwise text/number editors retain dirty
  drafts, while persistent selects re-apply refreshed selections (see `editTrigger`).

---

## `lr-pagination`

Controlled page navigation for server-side or client-side data sets: a numbered page list with
elided runs, previous/next and optional first/last buttons, an opt-in localized item-range summary,
a compact layout that swaps the list for a validated numeric page jump, and a polite announcement
after the host applies a requested page. The component owns no data fetching and never mutates
`page`.

**Indeterminate mode (`total="-1"`):** for a server API that never returns a total — limit/offset and
cursor/keyset APIs typically don't — set `total="-1"` and use `hasNext` to report whether one more
page exists. The component then renders previous/next plus a page-number field only: no numbered
page list, no item-range summary, and no `/ totalPages` readout, regardless of `format`,
`withSummary`, or `withEdges`. Previous is disabled at page 1 exactly as in the known-total path;
next is disabled once `hasNext` is `false`. Events, focus management, and the applied-page
announcement all use the same contract as known-total pagination — `lr-before-page-change`/
`lr-page-change`/`lr-activate` fire the same way, and focus still follows the applied page — except
the announcement text has no total-pages figure (`"Page {page}"` instead of `"Page {page} of
{totalPages}"`). Any negative `total` other than exactly `-1` still renders the ordinary empty
state.

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
  to a non-negative integer for display and page-count calculations, except for the exact sentinel
  `-1`, which enters indeterminate mode (see below) instead of clamping to the ordinary empty state.
  Any other negative value — including one arrived at by a miscalculation — still clamps to `0` and
  renders the empty state, unchanged
- `totalPages: number` (readonly getter) — `ceil(total / pageSize)` after the normalization above,
  or `0` when either normalized input is zero (always `0` in indeterminate mode too, since there is
  no total to derive a page count from)
- `hasNext: boolean = true` (attribute `has-next`, reflected) — whether at least one more page
  exists past the current one. Consulted only in indeterminate mode; previous availability is always
  derivable from `page` alone
- `disabled: boolean = false` (reflected)
- `loading: boolean = false` (reflected) — disables all controls and sets `aria-busy="true"` on the
  internal navigation landmark
- `withSummary: boolean = false` (attribute `with-summary`, reflected) — renders the built-in range
  summary while retaining the controls. Opt-in since 8.0.0, when the old `hide-summary` attribute
  (shown-by-default) was renamed to `with-summary` (hidden-by-default) — the **8.0.0 migration**
  bullet above has the full inverted-default detail
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
  selects the CLDR plural form of the localized `items` message for the active locale
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
`lr-activate` (`detail: { value: number }`, bubbles and composes, non-cancelable) fires on **every**
accepted page request, whether or not the page actually moved; `value` is the requested page number.
`lr-before-page-change` remains the veto point, and a vetoed request emits no activation at all, so
`lr-activate` only ever reports a request the component accepted. Use it for the re-request of the
current page that `lr-page-change` deliberately stays silent for — "load that page again" is a real
intent, and it is otherwise unobservable, because the page buttons and the jump input live in this
shadow root, so a retargeted `click` names no page and pressing Enter on the jump field produces no
click at all. When a request _does_ move the page, `lr-before-page-change` and `lr-page-change` are
emitted first. Link-mode anchors navigate without emitting it.
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
while `with-edges` is set — and never in indeterminate mode, along with `pages`, `summary`, and
`page-count`, none of which have a total to render against (see indeterminate mode above).

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
`--lr-pagination-pages-gap` (default `var(--lr-space-xs)`) between numbered pages, and
`--lr-pagination-page-field-gap` (default `var(--lr-space-2xs)`) between the compact
`[part="page-input"]` and its `[part="page-count"]`; each remains
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
defaults to the exact shared brand/quiet-brand/active-mix treatment used previously. Unset, the
applied page's hover and press start from its own `--lr-pagination-current-bg` and
`--lr-pagination-current-border-color`, so a themed current chip keeps its paint under the pointer. These state
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
  number; a gap that would hide exactly one page shows that page instead. A gap is a named jump control, not decorative text; repeated activation advances through
  a large skipped run. Both counts are clamped to `25` and the render-every-page budget is capped at 101 slots, so
  however large you set them the list never renders more than 103 slots
- `appearance` does not reach the compact page-jump input — `[part="page-input"]` always draws with
  the shared surface and border tokens. Style `::part(page-input)` directly when a non-default
  appearance needs it to match

---

## `lr-gauge`

Dependency-free SVG radial, full-circle ring, or linear meter (no charting library).

Removing `label` omits the visible SVG label in radial, linear, and ring shapes and restores the
localized gauge name unless `aria-label` is authored. The property retains removal `null`;
explicitly empty labels remain empty and later labels render normally.

**Properties:**

- `value: number = 0`
- `min: number = 0`
- `max: number = 100`
- `shape: GaugeShape = 'radial'`, where `GaugeShape = 'radial'|'ring'|'linear'` (reflected —
  `radial` is a 270° sweep; `ring` is a
  full circle that begins at 12 o'clock)
- `size?: LyraSize` (reflected, unset by default) — density tier on the library's one size ladder:
  `'2xs'|'xs'|'s'|'m'|'l'|'xl'`, or the Web Awesome / Shoelace spellings `'small'|'medium'|'large'`,
  which are accepted as authored rather than rewritten to the short form. A tier pins the host font
  size, and because the whole gauge box is expressed in `em` the frame, the stroke geometry and both
  SVG captions scale together — `8em` square for `radial`/`ring`, `12em` by `1.5em` for `linear`,
  each multiplied by that tier's font size. Leaving it unset keeps the inherited ambient text size
  and the exact geometry the gauge rendered before the ladder reached it, so existing markup is
  untouched. An unsupported value normalizes to the omitted state and removes the attribute.
- `label: string = ''`
- `valueText?: string` (attribute `value-text` — overrides both the visible text and the host's
  `aria-valuetext`; an empty string is treated the same as unset and falls back to the numeric
  `value` while removing `aria-valuetext`)
- `withoutValue: boolean = false` (attribute `without-value`, not reflected) — omits the decorative
  `part="value"` caption, the same way an empty `label` already omits `part="label"`.
  `aria-valuenow`/`aria-valuetext` and the host's accessible name are unaffected either way, since
  the caption itself is always `aria-hidden`. The caption shows by default because a gauge's whole
  purpose is showing the reading it announces.
- `variant: LyraProgressVariant = 'brand'` (reflected) — the same shared semantic-tone vocabulary
  `<lr-progress-bar>` uses (`'neutral'|'brand'|'success'|'warning'|'danger'`). The fallback color
  whenever `thresholds` is empty or matches nothing.
- `thresholds: readonly LyraGaugeThreshold[] = []` (attribute: false) — `LyraGaugeThreshold {
  readonly at: number; readonly variant: LyraProgressVariant }`. Value-to-variant color mapping:
  the LAST entry, after sorting by `at` regardless of authored order, whose `at` is `<=` the
  current `value` wins; an entry whose `at` is not a finite number never matches. The same rule
  serves a higher-is-worse domain like CPU load (`[{at: 0, variant: 'success'}, {at: 70, variant:
  'warning'}, {at: 90, variant: 'danger'}]`) and a higher-is-better one like battery charge
  (`[{at: 0, variant: 'danger'}, {at: 20, variant: 'warning'}, {at: 50, variant: 'success'}]`) —
  only the authored pairs differ.

**Events:** none.

**Slots:** none.

**CSS parts:** `base` (the `<svg>`), `track`, `fill`, `value` (omitted while `without-value` is
set), `label` (rendered only while `label` is non-empty)

**Themeable custom properties:** `--lr-gauge-fill` (fill stroke; overrides `variant`/`thresholds`
entirely and falls back to the effective variant's shared semantic token —
`--lr-color-brand` by default). Each variant also has its own scoped fill, read as the innermost
fallback before the shared token so a consumer can retint one variant without `--lr-gauge-fill`'s
uniform override touching the others: `--lr-gauge-neutral-fill` (default `var(--lr-color-neutral)`),
`--lr-gauge-brand-fill` (default `var(--lr-color-brand)`), `--lr-gauge-success-fill` (default
`var(--lr-color-success)`), `--lr-gauge-warning-fill` (default `var(--lr-color-warning)`), and
`--lr-gauge-danger-fill` (default `var(--lr-color-danger)`). `--lr-gauge-track-color` (default
`var(--lr-color-border)`) strokes the unfilled track.

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
<!-- compact dashboard meter: a slim, captionless, thresholded row -->
<lr-gauge
  shape="linear"
  size="xs"
  without-value
  aria-label="Spend"
  value="84"
  max="100"
></lr-gauge>
<!-- automatic threshold coloring: same rule, opposite direction -->
<lr-gauge id="cpu" value="82" label="CPU"></lr-gauge>
<script>
  cpu.thresholds = [
    { at: 0, variant: 'success' },
    { at: 70, variant: 'warning' },
    { at: 90, variant: 'danger' },
  ];
</script>
<lr-gauge id="battery" value="15" label="Battery"></lr-gauge>
<script>
  battery.thresholds = [
    { at: 0, variant: 'danger' },
    { at: 20, variant: 'warning' },
    { at: 50, variant: 'success' },
  ];
</script>
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
- `thresholds` recolors the fill from `value` alone — no reactive application-state wiring needed
  for the common success/warning/danger case. It never rewrites the `variant` property or its
  reflected attribute; the resolved color is tracked separately so a component reading back
  `variant` always sees the value it set. `--lr-gauge-fill` still overrides both `variant` and
  `thresholds` unconditionally, for a color outside the shared semantic-tone vocabulary.
- no documented component-specific sizing custom property. The host box is fixed em values
  (`8em` radial/ring, `12em`/`1.5em` linear) against the host font size, so `size` is the supported
  way to step it; for a dimension off the ladder, set plain CSS `width`/`height` (or `font-size`)
  on the element instead. The value/label captions are `em`-sized against that same host font-size,
  so they shrink right along with the frame at a smaller tier or a smaller host `font-size` —
  combine a small tier (or a small host `font-size`) with `without-value` for a slim,
  thresholded dashboard meter, matching `<lr-progress-bar size="xs">`'s footprint but with
  `role="meter"` and one `thresholds` array instead of a hand-written ratio-to-variant mapping.
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

Supply `stages` and `comparison` as aggregate counts or measures computed across their complete
cohorts. A few stages can summarize one million underlying observations when each value includes
every applicable cohort member. The host or server performs the raw-event aggregation; the
component receives stage totals, and each comparison cohort normalizes to its own first stage.
The 500-stage rendering ceiling bounds stage cardinality independently of the observation count.

When a positive finite stage value divided by a positive finite baseline overflows to `Infinity`,
the main or comparison data fill clamps to 100%. Nonfinite input normalization, nonpositive-baseline
behavior, percentage and drop-off text, and overflow border styling keep their existing rules.

It is deliberately not a sorted bar chart: it normalizes to the first stage rather than to the data
maximum, draws no value axis, and reads as stage-to-stage retention rather than category comparison.
Reach for `lr-bar-chart`/`lr-lite-chart` when you actually want a value axis and category comparison.

The whole chart is plain HTML — stage names, absolute values, shares and drop-off percentages are
real text inside an `<ol>`, so there is no sighted-only drawing needing a separate transcript. The
list carries the accessible name; a host `aria-label` overrides `label`.
Stage and comparison projections reuse their input identities. Reassign after changes, or call
`requestUpdate()` after mutating the current arrays. The component resolves at most the first 501
valid stages to detect overflow and renders at most 500.
Validation inspects at most 10,000 source positions per chunk and continues through malformed
entries until it reaches that valid-stage boundary or the end. The last completed chart stays
visible with `aria-busy` while a replacement is inspected. Keep pending source arrays and records
unchanged, or reassign/explicitly refresh to restart inspection. Replacement and disconnect cancel
unfinished work; reconnect derives the current input again.

**Properties:**

- `stages: readonly LyraFunnelStage[] = []` (property only; every share is measured against
  `stages[0]`)
- `comparison: readonly LyraFunnelStage[] = []` (property only — an optional baseline/peer cohort
  drawn behind each bar as a dashed outline, normalized to **its own** first stage so a cohort's
  funnel *shape* stays comparable against a baseline whose absolute volumes are not)
- `comparisonLabel: string = ''` (attribute `comparison-label`; falls back to a localized generic
  label)
- `label: string = ''` (accessible name for the stage list)
- `withoutDropoff: boolean = false` (attribute `without-dropoff`, reflected) — omits the change
  from the previous stage otherwise rendered above each later stage.
- `sharePrecision: number = 0` (attribute `share-precision`; fraction digits for every share and
  drop-off percentage, clamped to `0`–`20`)

```ts
interface LyraFunnelStage {
  readonly label: string;
  readonly value: number;
  readonly color?: string; // CSS color; unparseable values fall back to --lr-funnel-bar-color
}
```

At most 500 valid stages render, each as its own bar row; a `stages` array past that length renders
a localized `limit` notice after the list rather than mounting an unbounded number of bars. Every
stage's share is still measured against the true first stage regardless of truncation.

**Events:** none.

**Slots:** none.

**CSS parts:** `base`, `stages` (the `<ol>`), `stage`, `dropoff`, `stage-header`, `stage-label`,
`stage-value`, `stage-share`, `comparison-value`, `track`, `bar`, `bar-overflow` (a second token on
`bar` when the stage exceeds the first stage), `comparison-bar`, `empty`, `limit` (localized notice
shown when `stages` exceeds the 500-stage render ceiling)

**Themeable custom properties:** `--lr-funnel-bar-color` (default `var(--lr-color-brand)`),
`--lr-funnel-comparison-color` (default `var(--lr-color-border-strong)`), `--lr-funnel-track-color`
(default `var(--lr-color-surface-raised)`), `--lr-funnel-bar-size` (track thickness, default
`var(--lr-size-1-5rem)`).

**Optional peer deps:** none.

```html
<script type="module">
  import '@aceshooting/lyra-ui/components/lr-funnel.js';
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
the center until it clears every word already placed. Unlike sibling `lr-sparkline` (one `role="img"`
glyph standing in for an aggregate value), the individual words here _are_ the meaningful
interactive content — but with up to `MAX_WORDS` (150) of them, making every single one
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
no live-region role of its own. Pointer input resolves the word under the pointer (else the one
with the nearest edge) from the adequately-sized SVG surface; the potentially tiny text glyphs are
not independent hit targets.

Pinned opposite-sign finite endpoints such as `[-1e308, 1e308]` produce bounded finite scale
fractions and SVG geometry, including with reversed endpoints or square-root scaling. Word weights
remain nonnegative; placement budgets, font-size limits, and the omitted-word policy are unchanged.

**Properties:**

- `preparedWords: LyraPreparedWordCloud | null = null` (property only) — whole-catalog weighted
  summary, taking precedence over `words`. Invalid non-null input shows a localized `error`;
  setting it to `null` restores the current legacy word snapshot without changing the `words`
  getter. See the prepared-catalog contract below.
- `words: readonly WordCloudWord[] = []` (attribute: false) — readonly `{ text: string, weight:
number, color?: string, group?: string }` snapshots; malformed/hostile records are skipped while
  later valid records survive. `weight` is normalized once to a finite nonnegative value used by
  font sizing, announcements, and `lr-word-activate` detail. A valid CSS `color` overrides the
  palette for that word (invalid values,
  declaration-breaking input, and `url()` fall back to the palette), and `group` shares one palette
  color across every word with the same `group` value. The component scans at most 10,000 input
  records, bounds each string to 256 characters and all retained word strings to 16,384 characters,
  marking shortened strings with an ellipsis and disclosing omitted input through `[part="limit"]`.
  The returned sequence and records are frozen; assign a new array after changes (re-assigning the
  same array is ignored).
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
  frozen; assign a new array after changes
- `legend: readonly WordCloudLegendItem[] = []` (attribute: false) — clone-owned, frozen named
  readonly `{ label, color }` entries for explaining explicit `words[].color`/group color
  overrides; when omitted, the component derives entries from grouped and explicitly colored
  words. Explicit legends retain at most 100 entries and 8,192 aggregate characters; malformed
  records are skipped, overlong strings end in an ellipsis, invalid colors render transparent, and
  `[part="legend-limit"]` truthfully exposes the localized rendered/received count. The returned
  sequence and records are frozen; assign a new array after changes.
- `withLegend: boolean = false` (attribute `with-legend`, reflected) — renders the supplied or
  derived legend below the cloud; the color key is an accessible list and does not change word
  activation or palette selection.

**Prepared weighted catalogs:** `LyraPreparedWordCloud` supplies `revision`, `counts`
(`sourceCount`, `validCount`, `invalidCount`), `totalWeight`, `retainedWeight`, and readonly
`words: readonly LyraWeightedWord[]`. Each `LyraWeightedWord` has readonly `id: string`,
`text: string` and `weight: number`. IDs represent already aggregated catalog entries and must be
globally unique; distinct IDs may have the same display text. This input is a weighted catalog,
not a sequence of raw tokens whose frequencies the component computes.

The component admits at most 150 selected words, with nonblank IDs/text limited to 256 UTF-16
units each and selected text totaling at most 16,384 units. Labels and IDs remain exact; they are
not clipped or admitted through the legacy prefix budget. Retained IDs must be unique. Counts
must be safe nonnegative integers conserving the complete source (`validCount + invalidCount =
sourceCount`); selected length cannot exceed `validCount`, and a nonempty valid catalog requires
a selection. Weights and their totals must be finite and nonnegative; `retainedWeight` must equal
the sum of selected weights in descriptor order. The full total must include each selected
weight; when every valid word is selected, full and retained totals must agree within bounded
floating-point accumulation error. Invalid positions do not enlarge that complete-sum allowance.
Sparse/accessor-backed descriptor arrays, malformed metadata, oversized selections and
inconsistent totals fail visibly instead of falling back to `words` or silently dropping values.
The bounded descriptor cannot independently certify global top-K membership or full-source totals.

`part="summary"` reports selected versus full valid word counts, invalid count, and retained versus
full weight through `wordCloudPreparedSummary`. It remains visible for empty/all-invalid input.
If placement cannot fit a selected word, the separate existing `limit` reports rendered versus
selected words; it does not relabel top-K omission or rejected source labels as a layout failure.
Invalid input uses `part="error"` and `wordCloudPreparedUnavailable`. Numeric values use the
effective locale; `.strings` overrides apply to visible messages and announcements. Mount,
reconnect and adoption are quiet; later changed summaries announce politely and invalid-input
transitions announce assertively through the shared light-DOM sink.

The component captures a bounded immutable snapshot of host-authored metadata. After changing a
mutable descriptor or its revision, assign `preparedWords` again (the same identity is accepted)
or call unnamed `requestUpdate()`; a coalesced named update does not suppress that refresh.
Presentation updates reuse the snapshot. Source storage and preparation remain host-owned; the
component neither reads an original catalog nor starts or cancels its preparation. Replacing or
clearing `preparedWords` therefore does not abort a helper call already running in application
code. Theme, pointer and keyboard interactions use the retained words without a full-source pass.

`prepareLyraWordCloud(input, options?)` from the granular utilities module performs one complete
chunked catalog scan and retains the global heaviest `maxWords` (default/max 150, minimum 1), with
equal weights favoring earlier original positions. `input` is a `LyraIndexedInput<LyraWeightedWord>`
with stable `revision`, safe `count`, and `read(start, count, { signal })` returning exactly that
range. Preparation reads at most 8,192 positions per chunk (default 2,048), yields between chunks
and checks revision/cancellation. All valid source weight contributes to `totalWeight`, including
omitted candidates. Blank/over-256-unit text or IDs and negative/nonfinite weights count as invalid
observations; the helper does not shorten them. Chosen labels exceeding 16,384 units reject the
call: lower `maxWords` rather than clipping selected words. Heavy late entries compete before any
text budget is applied. With bounded memory the helper detects duplicates only among retained
candidates; global ID uniqueness remains the caller's input contract. Exact frequency aggregation
of arbitrary raw tokens belongs to the caller's keyed catalog. The result is immutable.

**Methods:** `refreshTheme(): void` — forces a relayout so the `--lr-font` custom property is
re-read from computed style (font-family affects the canvas text measurement layout depends on).
The component's theme watcher calls it automatically when inherited theme typography changes; the
method remains available for a host theme system that needs an explicit synchronous refresh.

**Events:** `lr-word-activate` fires from the single SVG pointer surface or Enter/Space on the
current word. Its frozen readonly detail is typed `{ text: string; weight: number; group?: string;
id?: string; revision?: LyraSourceRevision }`. With `preparedWords` active, `id` and `revision`
identify the exact original catalog entry and committed summary; duplicate text never substitutes
for identity. Actions on the old visible layout retain its revision while a replacement is
scheduled, and replaced/detached layout objects cannot activate new data. With `preparedWords =
null`, the existing `{ text, weight, group }` payload is unchanged and has no `id`/`revision` fields.
`LyraPreparedWordCloud` and `LyraWeightedWord` are type-only exports from the component entry and
from `@aceshooting/lyra-ui/utilities/data-preparation.js`.

**Slots:** none.

**CSS parts:** `base`, `svg`, `word` (each `<text>`), `focus-ring` (the rect around the roving-focus
cursor's word), `live-region` (visually-hidden, `aria-hidden` mirror of the latest announcement;
the actual announcement uses the shared light-DOM polite sink),
`legend`/`legend-item`/`legend-swatch`/`legend-label` (the optional static color key), and `empty`
(the no-data placeholder), `limit` (localized rendered/received word count; rendered/selected in
prepared mode), `legend-limit` (localized rendered/received explicit-legend count),
`summary` (prepared full/retained counts and weights), and `error` (invalid prepared-input message)

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

A complete unique weighted catalog can be prepared without constructing a million-element array.
The helper's one-time full pass is application work; rendering and interaction consume its bounded
result. Import the helper directly and cancel obsolete preparation before assigning a result:

```ts
import '@aceshooting/lyra-ui/components/lr-word-cloud.js';
import {
  prepareLyraWordCloud,
  type LyraIndexedInput,
  type LyraWeightedWord,
} from '@aceshooting/lyra-ui/utilities/data-preparation.js';

const cloud = document.querySelector('lr-word-cloud')!;
let pending: AbortController | undefined;

async function showCatalog(input: LyraIndexedInput<LyraWeightedWord>): Promise<void> {
  pending?.abort();
  const request = new AbortController();
  pending = request;
  try {
    const prepared = await prepareLyraWordCloud(input, {
      signal: request.signal, maxWords: 150, batchSize: 8192,
    });
    if (pending === request && !request.signal.aborted) cloud.preparedWords = prepared;
  } catch (error) {
    if (!request.signal.aborted) throw error;
  }
}

await showCatalog({
  revision: 'catalog-1',
  count: 1_000_000,
  read(start, count) {
    return Array.from({ length: count }, (_, offset) => {
      const index = start + offset;
      return {
        id: `topic-${index}`,
        text: `Topic ${index}`,
        weight: index === 999_999 ? 1_000_000 : 1,
      };
    });
  },
});
// On view disposal, call pending?.abort().
```

The final heavy entry participates in selection, and equal-weight entries retain original-position
ties. A changed catalog/revision needs a new preparation pass; ordinary view interactions do not.

The focusable SVG is the single semantic owner: `role="application"` plus an accessible name. An
authored host `aria-label` is forwarded to that SVG and wins by attribute presence; when it is
absent, the SVG uses an auto-computed localized name such as `"Word cloud of 12 words"` / `"Word
cloud of 1 word"`, counting only words actually rendered. An authored host `role` remains on the
host and does not replace the SVG's application role. When records are omitted, the SVG references
the visible localized `[part="limit"]` rendered/received summary. In prepared mode it also
references the full-catalog `summary`; host-authored description references remain composed with
these internal descriptions.

**Known gotchas:**

- capped at 150 words (`MAX_WORDS` in `word-cloud-layout.ts`, mirroring `lr-sparkline`'s
  `MAX_POINTS` input-sample guard) — a one-pass bounded top-K scan retains the **heaviest** 150 and
  counts the rest without cloning/sorting/spreading the full admitted legacy input. The legacy
  `words` boundary still inspects at most 10,000 positions and applies its text budgets; use
  `preparedWords` for a complete-catalog summary. A pathological input can exhaust the spiral
  search's radius bound and be omitted from either route. Legacy blank text is dropped during
  boundary normalization; malformed prepared input instead shows `error`. Omitted placement
  diagnostics retain at most 32 records, while a separate complete count drives one deduplicated
  `console.warn` and the rendered disclosure.
- each word's spiral search tests at most 4,096 candidate positions. Together with the 150-word and
  512px font-size caps, this bounds placement work even for dense or adversarial layouts; a word
  that exhausts the search budget is reported through the same skipped-word path.
- text width is measured via a detached `<canvas>` 2D context (`ctx.measureText`) using the live
  `--lr-font-weight-semibold` and `--lr-font` token values. A consumer-only `::part(word)` font
  override can still desynchronize measurement from the painted glyph.
- rotation (`word-rotation="mixed"`) is genuinely random per layout (`Math.random()`, not seeded), so
  which words render rotated changes on every re-layout (a prepared-input refresh or an effective
  `words`/`minFontSize`/`maxFontSize`/`scale`/`wordRotation` change) — don't rely on rotation being stable across renders.
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
with arrow-key roving focus (Home/End jump to the first/last interactive cell of the focused row,
Ctrl/Meta+Home/End to the first/last of the grid; a stroked ring is redrawn over the focused cell on
every draw, and the cell text is appended to the document's shared light-DOM polite sink); and a click, or Enter/Space
on the focused cell, fires `lr-cell-activate`. The first render is silent, repeated identical focus
movements remain separate announcements, and `[part="live-region"]` is only an `aria-hidden` mirror.
Both modes deliberately retain physical LTR grid geometry under `dir="rtl"`: matrix column 0 and
calendar week 0 remain at the physical left, so ArrowLeft and ArrowRight retain their physical
previous/next movement instead of swapping for RTL.
Full canvas redraws pause while the host is outside the viewport. A deferred `fitToWidth` frame
stays within a smaller allocation when the current grid fits it; explicit cell floors, accessible
hit targets and custom column extents still retain intentional overflow. The next visible draw
restores the bitmap and cell geometry together. Data, locale, theme, resize, and
DPR invalidations remain pending and coalesce into one redraw when the heatmap intersects again;
environments without `IntersectionObserver` retain eager drawing. A theme signal (any ancestor
`style`/`class` write) repaints only when a theme token the canvas reads changed, or while `cellColor`
is set. A grid whose backing store would exceed the engine's canvas limits (16,384 px per side,
16,777,216 pixels) is painted at a lower resolution instead of blank, and `exportData('png')`
follows it.

Focus-only updates repaint a bounded neighborhood around the old and new cells, restoring all
intersected neighboring fills and overlays while preserving the focus-ring geometry. Calendar axis
pixels intersected by the repaint are restored too.

Changing `domain` or `midpoint` without replacing matrix data preserves absent and nullish cells as
no data in paint, accessible text, callbacks, and cell events. Missing values still use `-1` in
default unsigned mode and `NaN` in signed mode; supplied negative signed values remain data.

Invalid authored ramp colors retain the default endpoint fallback. The public `resolveRgb()` helper
likewise preserves its supplied fallback bytes. These authoring diagnostics are once-per-color
development warnings and remain silent in production; the separate missing-canvas runtime warning is
unchanged.

Set `accessibleCells: true` (`accessible-cells`) to opt into a semantic grid backed by a bounded
window of native buttons. It retains the complete `aria-rowcount`/`aria-colcount` and arrow-key
navigation model without mounting one node per cell. Buttons use localized `aria-label`s, explicit
`aria-selected="true"|"false"` from the controlled `selectedCell`, and roving tabindex; the grid
continues to emit `lr-cell-activate` and leaves selection state consumer-controlled.
When matrix/calendar data refreshes while one of those buttons owns focus, the semantic matrix
coordinate or calendar date remains the sole roving stop. If it disappears, focus clamps to the
nearest surviving interactive cell, or to the stable heatmap base when none remain; an unfocused
refresh never steals external focus.

Changing `accessibleCells` also preserves owned focus across the rendering-mode replacement:
turning the overlay off moves a focused cell button to the canvas application control; turning it on
moves a focused canvas to the matching remembered cell, the first interactive cell, or the stable
base when no cell exists. A newer external focus destination is never reclaimed.

Calendar mode can summarize a complete large event population through host-side daily aggregation.
Combine repeated events into one `{ date, value }` record per day before assigning
`data = { kind: 'calendar', days }`: duplicate day records use first-valid identity rather than
summation. A 365-day contribution view can therefore cover one million events while retaining
365 daily totals. Keep the full event count and aggregation provenance beside the visualization;
the heatmap's day count describes day records. A million distinct dates exceed the limits on day
count and date span below. Query another bounded date window when needed.

**Complete matrix source:** `matrixSource: LyraHeatmapMatrixSource | null = null`
(attribute: false) opts into provider-owned indexed storage and aggregation. It takes precedence
over legacy matrix arrays and requires `data.kind === 'matrix'`; a source with calendar data shows
a localized error. Set `matrixSource = null` to restore the current legacy input. The provider is
retained by identity. Reassign even the same object, or call a keyless `requestUpdate()`, after
revision/state changes. Named presentation changes reuse accepted tiles; locale/lifecycle changes
revoke obsolete effects. Providers should honor abort signals; ignored aborts occupy their physical
request permits until settlement.

```ts
import type {
  LyraHeatmapMatrixSource, LyraHeatmapMatrixViewport, LyraHeatmapMatrixReducer,
  LyraHeatmapTile, LyraHeatmapMatrixRangeSelectDetail,
} from "@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js";
import type { LyraSourceRequest, LyraSourceValue, LyraNumericDomain } from
  "@aceshooting/lyra-ui/utilities/data-preparation.js";
```

The source supplies immutable `revision` (a nonempty string or finite number), safe nonnegative integer `rowCount`/`columnCount`
(with a safe integer product), and `domain: LyraNumericDomain | null`. This domain describes all
finite source values; `null` means none. A valid explicit `domain` property still overrides the
paint scale while the summary reports the provider's complete domain. Signed finite values are
valid; only `null` represents a missing exact value. Methods may return a value or PromiseLike:

- `query(request)` receives `{ signal, rowStart, rowEnd, columnStart, columnEnd, maxCells }` and
  returns readonly `LyraHeatmapTile[]`. The host must supply an aggregation index, pyramid or server;
  the component does not scan raw source cells to create tiles.
- `getCell(row, column, { signal })` returns `{ value: number | null, rowLabel: string,
  columnLabel: string }` for that exact absolute coordinate. Labels are each at most 1,024 UTF-16
  units; malformed or oversized replies fail visibly without truncation.

`matrixViewport: LyraHeatmapMatrixViewport | null = null` (attribute: false) is the zero-based,
half-open rectangle `{ rowStart, rowEnd, columnStart, columnEnd }`; `null` covers the full matrix.
Explicit axes must be nonempty, ordered safe integers contained in the source. Invalid new
rectangles fail visibly without clamping or fallback. On source shrink, an unchanged previously
accepted viewport keeps its span up to the new dimensions and clamps its origin; a newly assigned
rectangle is validated afresh. Empty dimensions render an empty state without provider reads.
`matrixReducer: LyraHeatmapMatrixReducer = 'mean'` (`matrix-reducer`) chooses `'mean' | 'min' | 'max'`
for tile color; unsupported values fail visibly. Reducer changes repaint accepted tiles.

Each tile supplies the viewport fields plus `{ count, validCount, min, max, sum }`. Tiles must
partition the requested rectangle exactly once, without gaps or overlaps. `count` equals rectangle
area, `validCount` is a safe integer from zero to `count`, and all statistics are finite and
consistent with the complete domain. An empty-valid tile has `min: null`, `max: null`, `sum: 0`;
otherwise extrema are ordered and `sum / validCount` lies within them, allowing a normalized
`32 * Number.EPSILON` floating tolerance. Admission checks a bounded partition and arithmetic
consistency; the provider owns the truth of aggregation over unseen records.

The square overview allocates from available inline size, with tile budget
`T = min(normalized maxCells, max(1, floor(plotWidth) ** 2))`; zero-width layouts defer requests.
The existing `maxCells` default 10,000 and hard ceiling 100,000 apply to tiles here. The component
retains bounded current/replacement tiles and O(T) partition-validation storage, without geometry
or occupancy arrays proportional to logical cell count. One physical tile query and only the
latest queued replacement are allowed. Exact reads share two physical permits, with current and
pending windows of at most 400 records each plus at most one separately selected record (801 total,
at most 1,640,448 retained exact-label units). A pending window replaces the old pane atomically;
obsolete pending buffers are released. Canvas limits remain 16,384 per side and 16,777,216 pixels.

`revealSourceCell(row: number, col: number): Promise<boolean>` resolves and focuses an exact source
coordinate without changing controlled selection or emitting activation. Invalid/out-of-range
coordinates make no provider call; absent, failed, noninteractive or revoked targets resolve
`false`. Revealing outside an explicit viewport silently pans a same-size clamped rectangle by
updating `matrixViewport`; a null/full viewport stays full. Focus restoration respects intervening
user movement. Arrow keys move exact coordinates using physical left/right even under RTL;
Home/End reach row endpoints, Ctrl+Home/Ctrl+End source endpoints, and PageUp/PageDown move up to
20 rows. Each action examines at most 32 excluded candidates. With `accessibleCells: true`,
`source-exact-window` is a separate at-most-20×20 exact grid below the overview, with full logical
ARIA counts and absolute one-based row/column indices; the overview canvas is hidden from assistive
technology. Without it, the named canvas owns the exact cursor.

**Events:** Exact Enter/Space and singleton-tile pointer activation resolve `getCell` and emit the existing
`lr-cell-activate` `{ row, col, value }` with absolute coordinates; missing `null` maps to `NaN`.
`cellText`, `cellInteractive` and `cellColor` receive exact values and absolute coordinates, never
aggregate means. Multi-cell tile pointer activation or Shift+Enter emits noncancelable
`lr-matrix-range-select` with frozen `LyraHeatmapMatrixRangeSelectDetail`:
`{ revision, rowStart, rowEnd, columnStart, columnEnd, count, validCount, min, max, sum }`.
It proposes an aggregate without expanding `selectedCells` or synthesizing exact activation.
`selectedCell`/bounded `selectedCells` stay controlled and programmatic assignments are silent;
row/column, drag and Shift-range expansion remain legacy-only. Source geometry is proportional:
`matrixGeometry` is `undefined` and source paints emit no `lr-matrix-geometry-change`.

Source `exportData('csv')` exports the complete current accepted viewport's aggregate tile snapshot,
with header `rowStart,rowEnd,columnStart,columnEnd,count,validCount,min,max,sum,reducer,value`.
Coordinates are half-open and zero-based; numbers are unlocalized and missing extrema/reducer
values are blank. It performs no provider reads and is not a raw-cell export. Loading, error or
obsolete snapshots export `''`. PNG follows the current bounded overview and existing canvas
readiness gates. Additional parts are `source-status`, `source-error`, `source-summary`, and
`source-exact-window`; existing `base`, `canvas`, `cell`, `tooltip` and legend parts apply where
rendered. The following dense matrix/calendar limits and geometry descriptions apply with
`matrixSource` unset.

**Exported matrix-source declarations:**

Inherited viewport/tile fields are repeated to show the complete effective contracts. `HeatmapSourceCell { readonly value: number | null; readonly rowLabel: string; readonly columnLabel: string }` is the exact-cell reply described above.

`LyraHeatmapMatrixViewport {
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
}`

`LyraHeatmapTile extends LyraHeatmapMatrixViewport {
  readonly count: number;
  readonly validCount: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly sum: number;
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
}`

`LyraHeatmapMatrixRangeSelectDetail extends LyraHeatmapTile {
  readonly revision: LyraSourceRevision;
  readonly count: number;
  readonly validCount: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly sum: number;
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
}`

`LyraHeatmapMatrixSource {
  readonly revision: LyraSourceRevision;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly domain: LyraNumericDomain | null;
  query(request: LyraSourceRequest & LyraHeatmapMatrixViewport & { readonly maxCells: number }): LyraSourceValue<readonly LyraHeatmapTile[]>;
  getCell(row: number, column: number, request: LyraSourceRequest): LyraSourceValue<HeatmapSourceCell>;
}`

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
- `maxCells: number = 10000` (attribute `max-cells`) — projection budget, normalized to 1–100,000.
  Matrix projection keeps a rectangular prefix within that budget. Calendar input retains at most
  that many days and scales its sparse span proportionally from the default 530 weeks, up to 5,300
  weeks, with a minimum one-week span. The accessible cell overlay remains windowed to 400 buttons,
  and canvas backing-store limits still apply.
- `cellSize: number = 22` (attribute `cell-size` — default `22` in matrix mode, `11` in calendar
  mode when left unset; explicitly setting it now governs both modes' per-cell size alike, and it's
  ignored in either mode when `fitToWidth` is set)
- `rowHeight?: number` (attribute `row-height`) — independent matrix vertical row pitch in CSS
  pixels, including its trailing `cellGapY` separator. Unset, removed, `null`, `undefined`, and
  non-finite values restore square rows from the effective `cellSize`; finite values
  clamp to the `1`–`4096` range. This bounds numeric outliers; a grid beyond the canvas limits
  paints at a lower resolution. `fitToWidth`, `minCellSize`, and `maxCellSize` continue to govern column pitch.
  Calendar mode ignores it and preserves its existing square geometry. With `accessibleCells`,
  width and height independently preserve the accessible target floor; dense columns can therefore
  overflow even when fitting is requested.
- `cellGapX: number = 1` / `cellGapY: number = 1` (attributes `cell-gap-x` / `cell-gap-y`) —
  trailing horizontal/vertical gaps in CSS pixels. In matrix mode they are subtracted from the
  horizontal `cellSize` / vertical `rowHeight ?? cellSize` pitch. Negative values clamp to zero, non-finite values use `1`, and oversized
  gaps leave at least one painted pixel. Custom geometry with `accessibleCells` grows the minimum
  pitch and caps gaps to preserve the `--lr-icon-button-size` target floor. In calendar mode they
  are opt-in: only an explicitly set property or attribute replaces the calendar's original `2px`
  spacing between week columns / weekday rows, adding to the pitch (painted cells stay `cellSize`
  square), clamped from zero to `cellSize - 1`; a non-finite value, or removing the attribute,
  restores the original spacing. With none set, calendar geometry is unchanged. Explicit gaps feed
  painting, hit-testing, `fitToWidth`, month/weekday label placement, state rings, and semantic
  cells; caller-supplied `data.columnX`/`data.rowY` origins still win.
- `cellRadius: number = 0` (attribute `cell-radius`) — painted corner radius in CSS pixels,
  clamped from zero to half the smaller painted side; non-finite values use zero. Custom cell
  fills, focus/selection/annotation rings, semantic overlays, and PNG canvas output share the same
  bounds, in both modes (calendar cells round only once it is explicitly set). Custom gaps are
  excluded from canvas pointer hits; rounded cells retain rectangular interaction bounds. The
  default one-pixel matrix separator retains its existing hit area.
- `colLabelInterval: number = 1` (attribute `col-label-interval`) — paint every Nth matrix column
  label starting at column zero, including frozen labels and rotated label measurement. Truncated
  to an integer of at least one; non-finite values use `1`. Every original `data.colLabels` value
  remains available to tooltips, keyboard announcements, semantic cells, and `cellText`.
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
  degrees, applied to matrix column labels. Unset or `0` paints them horizontally. A horizontal label
  is truncated with an ellipsis to its own column (to its `colLabelInterval` columns, at most to the
  canvas edge), so in a dense matrix labels shorten or drop rather than overprint their neighbours;
  `45` or `90` is the standard remedy. Each label rotates about an
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
- `withoutLegend: boolean = false` (attribute `without-legend`, reflected) — hides the colour
  legend, under the same name and the same polarity `lr-chart` has always used rather than a third
  spelling for one idea. The whole row leaves the DOM — the gradient bar or `legendStops` swatches,
  the `legend-lo`/`legend-hi` endpoint labels, the `valueLabel` caption, the labelled `annotations`
  entries and the `legend` slot go with it — so it contributes no layout box and assigns no slotted
  content, rather than being painted and then hidden. The legend's own preparation stops with it:
  `--lr-heatmap-color-steps-gradient`, which this component writes onto the host for the legend bar
  and for nothing else, is not written while the legend is hidden, and is removed again if it had
  been. Cells, tooltips, keyboard interaction, selection and the generated accessible summary are
  unaffected — the summary already names the value label independently of the legend.
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
  and the `lr-cell-activate` payload unchanged. `scale="sqrt"` rejects negatives in both modes — a
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
- `multiple: boolean = false` — opts into controlled multi-cell selection through `selectedCells`.
  The existing `selectedCell` is ignored while enabled and resumes when disabled. Single-cell
  behavior is unchanged when omitted.
- `selectedCells: readonly HeatmapSelectedCell[] = []` (attribute: false) — clone-owned selection
  input, inspected up to `MAX_HEATMAP_CELLS` (10,000) entries. Duplicates, non-integer/out-of-grid
  coordinates and non-interactive cells are ignored. Matrix records use `{ row, col }`; calendar
  records use `{ date }`, including interactive calendar gaps. The component never assigns this
  property in response to user input. It draws selected rings and, with `accessibleCells`, exposes
  per-cell `aria-selected` plus grid `aria-multiselectable="true"`. The localized accessible summary
  reports the selected count through `heatmapSelectedCount`.

  `lr-selection-change` is a non-cancelable proposal: frozen `HeatmapSelectionChangeDetail {
  selectedCells: readonly Readonly<HeatmapSelectedCell>[]; source: HeatmapSelectionSource }`, with
  source `'pointer' | 'keyboard' | 'row' | 'column'`. Assign the event's array back to `selectedCells`
  to accept it; property assignments are silent. Output is deduplicated in row/column order. Click
  or Enter/Space toggles one cell and retains `lr-cell-activate`. Pointer dragging paints or erases
  according to the starting cell, previews transient selection, and proposes once on release;
  pointer cancellation, Escape, disconnect, data/mode changes discard the gesture. A drag does
  not emit a cell click. Shift+arrows (or Shift+Home/End) extends/contracts a rectangle from the anchor while retaining
  unrelated pre-range selection. Directions remain physical under RTL, matching the canvas.

  `toggleRowSelection(row: number): void` and `toggleColumnSelection(col: number): void` propose
  whole-axis toggles for application-owned controls: remove an entirely selected axis, otherwise
  add its interactive cells. Shift+Space and Ctrl/Meta+Space invoke those actions for the focused
  row/column. Calendar rows are weekday rows 0–6 and columns are zero-based weeks. Invalid indices
  and calls outside `multiple` mode are no-ops. For a narrow day/hour matrix, use `accessibleCells`
  and `stickyLabels="both"` to retain usable targets within the component's own scrollport.

  ```js
  import '@aceshooting/lyra-ui/components/lr-heatmap.js';
  const heatmap = document.querySelector('lr-heatmap');
  heatmap.multiple = true;
  heatmap.accessibleCells = true;
  heatmap.addEventListener('lr-selection-change', event => {
    heatmap.selectedCells = event.detail.selectedCells;
    // Derive filter state from the accepted row/column coordinates.
  });
  ```
- `accessibleCells: boolean = false` (attribute `accessible-cells`) — renders `[part="cells"]` with
  at most 400 `[part="cell"]` native buttons around the active cell. The semantic grid exposes the
  full row/column counts, buttons expose localized `aria-label`s and explicit `aria-selected`, and
  roving arrow and Home/End navigation still reaches every canonical cell. The canvas remains the visual and
  pointer surface but is hidden from the accessibility tree. Controlled refresh focus follows the
  preservation/clamping behavior above.
- `cellText?: (pos: MatrixCellPos | CalendarCellPos, value: number) => string` (attribute: false) —
  formats the per-cell hover tooltip and keyboard announcement text; receives the cell
  position (`MatrixCellPos { row, col }` in matrix mode, `CalendarCellPos { week, weekday, date }` in
  calendar mode) and its value. `CalendarCellPos.date` is a **required** ISO `yyyy-mm-dd` string,
  present for every grid position — including a sparse gap position with no matching entry in `days`
  at all, which still sits on a real calendar day (that case simply reports the `-1` "no data" value
  alongside it). It lets a callback key off the date without re-deriving the grid's own
  anchor-week arithmetic; `MatrixCellPos` is unchanged, and so is `lr-cell-activate`'s detail.
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
  skewed dataset. A `var()`, `color-mix()` or `currentColor` result resolves in the heatmap's own
  theme scope; one that does not resolve paints the no-data fill. Unset (the default) reproduces the
  exact ramp/no-data behavior for every cell.
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
  Month labels are measured before painting: overlapping labels yield to the month occupying
  more week columns, boundary labels shift inside the canvas, and labels wider than the entire
  calendar are ellipsized. The calendar keeps its physical left-to-right axes under RTL.
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

**Getters/methods:** `exportData('csv'|'png')` returns a spreadsheet-safe CSV snapshot of the
underlying matrix/calendar values or a PNG data URL for the most recently completed canvas paint.
The CSV form reads `data` directly (not any bounded render cache) and omits no-data cells — one
`row,column,value` row per real matrix cell, or `date,value` per real calendar day. Finite numeric
values retain their precision without display rounding or locale formatting; text cells remain
guarded against spreadsheet formulas. The PNG form
includes the painted axes, cells, focus/selection/annotation overlays, and frozen
label bands while `stickyLabels` is enabled; the DOM legend, tooltip, and accessible-cell buttons
are deliberately excluded. It returns `''` before a completed paint, while rendering is deferred or
zero-sized, after disconnect, or when the browser cannot encode the snapshot. `refreshTheme()` —
redraws canvas content after an upstream design-token or color-scheme change; called automatically
on theme changes, exposed for a consumer that needs to force a redraw manually. `matrixGeometry: Readonly<LyraHeatmapMatrixGeometryChangeDetail> | undefined` — the gutter/cell geometry the last matrix-mode draw actually painted with,
in CSS pixels; `undefined` in calendar mode. Lets a light-DOM consumer line up with the canvas
without hardcoding the same numbers `row-label-width`/`col-label-height`'s `"auto"` resolution would
otherwise keep private. For the case that motivated it — a frozen header or gutter on a tall or wide
matrix — prefer `stickyLabels`, which freezes the band inside the component and needs no mirror at
all; the getter remains the way to align a *separate* element (a sibling chart, a custom overlay)
with the grid. `LyraHeatmapMatrixGeometryChangeDetail` contains `padLeft`, `padTop`, and `cellSize`
(the horizontal pitch), plus optional `rowHeight` when vertical pitch differs and optional
`cellWidth`, `cellHeight`, and `cellRadius` for custom matrix
presentation. When those optional fields are absent, painted width/height are `cellSize - 1` and
radius is zero. The getter and geometry-change event always share one frozen snapshot, including
changes to the resolved row pitch, gaps, and radius. Use `rowHeight ?? cellSize` to position rows.

`calendarGeometry: Readonly<LyraHeatmapCalendarGeometry> | undefined` (read-only; assignment is
ignored) is the calendar-mode counterpart: the frozen snapshot of the last calendar draw with
`padLeft` (weekday gutter), `padTop` (month band), `cellSize`, `cellWidth`, `cellHeight`,
`cellGapX`, `cellGapY`, `cellRadius`, `weekCount`, and `firstDayOfWeek`. `undefined` outside
calendar mode and before the first calendar draw; the same object is returned until the painted
geometry changes, at which point `lr-calendar-geometry-change` fires with that same frozen object as
its `detail`, mirroring `matrixGeometry`/`lr-matrix-geometry-change`. With `data.columnX`/`data.rowY`,
those callbacks position individual columns/rows instead of `padLeft`/`padTop` plus the gaps.

For a GitHub-style contribution graph with rounded, visibly spaced cells, stay in calendar mode and
set `cell-gap-x="3" cell-gap-y="3" cell-radius="2"` — week columns, weekday/month labels, date
selection, `lr-cell-activate`, and `cellText` keep working with no matrix rebuild.

For a fluid day/hour matrix, keep all 24 hour strings in `data.colLabels` and use
`fit-to-width cell-gap-x="1" cell-gap-y="2" cell-radius="2" col-label-interval="3"`.
For a dense matrix with 144 time columns and 20 rows, use `fit-to-width row-height="28"` to fit
columns while keeping readable rows. Row height includes the trailing separator and stays `28px`
when the host resizes. The existing `minCellSize` floor and accessible target sizes can require
horizontal overflow in a narrow allocation; choose `sticky-labels` when you want a scrollport.
For a single fluid square cell, use `fit-to-width` with equal horizontal and vertical gaps.

**Events:** `lr-selection-change` (not cancelable; frozen readonly `HeatmapSelectionChangeDetail { selectedCells, source }` proposal in multiple mode, with `source: 'pointer' | 'keyboard' | 'row' | 'column'`; accept it by assigning `selectedCells`). `lr-cell-activate` (fired on click, or Enter/Space on the keyboard-focused cell —
`detail: { row, col, value }` in matrix mode, `detail: { date, value }` in calendar mode),
`lr-matrix-geometry-change` (fired after a matrix-mode draw whose resolved `matrixGeometry` differs
from the previous draw — e.g. after `row-label-width="auto"`/`col-label-height="auto"` resolves
against new content or a resize; `detail` is the same object `matrixGeometry` returns; never fired
in calendar mode), `lr-calendar-geometry-change` (the calendar-mode counterpart — fired after a
calendar-mode draw whose resolved `calendarGeometry` differs from the previous draw, e.g. after
`cellGapX`/`cellGapY`/`cellRadius` changes or a `fitToWidth` resize; `detail` is the same object
`calendarGeometry` returns; never fired in matrix mode)

**Slots:** `legend` — custom content rendered inside the built-in `[part="legend"]` row, after the
gradient/`legendStops` swatches, the trailing `valueLabel` caption, and any labeled `annotations`
entries. Presentation-only, like `legendStops`: slotted content is never consulted by the color
ramp, the bucket math, the tooltip, or the generated accessible name. Nothing is rendered, and the
slot itself is absent from the shadow root, while `withoutLegend` is set. Available since 13.0.0;
this doc previously said "Slots: none" for several releases after that, which was a documentation
gap rather than a behavior change — the slot has worked, unannounced, the whole time.

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

With `matrixSource` set, additional CSS parts are `source-summary` (complete matrix and displayed viewport summary),
`source-status` (loading text), `source-error` (localized failure), and `source-exact-window`
(the bounded exact grid rendered when `accessibleCells` is true).

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
`--lr-heatmap-hover-ring-color` (defaults to the effective `--lr-heatmap-focus-ring-color`) —
the pointer-hover outline on the canvas and accessible cells. Set it to `transparent` to omit
that outline while retaining keyboard-focus and pressed feedback. Leaving it unset preserves
existing hover styling; native forced-color adjustment remains enabled.

`--lr-heatmap-color-steps-gradient` (default
`linear-gradient(to right, var(--lr-heatmap-scale-lo), var(--lr-heatmap-scale-hi))` — the gradient
painted on the continuous legend bar; the component writes it onto the host itself while
`colorSteps` is supplied and the legend is rendered, and removes it again when either stops being
true — `withoutLegend` takes the legend row, this property's only reader, out of the DOM — so it is
a read-out rather than a knob you set). `--lr-heatmap-annotation-color` (default `var(--lr-color-danger)` — the canvas-drawn ring
stroked around an annotated cell, deliberately not one of the sequential ramp colors so it stays
visible regardless of what it's drawn over). `--lr-heatmap-selected-color` (default
`var(--lr-color-success)` — the canvas-drawn ring stroked around the persistent `selectedCell`, a
dedicated token distinct from both the focus ring and the annotation ring so a host can retheme it
independently). `--lr-heatmap-tooltip-bg` (default
`var(--lr-color-surface)`) and `--lr-heatmap-tooltip-color` (default `var(--lr-color-text)`) —
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

- Matrix and calendar projections use `maxCells` (10,000 by default); calendar span scales from
  the default 530 weeks with that budget. Color-step/legend-stop/annotation projections each display
  at most 256 entries. Their owned snapshots and `selectedCells` retain at most 10,000 entries and
  50,000 cloned values; deeply nested records can reach the value budget first.
  `[part="projection-limit"]` and the generated accessible summary disclose visual projection and
  input loss; changed notices are announced politely. The semantic grid mounts at most 400 cell
  buttons while preserving full navigation.
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
  than stretching to fill. `fit-to-width` derives that cell size from the host's own measured
  `clientWidth`, so do **not** make the host itself shrink-to-fit (`display: inline-block`,
  `inline-size: fit-content`, floating it, ...) to chase the capped canvas — that makes the host's
  width a function of its own rendered content while the content's width is derived from the host's
  width, a circular sizing dependency the browser cannot resolve stably. Keep the host at its normal
  block-level, fully-sized width and position the canvas within it instead:
  `::part(canvas) { margin-inline: auto }` centers it, `::part(canvas) { margin-inline-start: auto }`
  end-aligns it. Reach for `::part(canvas)`, not `::part(base)`: `[part="base"]` is a flex column, so
  `::part(base) { align-items: center }` also centers the canvas, but shrink-wraps every other base
  child along with it — the legend row included, which loses its full-width wrap layout and
  collapses to the canvas's own (possibly capped) inline size.
- the host is `role="group"` (not `role="img"`) with a dimensions+range summary `aria-label`
  (calendar mode: a day-count + range summary instead). In default canvas mode,
  `[part="canvas"]` is itself a named `role="application"`, focusable, keyboard-operable,
  per-cell-interactive control (roving arrow-key focus, shared light-DOM announcements,
  `lr-cell-activate`). `role="img"` would flatten that interactive subtree for some assistive tech.
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
- this component's legend can show more than a label (a value caption, `legendStops` swatches,
  annotation entries, a custom slot) and can now be turned off outright with `withoutLegend`.
  `lr-sequence-strip`'s `withLegend` key is swatch+label only, the same "legend needs more than a
  label" shape `lr-context-meter`'s `legendDisplay` addresses for that component; unaddressed here,
  since fixing it belongs with whichever component actually has the gap.

---

## `lr-sequence-strip`

A compact, one-thin-cell-per-item (or per item range) strip visualizing a sequence of categorical
states, with an
optional secondary per-cell marker. Pure CSS/flex — no chart.js, no SVG, no canvas — sized/named
consistently with the sparkline/heatmap family, and read as a glanceable aggregate. `[part="base"]`
is a labeled `role="list"` and each cell a named `role="listitem"` (`aria-label`, `aria-posinset`,
`aria-setsize`), so the sequence is walkable item by item rather than collapsed into one summary
string. Exactly one cell is tabbable at a time (roving `tabindex`); ArrowLeft/ArrowRight and
Home/End move the stop — direction-aware, so the arrows swap under RTL — and keyboard focus on a
cell shows the same `[part="tooltip"]` detail that pointer hover does (a click-focused cell keeps no
tooltip once the pointer leaves). That tooltip is positioned from the
active cell, not from the center of the whole strip. The tooltip is visual only and is not
wired through `aria-describedby`, because the cell's own `aria-label` already exposes the identical
text and describing it again would duplicate the announcement. Cells are actionable: clicking a
cell, or pressing Enter/Space on the roving cell, emits `lr-item-activate`. Selection is controlled,
so the consumer updates `selectedIndex` when it accepts that activation. Setting `withLegend`
additionally renders a static `[part="legend"]` key below the strip, so the color-to-category
mapping is readable without visiting each cell.

A standard host `aria-label` names the internal list and wins by presence, including empty. With
no host label, the generated category-count summary names it. When an
`items` refresh occurs while a cell owns focus, its `id` remains the sole roving stop; removal
clamps focus to the nearest survivor, or to the stable list base when no cells remain. Unfocused
refreshes do not move focus. A queued Arrow/Home/End focus is bound to the current item-array
identity and connection generation, so a same-turn replacement or disconnect/reconnect cannot
focus an unrelated cell that merely inherited the old numeric index.

With `source` unset, high-cardinality strips retain at most the first 10,000 assigned items and categories as detached,
frozen canonical snapshots; reassign either collection after changing it. At most 200 cells are
rendered. **At or below that cap each cell is one item. Past it the strip becomes a span-preserving
overview rather than a window:** the retained items are distributed over exactly 200 contiguous
ranges, each cell painted by its range's dominant category (a tie goes to the category appearing
earliest in the range) and carrying `[part="marker"]` when any item inside it sets `marker`. The 200
cells tile the sequence exactly once, so the strip always covers the full span at full width and
never needs horizontal scrolling. Roving focus, `aria-posinset`/`aria-setsize`, `aria-current` and
activation all address cells rather than items: ArrowLeft/ArrowRight and Home/End step one range at
a time, and each cell exposes `data-range-start` / `data-range-end` (zero-based, inclusive item
indices) alongside its `data-index` range position. `[part="bucket-summary"]` visibly discloses the
item total and range count, and the same localized text is appended as a trailing clause to the
generated `aria-label` so assistive technology learns the cells are ranges. The optional legend
likewise mounts at most 200 categories and exposes `[part="legend-limit"]` as a rendered/total
numeric disclosure.

**Complete indexed source:** `source: LyraSequenceSource<SequenceStripItem> | null = null`
(attribute: false) takes precedence over `items`, preserving the provider's identity. `null` or
`undefined` restores the current legacy items; other invalid defined values fail visibly.
Reassign even the same source, or call a keyless `requestUpdate()`, after revision/state changes.
Named theme, strings and legend paints reuse accepted data; locale, disconnect/reconnect and
adoption revoke obsolete requests/effects. Providers should honor abort signals; ignored aborts
keep physical request permits occupied until settlement.

```ts
import type { LyraSequenceSource, LyraSequenceRangeSummary, SequenceStripItem } from
  "@aceshooting/lyra-ui/components/data/sequence-strip/sequence-strip.class.js";
import type { LyraSourceRequest, LyraSourceValue } from
  "@aceshooting/lyra-ui/utilities/data-preparation.js";
```

`LyraSequenceSource<T>` supplies immutable `revision` (a nonempty string or finite number), safe
nonnegative integer `length`, and
`getItem(index, { signal }): LyraSourceValue<T | null>`,
`findIndex(id, { signal }): LyraSourceValue<number | null>`, and
`summarize({ signal, startIndex, endIndex, maxRanges }): LyraSourceValue<readonly
LyraSequenceRangeSummary[]>`. The summary request spans `[0, length)` and asks for at most
`min(length, 200)` ranges; an empty source needs no provider read. Each summary has
`{ startIndex, endIndex, categoryCounts, markerCount, enabledCount }`: ascending, nonempty,
half-open ranges must partition the complete logical sequence without gaps or overlap.
`categoryCounts` is an own-data string-to-positive-safe-integer dictionary whose counts sum to
the range length; marker/enabled counts are safe integers from zero to that length. The provider
owns immutable snapshots, indexing and the truth of complete-source totals; admission verifies
bounded shape and arithmetic consistency.

At most 200 ranges, 200 distinct global category IDs and 40,000 category-count pairs are admitted.
Summary category IDs are nonblank and at most 1,024 UTF-16 units. Exact `SequenceStripItem` records
have own-data `id`, `categoryId`, optional `label`, optional boolean `marker`/`disabled`; the aggregate
length of `id`/`categoryId`/`label` is at most 65,536 UTF-16 units. Malformed, accessor-backed or
oversized records fail without clipped labels or compacted indices. The component retains bounded
current/pending summaries and one exact record, with one physical summary request and one physical
exact request; only the latest queued intent survives. String lookup and its subsequent exact read
are sequential. There is no raw-item scan or complete source array in the component.

Overview range widths are proportional to their actual lengths. Global category and marker counts
include every range, and `selectedIndex` highlights its containing range. Source dominant-category
ties use configured `categories` order, then lexical category ID; the legacy route retains its
earliest-occurrence rule. A source range is disabled only when `enabledCount === 0`; mixed ranges
report their enabled count. Overview activation still resolves the range's first exact item and
emits the unchanged `lr-item-activate` `{ index, id, item }` with its original zero-based index and
ID; a disabled or unavailable first item emits nothing. Hover and overview focus use the summary,
including bounds, dominant category, marker count and enabled/total counts, without exact reads.
`data-range-end` remains inclusive in rendered range attributes; provider bounds are half-open.

`revealSourceItem(target: number | string): Promise<boolean>` resolves an original index or stable
ID, updates the separate exact inspection cursor and focuses its control while focus ownership is
still current. ID lookup uses `findIndex` then verifies the returned `getItem` ID. It does not
change `selectedIndex` or emit activation. Disabled exact items remain inspectable and resolve
`true`; absent, invalid, unavailable or revoked targets resolve `false`. The `source-exact` native
button supports RTL-aware Left/Right and Home/End over the complete original index range, including
missing/disabled positions; it does not scan for enabled items. Enter/Space or click activates only
the current admitted enabled exact item. Pending/unavailable detail keeps a focusable localized
inspector fallback. Controlled `selectedIndex` changes resolve exact detail silently. Source-only
parts are `source-status`, `source-retry` and `source-exact`; `base`, `cell`, `marker`, `tooltip`,
`bucket-summary`, `empty` and existing legend parts remain applicable. Initial errors are quiet;
later status transitions use localized light-DOM announcements. No completion event is added.

The following item-array limits and per-item disabled/tie rules apply with `source` unset.

**Exported sequence-source declarations:**

These declarations use the request/value types and granular class import shown above.

`LyraSequenceSource<T> {
  readonly revision: LyraSourceRevision;
  readonly length: number;
  getItem(index: number, request: LyraSourceRequest): LyraSourceValue<T | null>;
  findIndex(id: string, request: LyraSourceRequest): LyraSourceValue<number | null>;
  summarize(request: LyraSourceRequest & {
    readonly startIndex: number;
    readonly endIndex: number;
    readonly maxRanges: number;
  }): LyraSourceValue<readonly LyraSequenceRangeSummary[]>;
}`

`LyraSequenceRangeSummary {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly categoryCounts: Readonly<Record<string, number>>;
  readonly markerCount: number;
  readonly enabledCount: number;
}`

**Properties:**

- `items: readonly SequenceStripItem[] = []` (attribute: false) — `{ readonly id, readonly
categoryId, readonly marker?, readonly label?, readonly disabled? }`;
  `marker` renders a small bottom marker on that cell independent of the category color (e.g. a
  subagent-dispatched turn); `label` is per-item hover/focus tooltip text _and_ that cell's own
  `role="listitem"` accessible name, falling back to the matching category's own nonblank `label`,
  then localized `sequenceStripUnnamedCategory` (`"Unnamed category"` in the built-in English
  catalog) when unset — it is not read by `[part="base"]`'s auto-generated `aria-label`, which
  summarizes by category/count only. `disabled` marks the item non-actionable:
  `aria-disabled="true"` replaces the selected/active affordances of the cell that represents it,
  activating it (click or Enter/Space) emits nothing, and roving Left/Right/Home/End navigation —
  including the default resting tab stop — steps past it. Above the 200-cell cap, a range cell's
  disabled state follows its own activated item, the range's first. Omitted or `false` renders the
  item exactly as before this field existed
- `categories: readonly SequenceStripCategory[] = []` (attribute: false) — `{ readonly id,
readonly color, readonly label? }`; `color`
  is the cell background for every item whose `categoryId` matches `id`; invalid CSS colors,
  declaration-breaking input, `url()`, and unmatched categories render `transparent`. `label` is
  used in the auto-generated `aria-label` summary and as the hover-tooltip fallback text, falling
  back to localized `sequenceStripUnnamedCategory` when omitted or blank rather than exposing the
  internal `id`. Both collection properties are cloned and frozen at assignment,
  bounded to the first 10,000 source entries, and require reassignment after changes; empty/blank
  ids are omitted and duplicates use the first valid entry, so identity is deterministic
- `withLegend: boolean = false` (attribute `with-legend`, reflected) — renders a static
  `[part="legend"]` key below the strip, one swatch + label row per `categories` entry, in array
  order. The key describes the _scheme_, not the current data: a category with no matching item
  still gets a row, and an item whose `categoryId` matches no entry adds none. Deliberately
  non-interactive — it toggles nothing and emits nothing (`lr-graph-legend` is the interactive,
  filtering legend). Because it only repeats the category names `[part="base"]`'s own `aria-label`
  summary already announces, the legend is `aria-hidden` — visible on screen, announced exactly
  once — and it wraps onto further rows in a narrow allocation rather than overflowing.
- `markerLabel?: string` (attribute `marker-label`) — names what an item's `marker` _means_ (e.g.
  `"Subagent"`). Setting it does two things: with `withLegend` on it adds one trailing
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
  cell's background is data (its category colour) and tinting it would misreport the category. Past
  the 200-cell cap the whole range that contains `selectedIndex` reads as selected, since that range
  is the only thing the strip draws for it

The single-member `orientation: 'horizontal'` property was **removed in 9.0.0**: nothing read it and
the stylesheet never mentioned it, so the reflected attribute styled nothing. Delete the attribute;
the strip has always laid out horizontally.

**Events:** `lr-item-activate` — `detail: { index: number; id: string; item: SequenceStripItem }`,
fired when a cell is clicked or activated with Enter/Space on the roving-tabindex focus. Past the
200-cell cap a cell stands for a range, and the event reports that range's **first** item — a real
sequence index a playback consumer can scrub from, not a synthesized midpoint. The `detail` shape is
unchanged. Not
cancelable: nothing in the component branches on `defaultPrevented`. Bubbles and composed, like every
library event.

**Slots:** none.

**CSS parts:** `base` (the root strip, `role="list"`), `cell` (each item's `role="listitem"` cell,
background-colored by its category, carrying the roving `tabindex`, and activatable by click or
Enter/Space — it has a pointer cursor, a thin quiet hover outline distinct from the focus ring, a
press treatment, and `[data-selected]` when
it is `selectedIndex`), `marker` (the small bottom
marker on a cell whose item sets `marker: true`), `tooltip` (the detail tooltip showing the active
item's label, hidden until a cell is hovered or keyboard-focused), `empty` (visible localized "No
items" text, rendered only while `items` is empty),
`legend` (the static category key rendered below the strip when `withLegend` is set — `aria-hidden`,
as it repeats the strip's own `aria-label`), `legend-item` (one swatch + label pair, one per
`categories` entry, plus one trailing marker row when `markerLabel` is set), `legend-swatch` (the
color chip, matching that category's cell color), `legend-marker-swatch` (the marker row's chip
instead: a neutral chip carrying the same bottom bar a `marker: true` cell paints, in the same
`--lr-sequence-strip-marker-color`), `legend-label` (the category's nonblank `label`, or localized
`sequenceStripUnnamedCategory`), `bucket-summary` (the item-total/range-count disclosure, rendered
only while the strip is past its 200-cell cap; it replaced 15.x's `window-range`, which disclosed a
projection window this component no longer has), and `legend-limit`
(bounded legend/total).

With `source` set, additional CSS parts are `source-status` (loading or failure text), `source-retry` (retry the current
source failure), and `source-exact` (the exact-item inspection and activation button).

**Themeable custom properties:** `--lr-sequence-strip-height` (default `1.5rem` — the strip's
block-size), `--lr-sequence-strip-marker-color` (default `var(--lr-color-text)` — the
`[part="marker"]` fill, and of the marker legend row's bar), `--lr-sequence-strip-legend-swatch-size`
(default `0.625rem` — a legend swatch's inline- and block-size, category and marker rows alike), and
`--lr-sequence-strip-legend-marker-bg` (default `var(--lr-color-surface-raised)` — the neutral chip
background behind the marker legend row's bar; it stands in for "any cell", so it deliberately
matches no category color), `--lr-sequence-strip-disabled-opacity` (default `var(--lr-opacity-disabled)` — opacity of
a cell whose activated item sets `disabled`), `--lr-sequence-strip-selected-color` (default
`var(--lr-color-text)` — colour of the persistent selection ring on a cell whose index is in
`selectedIndex`), and `--lr-sequence-strip-selected-focus-color` (default
`var(--lr-focus-ring-color)` — colour of that same ring while the cell also has keyboard focus); the
tooltip also consumes shared tokens
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

- the activation event is `lr-item-activate`, not `lr-cell-activate`. Click and Enter/Space emit the
  activated item's `index`/`id`, but do not mutate the controlled `selectedIndex`; listen for the
  event and update that property when the application accepts the activation.
- an `items` entry whose `categoryId` has no matching `categories` entry still contributes to the
  strip (its cell's background is `transparent`) rather than being dropped, so a strip renders one
  cell per item — or, above the 200-cell cap, one cell per range — regardless of `categories`
  coverage.
- **16.0 migration:** above 200 items the strip renders item RANGES, not a 200-item window. Rename
  any `::part(window-range)` selector to `::part(bucket-summary)`. Code that read a cell's
  `data-index` as an item index must read `data-range-start` / `data-range-end` instead — above the
  cap `data-index` is the range's position in the strip, not an item's position in the sequence. Two
  localization keys are new: `sequenceStripBucketLabel` (`"{label}, items {start} to {end}"`) and
  `sequenceStripBucketSummary` (`"{items} items in {ranges} ranges"`).
- **9.0 migration:** rename category `{ key }` to `{ id }` and item `{ category }` to
  `{ categoryId }`. Reassign after changes; caller mutation no longer changes the installed
  snapshot. Category clauses use effective-locale `Intl.ListFormat` punctuation.

---

## `lr-tree` / `lr-tree-item`

An expand/collapse hierarchy (document/graph navigation tree). Mirrors `wa-tree`/`wa-tree-item` and
`sl-tree`/`sl-tree-item`.

An otherwise unnamed data row receives its stable `id` as a semantic name. Usable `accessibleLabel`,
visible label, description, badge content and explicit host naming retain precedence; the fallback
changes neither visible content nor installed data. Blank visible labels remain supported.
Declarative items receive no automatic ID fallback.

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

**Provider hierarchy:** `treeSource: TreeSource | undefined` (attribute: false) is an
identity-owned full-source route. `TreeSource` is
`LyraHierarchySource<LyraTreeNodeData, LyraHierarchyQuery>` from
`@aceshooting/lyra-ui/data-sources.js`. A defined source takes precedence over `data` and authored
items; invalid defined input shows a localized source error instead of restoring legacy rows.
Setting `undefined` restores the current authored-over-data precedence below. Source descriptors
are never assigned to `data`, and author-written items are retained without being rendered in
source mode. Reassign the source, including the same object, or call a keyless `requestUpdate()`
after revision or provider-state changes. Locale changes and reconnect/adoption refresh the
projection; unrelated named display updates do not.

The provider's `project(request)` handles `reset`, `toggle`, `reveal` and `select` actions and returns
an immutable `{ state, total, rows, focusIndex? }` projection. Requests include revision, locale,
abort signal, previous opaque `state` (initially `null`), and the fixed query
`{ search: '', hiddenKinds: [] }`. `total` counts all logical nodes, including collapsed nodes;
`rows.count` counts the complete currently visible preorder. Both are nonnegative safe integers,
with `rows.count <= total`. The summary reports those logical counts, not mounted rows. A million
nodes can remain in host-owned storage without a library-wide flattening or ancestor index.

`rows` is a `LyraHierarchyView<LyraHierarchyRow<LyraTreeNodeData>>`: either indexed
`itemAt`/`keyAt`/`indexOfKey`, or asynchronous `read` plus required `indexOfKey`. There is no scan
fallback for key lookup. Each row supplies its global unique `key`, matching `value.id`, plus
`parentKey`, one-based `level`/`position`, exact sibling `setSize`, `childCount`, `expanded`,
`selected`, and optional
`disabled`/`selectionState`. Hierarchy metadata owns those states; nested `value.children` is never
read. Keys must be nonblank strings of at most 65,536 UTF-16 units and are preserved verbatim.
The opaque state token must be a nonempty string of at most 65,536 units. Display values use own
data properties, at most 100 badges and 65,536 aggregate display-text units per row; malformed or
oversized rows fail visibly without compacting logical indices. The provider owns global key
uniqueness and immutable snapshot consistency; validation covers the bounded admitted window.

The source view mounts at most 301 rows, retaining four 100-row pages plus at most one focused
ready row (401 total). Range requests contain at most 100 rows, with at most two physically pending
reads. One projection call runs at a time with only the latest replacement queued. Loading/error
rows are not selectable records; localized retry preserves their logical position. Empty is a
separate valid state. Providers should honor abort signals; revoked results cannot commit, but an
ignored abort does not release a physical request until it settles.

Source keyboard navigation uses the full visible count for Home/End, direct provider lookup for
parents/reveal, and RTL-aware branch arrows. Disabled-row navigation examines at most 32 candidates
and keeps current focus if none can be resolved. Logical ARIA depth/sibling positions remain exact
while visual indentation clamps at 32 levels. A bounded roving row or root entry stop remains
available as rows scroll; an off-window focused row is retained within the same mount bound.
The provider owns selection/cascade/partial state: `single` selects an item, `leaf` permits only
leaves, `multiple` toggles an item or a branch's `subtree`, and `leaf-multiple` toggles leaves only.
These adapters expose exploration and selection, with no component source search/copy controls.
`maxNodes` governs the legacy data model, not the source total or its fixed window bounds.

**With `treeSource` undefined, two legacy child models are accepted and never interleave.**

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
Author-written light-DOM items have no total-node cap; traversal still stops at 64 descendant levels.

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
  recursively frozen snapshot: mutate caller data only before assignment, then reassign a new array
  after changes (rebinding the same array is a no-op). A refresh is diffed by id: a node whose
  fields (including an icon template from the same literal with equal values) and children are
  unchanged keeps its previous object, so its row neither re-renders nor re-seeds element state.
  Normalization accepts at most `maxNodes` valid nodes (default 1,000) and 64 descendant levels, and lazily
  inspects at most 10,000 root/child array positions globally in depth-first order. It never
  invokes caller accessors and exposes `dataTruncated = true` when malformed or over-budget input
  was omitted or the inspected-position ceiling was reached. When more than `maxNodes` valid nodes are
  supplied, the localized `limit` part reports the retained-node cap; malformed input alone does
  not show that cap notice. Collapsed branches do not instantiate descendants; disclosure projects only normalized
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
  the complete reachable hierarchy; malformed rows, blank IDs and later duplicates are omitted as described above
- `maxNodes: number = 1000` (attribute `max-nodes`) — the object-data node budget, normalized to
  `1..10000`; unset or non-finite values restore 1,000. Set it before assigning `data`. Raising it
  does not recover excluded input automatically: reassign the original source after raising the cap.
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
multiple mode. It returns an empty frozen array in source mode; it never enumerates unmounted
provider selection. `dataTruncated: boolean` reports legacy bounded/malformed normalization as
described above.

**Keyboard:** ArrowDown/ArrowUp move the roving focus to the next/previous _visible_ node.
ArrowRight expands a collapsed node (focus stays put; a second ArrowRight then steps into the first
child) or moves into an already-expanded node's first child. ArrowLeft collapses an expanded node, or
moves focus to its parent. Home/End jump to the first/last visible node. Alt-modified keys are left
to the browser (Alt+Arrow is back/forward on Windows and Linux). Enter/Space activate
`select()` on the focused node. Interactive content inside an item's label (a button, a link, a
nested control) keeps its own keys and clicks: they neither navigate nor select the row. The roving
stop follows real focus, including focus a host moves by
script; a programmatic `expand()`/`expandAll()` leaves it in place, and a collapse that hides it moves
it to the collapsed row. While `reorderable`, **Ctrl/Cmd**+ArrowUp/ArrowDown moves the focused
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

**Methods:** `revealSourceKey(key: string): Promise<boolean>` asks the source to reveal a global
key and focuses its current visible row; it resolves `false` for absent, invalid, obsolete or
unset-source requests. Source `reveal` responses need a valid `focusIndex` to resolve successfully.
`expandAll(): Promise<void>`, `collapseAll(): Promise<void>` (both iterative, bounded
by hierarchy depth, and resolved only after the affected rendered item cascade settles). Items at
each depth expand together, preserving their individual lifecycle events, motion durations and lazy
loading behavior.

Both bulk methods are no-ops in source mode, and `reorderable` has no source-mode effect. Expansion
and selection use provider projection actions rather than legacy item/lazy lifecycle events.

**Events:** source mode emits `lr-source-selection-change` only after a current user selection
projection commits: frozen readonly `detail: { key: string; selected: boolean;
scope: 'item' | 'subtree'; state: string }`. It reports the accepted global-key intent and new
opaque state, without constructing a DOM selection array. The following events are legacy-only:
`lr-selection-change` (`detail: { selection }`, where both the detail and selection
snapshot are frozen; fired for user selection and when a `data` refresh removes or re-seeds selected
rows) and `lr-reorder` (`detail: { nodeId, parentNodeId, fromIndex, toIndex }`, only while `reorderable`).
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
empty-state message shown when neither child model has any items; `limit` is the localized
retained-node cap notice when valid object-data nodes exceed `maxNodes`.
Source mode adds `source-list`, `source-row`, `source-toggle` (branch and retry buttons),
`source-label`, `source-status`, and `source-error`, retaining the `base`/`tree` aliases. Its tree
root owns the accessible name, busy state and multiselectability; flat source rows own their
treeitem metadata. Source rows are not `<lr-tree-item>` instances and do not use its item slots.

**Themeable custom properties:** shared tokens `--lr-space-xs`/`-s`, `--lr-color-brand-quiet`,
`--lr-color-text-quiet`, `--lr-color-border`, `--lr-color-border-subtle`, `--lr-color-text`,
`--lr-radius`, `--lr-focus-ring-*` (row `:focus-visible` ring, driven by `:host(:focus-visible)`
since the host itself is the focusable `role="treeitem"`), plus `--indent-size`, `--indent-guide-color`,
`--indent-guide-offset`, `--indent-guide-style`, and `--indent-guide-width`.

**Optional peer deps:** none.

### `lr-tree-item`

One row of the tree, in either legacy child model; provider source mode renders its own bounded
flat rows instead. `role="treeitem"` (plus
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
  `selected`/`lazy`; a refreshed object identity re-seeds `lazy`, and re-seeds `selected` only when
  it sets `selected` explicitly or carries a different `id` — a same-id refresh that omits
  `selected` (the lazy-load reply, a badge update) keeps the tree-managed selection. Light-DOM children are
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
  `aria-label` is authoritative in both models
  (including the component-owned stable-ID fallback for otherwise unnamed data rows); otherwise `item.accessibleLabel || item.label` in
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
nesting depth), `--indent-guide-color` (default `var(--lr-color-border-subtle)`),
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
fallbacks). Selected rows use brand text at rest and on-quiet text while hovered or pressed;
`--lr-tree-selected-color` overrides all three states. The selected-row background is also the
base its hover/press mixes from, and each
checkbox border token also paints that state's border under the pointer; and paired
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
  roving `tabIndex`. Context, selection and disclosure walks retain the 64-level depth guard;
  object data also retains its configured node cap. Moving focus patches the previous and next
  item without rebuilding the hierarchy.
- row enrichment is intentionally structured rather than an unrestricted renderer: use `icon`,
  `label`, `description`, `badges`, and `accessibleLabel`. This keeps the host as the single
  `role="treeitem"` interaction target and preserves the APG keyboard model.
- `lr-file-tree` does **not** forward `reorderable`, and deliberately so: its `LyraTreeNodeData[]` is
  derived from `nodes` and keyed by filesystem path, an order it does not own.
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
connect interaction. Editor gestures are opt-in with `nodes-draggable`,
`connectable`, and `droppable`. The component snapshots model inputs instead of retaining mutable
caller aliases, and reports edit intent for the host to apply.

With `graphSource` unset, node cards and edges outside the visible viewport are culled. Active and selected nodes, active
and selected edge endpoints, connection targets and their incident edges remain available.
Keyboard navigation retains the complete model order and pans to reveal its destination. Panning
queries retained geometry indexes; companion snapshots contain the complete admitted model.
Viewport culling preserves existing collection-admission limits and controlled model semantics.
Without a measurable viewport, including during SSR, the complete model is rendered.

For legacy array inputs, input/output handle IDs are reserved only after their complete handle record is admitted; unreadable
optional labels cannot suppress a later valid handle with the same ID.

Legacy node metadata uses a shared 50,000-position inspection budget per node assignment, at most
10,000 own keys per record and 16 descendant levels. Cloned JSON references and cycles are shared
across node data roots and frozen; non-plain leaves remain opaque. The `input-limit` part reports
node/edge or metadata admission loss separately from `layout-limit`. JavaScript key enumeration
itself can still scale with an individual object's key count.

Anchored Lyra overlays in a node's slotted content (a node menu, a tooltip) resolve the `fixed`
strategy by default, because a node is translated inside a scaled, clipped world where an
`absolute` overlay could never extend past the canvas; a trapped `fixed` overlay opens in the
browser top layer where the native Popover API exists. An authored `positioning-strategy`, an
ancestor `--lr-positioning-strategy`, or `lr-flow-canvas::part(node) { --lr-positioning-strategy:
absolute }` still wins. Wheel and pointer gestures that start inside an open node overlay stay its
own: scrolling a long menu scrolls it instead of zooming the canvas, and pressing its chrome does
not drag the node.

Horizontal RTL reflects the coordinate plane while authored cards, generated `lr-flow-node` cards,
native portable fallback cards and SVG edge labels retain readable content. Explicit physical model
coordinates remain unchanged.

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

**Complete workflow source:** `graphSource: FlowCanvasSource | undefined`
(attribute: false) takes precedence over `nodes`/`edges`. Only `undefined` restores the latest
legacy inputs; invalid defined providers fail visibly without falling back to those arrays.
Provider identity/revision is caller-owned; the canvas admits bounded records and scenes.

```ts
import "@aceshooting/lyra-ui/components/lr-flow-canvas.js";
import type { FlowCanvasSource } from
  "@aceshooting/lyra-ui/components/data/flow-canvas/flow-canvas.class.js";
import type { FlowNode, FlowEdge, FlowStructureSnapshot } from
  "@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js";
import type { LyraGraphSource, LyraGraphSourceQuery, LyraGraphSourceSummary,
  LyraGraphOverview, LyraSourceBounds } from
  "@aceshooting/lyra-ui/data-sources.js";
```

`FlowCanvasSource = LyraGraphSource<FlowNode, FlowEdge>`; the exact generic protocols are in
[shared source contracts](shared/events-and-types.md). It provides `revision`, `records`,
`scene(request)` and optional `overview(request)`. Source and records revisions must agree and
be a nonempty string or finite number. `records` supplies `query`, `lookup` and `locate` for the
complete logical workflow, separately from the bounded positioned scene.

**Global record navigation:** `sourcePage: number = 0` (`source-page`) is zero-based;
`sourcePageSize: number = 100` (`source-page-size`) normalizes to 1–500. Readonly
`sourceTotal: number | null` is the accepted current record-query total, or null while unavailable
or without a source. Size/query changes reset page zero; an out-of-range page receives at most
one corrective last-page request and publishes the accepted corrected page. The navigator offers
nodes or edges, full-source search, incident-edge scope with in/out/both direction, endpoint
links, page entry/previous/next and global Home/End/Up/Down record navigation.

The navigator sends `LyraGraphSourceQuery`, initially
`{ kind: 'nodes', search: '', centerKey: null, direction: 'both', nodeTypes: [] }`.
Search is bounded to 65,536 UTF-16 units; these controls query the whole source rather than
filtering a loaded scene/page. `records.query({ revision, locale, signal, page, pageSize, query })`
returns `{ rows, total, summary: { nodes, edges } }`. Each row is `{ key, order, value }`, where
`value` is `{ kind: 'node', value: FlowNode }` or `{ kind: 'edge', value: FlowEdge }` and its key is
exactly `node:<id>` or `edge:<id>` with a nonblank original ID. Safe nonnegative canonical `order`
and keys are unique within a page; rows exactly fill the requested in-bounds page. The required
summary gives complete global node/edge counts; unfiltered total equals the matching summary
count, filtered/incident total cannot exceed it, and accepted scenes must agree with those counts.
Totals and summary counts are safe nonnegative integers.
Groups/tags are not accepted on this route. Invalid/duplicate/oversized responses fail atomically,
without local filtering, sorting or silent trimming. Record pages copy only bounded display fields
and edge endpoints; they do not materialize complete node metadata.

`revealSourceKey(key: string): Promise<boolean>` accepts canonical `node:<id>`/`edge:<id>`, clears
search/incident scope for that kind, uses global `locate`, loads the matching page and attempts to
focus its navigator row. It resolves false for unset/invalid/missing, failed or superseded work. This is
separate from synchronous `focusNode(id, options)`, which moves camera/focus only for a node
already known in the current scene and does not fetch globally. Reveal does not promise a camera
move or a new scene. Reveal, controlled paging/selection and rebind emit no activation or selection
event; actual row activation retains `lr-node-activate`/`lr-edge-activate` and selection payloads
with original IDs. Scene absence does not prove global record absence.

**Bounded scene and source geometry:** `scene` receives viewport bounds, at most 32 selected/focus
reservation keys, `nodeLimit: 500` and `edgeLimit: 1000`. It returns at most those exact node/edge
entries, global `total`, explicit `coverage: 'complete' | 'neighborhood' | 'aggregate'` and non-null
`worldBounds`. Requests include revision/locale/signal, `mode: 'viewport'`, `centerKey: null`,
`bounds` and `includeKeys`. Nodes require finite explicit entry positions inside authoritative world
bounds; an optional value position must agree. Position/world rectangle endpoints stay within ±1,000,000,
with nonnegative world dimensions and finite endpoints. Scene edge keys/endpoints must match
value IDs and resolve to nodes in that scene. Missing positions never trigger local auto-layout.
The same revision must keep world bounds and global totals consistent. `source-coverage` reports
shown versus global counts, rather than suggesting every record is drawn.

Source scenes preserve FlowNode type, accessible label, disabled state, input/output handles and
data, plus FlowEdge handles, label and tone. They read own data descriptors; accessors reject.
`data` accepts plain records/arrays of strings, finite numbers, booleans and null, with shared
references/cycles preserved in detached frozen copies. Opaque leaves such as functions or Dates
reject. Each container/handle collection allows at most 10,000 entries, descendant container depth
is at most 16, and metadata/handle inspection shares a 50,000-field scene budget. Each admitted
text/key is at most 65,536 UTF-16 units, with a 2,000,000-unit cumulative text ceiling per scene
or record-page response. Overflow fails the complete response without clipping. JavaScript's
eager own-key enumeration can still allocate/work in proportion to one input object's key count
before that object's entry limit is rejected; these bounds do not make provider work constant.

Provider-derived retained data covers the current record page (at most 500 rows), current scene
(at most 500 nodes/1,000 edges) and bounded geometry/overview. Controlled selection keeps its existing first-10,000
candidate-ID bound and preserves offscene IDs instead of pruning them by scene membership;
scene reservations are at most 32 keys. This route does not materialize the full provider workflow
or cache historic pages.
Page/locate work, scene and overview each keep their fixed request lanes, with one physical call
per lane and only the latest queued intent. Ignored aborts keep physical permits until settlement;
providers should settle promptly. Paging does not reset the camera or refetch an unchanged scene;
pan/zoom/resize changes the viewport scene without restarting the record query. Accepted overview
is reused across viewport changes.

Source mode disables model editing: drag/nudge/connect/drop/delete and full-array layout/model
mutations, including gestures started before the source was assigned. It does not force public
`readonly`; pan/zoom/navigation and minimap controls remain usable when unlocked. Public
`readonly` still locks viewport interaction and makes viewport-mutating methods inert. Source
mode emits no model-edit/layout event presenting a bounded scene as the complete workflow.
`fit()` frames accepted global world bounds; legacy `fit()` frames admitted node geometry.

Companion snapshots add optional
`source: Readonly<{ coverage: 'complete' | 'neighborhood' | 'aggregate'; total: LyraGraphSourceSummary;
worldBounds: LyraSourceBounds; overview: LyraGraphOverview | null }>` when accepted source bounds
are available. Their node/edge arrays remain bounded exact scene geometry. `locked` still means
public `readonly`. Optional `overview({ revision, locale, signal, limit: 1024 })` must describe
those exact world bounds with at most 1,024 finite contained nonoverlapping bins whose counts sum
to the global node total. Null/unavailable/rejected overview is distinct from accepted empty
bins; the minimap never invents a global overview from scene nodes. The frozen accepted overview
identity is shared across viewport notifications.

Reassign even the same source or call a keyless `requestUpdate()` after revision/state changes.
Named local presentation paints reuse accepted provider data unless source revision/effective
locale changed. Replacement, unset, disconnect and adoption revoke old provider callbacks, gestures
and effects; superseding query/reveal revokes obsolete record controls. Reconnect captures current
input. Source navigator/status parts are `source-navigator`, `source-controls`, `source-status`, `source-coverage`,
`source-records` and `source-record`. Loading, successful empty, missing record, record failure
and scene failure remain distinct localized states with current guarded retry controls.

The following array admission, legacy auto-layout and complete-model snapshot rules apply with
`graphSource` unset; source behavior is described above.

**Properties:**

- `nodes: readonly FlowNode[] = []` (attribute: false) — each record has readonly `id`, optional
  `type`, `position`, `data`, `accessibleLabel`, `inputs`, `outputs`, and `disabled`. A missing
  `position` opts into layered layout. String `data.label` and `data.description` feed the
  declarative fallback card. Assignment takes a detached, deeply frozen snapshot of plain
  arrays/records, omitting blank ids and later duplicates first-wins before layout, focus,
  selection, gestures, companion snapshots, and events. At most the first 10,000 source nodes are
  retained, with finite nested depth/entry budgets; reassign `nodes` after changes. Replacing the
  model cancels node-drag and connect gestures whose ids belonged to the old model and silently
  prunes selected ids that no longer exist. `disabled` marks a node non-actionable: it keeps its
  position and card content but cannot be selected/activated by click or keyboard, roving-tabindex
  navigation (arrow keys, Home/End) steps past it, it cannot be dragged even while
  `nodes-draggable`, and it is excluded from starting or receiving a new connection while
  `connectable` (an edge already touching it is left alone). Omitted or `false` renders the node
  exactly as before this field existed.
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
- `readonly: boolean = false` (reflected) — freezes pan/zoom/drag/connect without touching the other
  gesture flags. Enabling it during a pan, node drag, pointer/keyboard connection, or palette drop
  cancels the active preview, rolls pan/node geometry back, clears transient state, and retires the
  window pointer listeners so a later release cannot commit. The legacy one-shot initial framing
  still applies to a `readonly` canvas, and waits until the canvas has a rendered size (a hidden tab or
  closed dialog is framed when it is first shown).
- `selectedNodeIds: readonly string[] = []`, `selectedEdgeIds: readonly string[] = []` (attribute:
  false) — seed or replace selection. Each assignment snapshots at most the first 10,000 ids,
  omits blank/later duplicates first-wins, and, with `graphSource` unset, prunes identities absent
  from the current canonical node/edge model. Reassign after changes. Activation and clear-selection gestures update frozen
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
  keys plus finite nested depth/entry budgets, and invalid statuses and records with unreadable `status`, `progress`, `durationMs` or `detail` fields are omitted independently, retaining valid neighbors. Reassign the
  record after changes. Usually supplied by `lr-flow-run-status`.
- `accessibleLabel: string | null = null` (attribute `aria-label`)
- `viewport` (readonly getter) — a frozen `{ x, y, zoom }` snapshot

**Methods:** `setViewport({ x, y, zoom })`, `zoomIn()`, `zoomOut()`, `resetZoom()`,
`fit(options?: { padding?: number })` (frames legacy admitted nodes or source global world bounds),
`focusNode(id, options?: { zoom? })` (pans/zooms to one currently known node and moves roving focus
onto it), `toContentPoint(clientX, clientY)` (maps a
pointer position to content coordinates, RTL-aware), `registerCompanion(cb: (snapshot:
FlowStructureSnapshot) => void): () => void` — the subscription `lr-flow-minimap` uses to read
live node/edge/viewport geometry without this canvas ever importing the minimap.
`revealSourceKey(key: string): Promise<boolean>` provides the global record navigation described above.
All viewport-mutating methods, including `focusNode()`, are inert while `readonly`; coordinate mapping
and companion subscription remain available because neither mutates viewport or edit state.
Each companion observer receives its own deeply frozen `FlowStructureSnapshot`: readonly node and
edge geometry/status arrays (shared between observers and reused, by identity, across
viewport-only frames until the structure changes), viewport `{ x, y, zoom, width, height, minZoom, maxZoom }`, and the
effective `readonly` state (as the snapshot's `locked` key), `orientation`, `layerGap`, and `nodeGap`. Zoom bounds are finite, positive, and
sorted even when public inputs are invalid or reversed. Source snapshots additionally carry the
accepted `source` descriptor above; their scene arrays do not imply full-source coverage.

**Events:** `lr-node-activate` (`detail: { nodeId }`), `lr-edge-activate` (`detail: { edgeId,
sourceNodeId, targetNodeId, source, target }`, both endpoint-name pairs are supplied),
`lr-selection-change` (`detail: { selectedNodeIds, selectedEdgeIds }`), `lr-node-move` (`detail: { nodeId,
position, previous }`), `lr-connect` (`detail: { source, target, sourceHandle, targetHandle }`),
`lr-node-add` (`detail: { type, position }`, from a palette drop), `lr-selection-delete`
(`detail: { nodeIds, edgeIds }`), `lr-viewport-change` (`detail: { x, y, zoom }`),
`lr-layout-change` (`detail: { positions, truncated }`, fired after an auto-layout pass places
previously unpositioned nodes). Every detail and nested coordinate/array is readonly and frozen.

**Slots:** default (consumer-authored cards matched by `node-id` and assigned to generated
`node-{id}` slots), `top-start`, `top-end`, `bottom-start`, `bottom-end`. Each rendered node has a
declarative shadow-DOM fallback card, so SSR and hydration do not depend on imperative light-DOM
card creation. An authored card replaces only its matching fallback; unmatched cards are unslotted
with a warning. Opposite-side companion slots share wrapping rails in narrow allocations.

**CSS parts:** `base`, `viewport`, `background`, `edges`, `edge`, `edge-label`, `edge-hit-area`,
`arrowhead`, `stub`
(a dangling-edge stub line), `connection-line` (in-progress connect gesture), `node`, `empty`,
`node-control` (the native per-node roving/activation control), `live-region`, `edge-list` (a
visually hidden list only for dangling/unrenderable edges), `layout-limit` (a visible notice whose
announcement uses the shared light-DOM polite sink), `input-limit` (node/edge or metadata
admission notice), `overlay-rail`, and the
fallback-card parts `node-card`, `node-card-base`, `node-card-surface`, `node-card-header`,
`node-card-heading`, `node-card-status`, `node-card-progress`, `node-card-body`, `node-card-toolbar`,
`node-card-handle`, `node-card-handle-input`, and `node-card-handle-output`. A node whose `type`
normalizes to a safe part token also exposes `node-type-{value}`. A selected node wrapper carries
`data-selected`; its hidden `node-control` exposes the state as `aria-pressed`.

With `graphSource` set, additional CSS parts are `source-navigator` (complete-source record navigation), `source-controls`
(query and page controls), `source-records` (the bounded current page), `source-record` (one record
with incident-edge or endpoint actions), `source-status` (record/scene loading, failure and count
text), and `source-coverage` (accepted scene coverage relative to complete node/edge totals).

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
`--lr-flow-canvas-connection-line-color` (default `var(--lr-color-brand)`) colors
`[part="connection-line"]`, the in-progress ghost path drawn while dragging a new connection from a
node's output handle, independent of a finished edge's own `-edge-*-color` tone above.
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
- Re-assigning the identical array or record to `nodes`, `edges`, `selectedNodeIds`,
  `selectedEdgeIds` or `decorations` is a no-op, so a parent re-render never cancels a drag or
  connection, re-runs layout, or resets selection. Assign a new array/record to change it.
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
- `--lr-flow-canvas-node-disabled-opacity` — Opacity of a node whose `FlowNode` entry sets
  `disabled`. Default: `var(--lr-opacity-disabled)`.
- `--lr-flow-canvas-node-fallback-inline-size` / `--lr-flow-canvas-node-fallback-block-size` — card
  size assumed for layout and fitting before a node is measured. Defaults:
  `calc(var(--lr-size-10rem) + var(--lr-size-1rem))` / `var(--lr-size-4rem)`.

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
- `headingLevel: LyraHeadingLevel = 'none'` (attribute `heading-level`) — semantic level of the
  visible `heading`. `'none'` (the default) keeps it plain text, as cards inside a canvas usually
  are; `'1'`–`'6'` expose `[part="heading"]` as `role="heading"` at that `aria-level`, for a
  standalone card in a document outline. Invalid untyped values use level 3; nothing is exposed
  while `heading` is empty
- `status: 'pending' | 'running' | 'success' | 'error' | 'denied' | null = null` (reflected)
- `progress: number | null = null` — renders a determinate `[part="progress"]` bar when set
- `statusDetail: string = ''` (attribute `status-detail`) — appended to the status line
- `durationMs: number | null = null` (attribute `duration-ms`) — formatted into the status line
- `selected: boolean = false` (reflected)
- `size?: LyraSize` (reflected, unset by default) — density on the library's one size ladder,
  `'2xs'|'xs'|'s'|'m'|'l'|'xl'` or `'small'|'medium'|'large'`. `s` and the steps below it select the
  compact density: tighter card padding, row gap, and header icon-to-heading gap for dense canvases
  and palette previews; the border, background, shadow and the `selected`/`status="running"`
  treatments all stay. `m` and above keep the full padding, and leaving it unset renders exactly as
  before. An unsupported value normalizes to unset and removes the attribute.
- `inputs: readonly FlowHandle[] = [{ id: 'in' }]`, `outputs: readonly FlowHandle[] = [{ id: 'out'
}]` (attribute: false) — detached, frozen snapshots of at most the first 10,000 readonly
  `{ id, label? }` handles; blank ids and later duplicates are omitted first-valid/first-wins
  (a record rejected for an unreadable optional label does not reserve its ID);
  reassign a collection after changes
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected) — which physical edge handles
  render on; mirrors the adopting canvas's own `orientation`

**Events:** none — purely presentational, activation/drag/connect all live on `lr-flow-canvas`.

**Slots:** default (body content), `start` (leading header glyph; `icon` is the deprecated legacy
slot), `header` (replaces the built-in
heading row entirely), `toolbar` (action row at the block-end edge; revealed by hover/focus on
hover-capable devices and always visible with a coarse pointer or no hover; it also stays revealed
while an `lr-dropdown`, `lr-popover`, `lr-context-menu` or picker (`lr-select`, `lr-combobox`,
`lr-color-picker`, `lr-date-input`, `lr-time-input`, `lr-export-button`) opened from it is open,
because that overlay sits in the browser top layer, where Chromium and WebKit stop matching
`:hover`/`:focus-within` on the node).

**CSS parts:** `base` (the row wrapping the input handles, the card and the output handles — it
carries no card chrome of its own), `card` (the bordered, filled node card), `header`, `icon`,
`heading`, `status` (never color-only — always paired with text), `progress`, `body`, `toolbar`,
`handle` (every handle dot), `handle-input`, `handle-output`.

**Themeable custom properties:** `--lr-flow-node-min-inline-size` (default `11rem`),
`--lr-flow-node-compact-padding` (default `var(--lr-space-xs)`) and `--lr-flow-node-compact-gap`
(default `var(--lr-space-2xs)`) — `[part="card"]`'s padding and row gap at the compact density
(`size="s"` and below); `--lr-flow-node-compact-header-gap` (default `var(--lr-space-2xs)`) —
`[part="header"]`'s own icon-to-heading gap at the compact density — and
`--lr-flow-node-selected-outline-color` (default `var(--lr-color-brand)`) — the card's outline color
while `selected`. Like the other state-scoped custom properties here, it is an inline `var()`
fallback at its point of use rather than a `:host` declaration, so it can be set on the element _or any
ancestor_; overriding the selection color otherwise means
hijacking the library-wide `--lr-color-brand` token and repainting everything else that reads it.
Inside `lr-flow-canvas` this card ring is off: the canvas draws the one selection ring, colored by
`--lr-flow-canvas-node-selected-outline-color`.
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

For legacy snapshots, the minimap retains every admitted node. Its node overview and moving viewport use
separate SVG layers, so panning keeps the overview tree unchanged. Existing `node`, `viewport`
and `viewport-hit-area` parts remain available.

**Source companion:** when `FlowStructureSnapshot.source` is present, the minimap frames its
accepted global `worldBounds`, including negative origins and positive fractional extents; it
never infers source extent from the bounded scene-node array. Every positive axis keeps its exact
source dimension without legacy padding or a one-unit minimum. Only an exactly zero-width or
zero-height axis receives a centered one-unit SVG display extent; source coordinates are unchanged.

Only accepted `source.overview.bins` render, under `aggregate-bin`, at most 1,024 rectangles.
They describe the complete node population within the authoritative world bounds; scene-node
rectangles are not painted as a substitute global overview. The canvas owns overview validation
and freezing, and the minimap adds no provider query or second normalization. A missing/rejected
`overview: null` shows localized `source-unavailable` (default “Workflow overview unavailable”)
while world framing and unlocked viewport controls remain usable. Accepted empty bins are a
successful empty overview and do not show the unavailable state.

The immutable overview layer is reused by identity across viewport-only snapshots. Map clicks,
viewport drag, wheel zoom and physical arrow keys use the same exact source-world inverse
mapping, including RTL and zero-axis display fallback. A change in world coordinate values
cancels an active drag; cloned equal bounds do not. Old subscriptions/detached controls cannot
move a later canvas binding. `locked` continues to reflect public canvas `readonly`; the source
editing gate alone does not disable minimap navigation. Removing the provider restores the
legacy node-geometry overview.

**Properties:**

- `for: string = ''` — id of the target `lr-flow-canvas`; when empty, the nearest ancestor canvas
  is used (the slotted-into-a-corner-slot case, the primary wiring)
- `label: string = ''` — accessible name for the map region. A host `aria-label` takes precedence,
  followed by `label`, then the localized default
- `frame: 'card' | 'plain' = 'card'` (reflected) — container treatment, on the library-wide `frame`
  vocabulary. `'plain'` removes `[part="base"]`'s border, background and corner radius, for a
  minimap placed in a host panel or toolbar that already draws its own surface, so the frame isn't
  doubled. The map's own hover/click affordances and the viewport rect stay either way — only the
  outer `base` decoration goes. Mirrors `lr-flow-controls`'/`lr-flow-run-status`'s identical `frame`.

**Events:** none.

**Slots:** none.

**CSS parts:** `base` (the root wrapper; drops its border, background and corner radius under
`frame="plain"`), `map` (the scaled SVG), `node` (one rect per legacy node),
`aggregate-bin` (one accepted source overview rectangle), `source-unavailable` (missing source
overview message), `viewport` (the
exact visible view rectangle), `viewport-hit-area` (the transparent draggable/focusable target),
`instructions` (visually hidden keyboard help), and `live-region` (the `aria-hidden` mirror of the
latest viewport-change text).

**Themeable custom properties:** `--lr-flow-minimap-inline-size` (default `12rem`),
`--lr-flow-minimap-block-size` (default `8rem`), plus the shared
`--lr-flow-status-color` and the explicit palette hooks
`--lr-flow-status-pending-color`, `--lr-flow-status-running-color`,
`--lr-flow-status-success-color`, `--lr-flow-status-error-color`, and
`--lr-flow-status-denied-color`.
`--lr-flow-minimap-viewport-color` (default `var(--lr-color-brand)`) colors `[part="viewport"]`'s
fill (mixed 15% into transparent) and stroke, independent of every per-status node fill above.
`--lr-flow-minimap-viewport-min-size` (default `var(--lr-icon-button-size)`, normally 36px) floors
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
  from the complete admitted legacy geometry or the accepted source overview/world bounds the
  canvas last pushed. Source scenes remain bounded and never substitute for a global overview.
- A readonly canvas snapshot makes the hit area unfocusable and inert: no pointer, click, wheel, or keyboard
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
- `withoutLock: boolean = false` (attribute `without-lock`) — omits the lock/unlock toggle button.

- `frame: 'card' | 'plain' = 'card'` (reflected) — container treatment, on the library-wide `frame`
  vocabulary. `'plain'` drops `[part="base"]`'s border, background, padding, corner radius and its
  floating-surface `box-shadow`, for a cluster placed in a host toolbar or panel that already draws
  its own surface. There is deliberately no `compact`: the padding is already the smallest spacing
  step and the only remaining room is the buttons' `--lr-icon-button-size` hit-area floor. The
  canonical type is `LyraFrame`; the former component-local appearance alias is removed.

**Events:** `lr-readonly-change` (`detail: { readonly }`) after the lock button toggles the canvas's
`readonly`; it bubbles through a canvas the cluster is slotted into, so a host that binds
`.readonly` can keep its own state in sync. The zoom/fit buttons call the canvas's own `zoomIn()`/
`zoomOut()`/`fit()`.

**Slots:** default — extra host buttons appended to the cluster, styled by the same group. A slotted
`<button>` is matched by a `::slotted(button)` rule that gives it the built-in controls' treatment:
the shared `--lr-icon-button-size` hit-area floor, the chrome-less transparent box, and the same
hover/press/disabled/focus-visible affordances. Only the slotted element itself is styled — markup
the consumer nests inside it is left alone — so an icon or label child keeps whatever the host
page gives it.

**CSS parts:** `base` (the `role="group"` wrapper; drops its floating-surface chrome under
`frame="plain"`), `zoom-in`, `zoom-out`, `fit`, `lock` (omitted while `without-lock` is set).

**Themeable custom properties:** `--lr-flow-controls-lock-active-color` (default
`var(--lr-color-brand)`, pressed lock-button foreground), plus shared tokens —
`--lr-icon-button-size` (each button's minimum hit area, unchanged by `frame`), `--lr-shadow-m`,
`--lr-color-surface`, `--lr-color-border-subtle`, `--lr-radius`, `--lr-space-2xs`,
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
  canvas; invalid statuses and records with unreadable `status`, `progress`, `durationMs` or `detail` fields are omitted independently, retaining valid neighbors, and consumers reassign the record after changes
- `withoutSummary: boolean = false` (attribute `without-summary`) — omits the "{done} of {total}
  steps complete" strip, keeping only the decoration push.
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
document-level region rather than `::part(live-region)`. Each step is named like the canvas names
it (`accessibleLabel`, then `data.label`, then the id); more than five simultaneous step changes are
announced as the run summary instead of a list.

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
number; tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'; color?: string; disabled?:
boolean }[]`. `value` is an _absolute_
  quantity measured against `total`, never a pre-computed percentage.
  `color`, when supplied, is a sanitized arbitrary CSS color that takes precedence over `tone`.
  `disabled`, when set, marks that band non-actionable while `interactive` is set: its control
  renders genuinely disabled (no tab stop, no hover/press affordance) and activating it emits no
  `lr-segment-activate-request`.
- `total: number = 0` — the full capacity segments are measured against (e.g. a model's context
  window size).
- `shape: ContextMeterShape = 'bar'` (`'bar' | 'ring'`, reflected) — the v9 geometry name;
  `variant` remains reserved for semantic tone across Lyra.
- `label: string = ''` — overall accessible caption, e.g. `"128K context window"`. Also rendered
  visually (`[part="label"]`) when set.
- `withLegend: boolean = false` (attribute `with-legend`, reflected) — renders a static
  `[part="legend"]` key below the meter, one swatch/label pair per `segments` entry, each swatch
  painted from that segment's resolved `color`/`tone`. Without it a segment's own label is exposed
  only through a hover `title` (desktop-only, undiscoverable) and the visually-hidden breakdown
  list, so a meter split across more than two or three categories reads as unlabeled colour to a
  sighted user. Non-interactive: it toggles nothing and emits nothing, mirroring
  `lr-sequence-strip`'s `withLegend` rather than the interactive `lr-graph-legend`. The whole
  subtree is `aria-hidden`, since `segment-list` already exposes the same names. Under
  `shape="ring"` the host stops being a fixed square so the key flows below the ring instead of
  being clipped.
- `legendDisplay: ContextMeterLegendDisplay = 'label'` (attribute `legend-display`) — what each
  legend row shows beside its swatch: `'label'` (the default, byte-identical to before this
  property existed), `'label-value'`, `'label-percent'` or `'label-value-percent'`, adding
  `[part="legend-value"]` and `[part="legend-percent"]` spans. The share is the same clamped ratio
  the bar or ring paints, so the key can never disagree with the band it stands for, and both
  numbers are formatted through `effectiveLocale`. Combinable rather than mutually exclusive,
  unlike `lr-chart`'s `label | value | percentage` legend vocabulary, because a part-to-whole key is
  ordinarily read as "count AND share". A foreign attribute value normalizes to `'label'`. No
  effect while `withLegend` is unset.
- `interactive: boolean = false` (reflected) — opt-in filter mode. Every band, and every legend row,
  becomes a real `<button>` emitting the cancelable `lr-segment-activate-request`; the ring's arcs carry
  `role="button"` with their own tab stop and Enter/Space handling, since an SVG shape cannot be a
  native button. In this mode, and only in this mode, `[part="legend"]` drops `aria-hidden` so the
  rows are reachable, and the visually-hidden `[part="segment-list"]` steps aside because the
  buttons already expose the same label/count pairs with their pressed state attached. A band's
  inline size IS its share, so a small band is a small pointer target: pair `interactive` with
  `withLegend` where that matters, since the legend row is the same action at full row height. The
  ring's arcs share one bounding box, so a focused arc reports itself by dimming as well as by the
  shared focus outline — an outline alone cannot say *which* arc.
- `selectedIndices: readonly number[] = []` (attribute: false) — indexes rendered as
  `aria-pressed="true"` plus a `segment-selected`/`legend-item-selected` part token on both the band
  and its legend row; every other control renders `aria-pressed="false"`. Meaningful only while
  `interactive` is set. Uncontrolled by default: an activation nobody vetoes toggles the index here
  itself. `preventDefault()` on `lr-segment-activate-request` suppresses that write, which is how a consumer
  that owns the selection takes control. Without a veto, the default toggle uses the latest selection,
  including any synchronous host assignment. A
  non-integer or out-of-range entry selects nothing rather than throwing.

Accessible summaries, segment tooltips, and ring titles format normalized nonnegative quantities
using `effectiveLocale` (up to three fraction digits, more below one, so a small quantity never reads
0). A host `aria-label`, else `label`, names the nested meter owner, which then speaks the generated
aggregate summary as its `aria-valuetext`.

**Events:** `lr-segment-activate-request` — a band or its legend row was activated while `interactive` is
set. `detail: { index: number; label: string; value: number }`, bubbling and composed like every
library event. **Cancelable, and a real veto point**: the default action is this component toggling
`index` in its own `selectedIndices`, so `preventDefault()` keeps the current selection and hands
that state entirely to the consumer. Never emitted in the default presentational mode. Because the
event dispatches synchronously *before* the write, a listener reading `selectedIndices` inside its
own handler sees the pre-activation value. Reentrant activation during dispatch is ignored.
Replacing the segment collection, disabling interaction, or disconnecting during dispatch cancels
the default write.

**Slots:** none.

**CSS parts:** `base` (a `<div>` for `bar`, an `<svg>` for `ring`), `semantic` (the visually hidden
meter semantics), `track` (the unfilled/empty capacity), `segment` (one occupied segment — carries
`data-tone` and, for custom colors, `--lr-context-meter-segment-color`), `segment-list` (the hidden
category list), `segment-item` (one hidden category/value entry), `label`, and — only under
`withLegend` — `legend`, `legend-item`, `legend-swatch` (carrying the same `data-tone` and custom
color hook as `segment`) and `legend-label`, plus `legend-value` and `legend-percent` under the
matching `legendDisplay` settings. While `interactive` is set, `segment` and `legend-item` are
`<button>`s (a `role="button"` arc under `shape="ring"`) and a selected one carries a second part
token — `segment-selected` / `legend-item-selected` — because nothing but a pseudo-class may follow
`::part()`, so the state has to live in the part name. Two further state tokens join them, and they
compose: `segment-empty` / `legend-item-empty` on a band whose `value` is 0, and
`segment-disabled` / `legend-item-disabled` on a band whose `segments` entry sets `disabled`. The
empty pair is DERIVED and carries no built-in treatment — it is the hook for your own "nothing in
this bucket" styling, and a zero band stays actionable. The disabled pair is DECLARED: that control
renders genuinely disabled (no tab stop, no hover or press affordance) and activating it emits no
`lr-segment-activate-request`. Inertness is never inferred from a zero value, because a zero band is
legitimately clickable in a budget meter

**Themeable custom properties:** `--lr-context-meter-segment-color` is set per segment when its
`color` field is supplied, and is read by both `segment` and its matching `legend-swatch` so the
two can never disagree. `--lr-context-meter-legend-swatch-size` (default `var(--lr-size-0-625rem)`)
sizes a legend chip on both axes. The `bar`-shape track is independently retunable:
`--lr-context-meter-track-size` (default `var(--lr-size-0-5rem)`) is its block size (and so the
block size of its filled segments), `--lr-context-meter-track-radius` (default
`calc(var(--lr-radius) * 0.5)`) its corner radius, `--lr-context-meter-track-bg` (default
`color-mix(in srgb, var(--lr-color-border) 30%, transparent)`) the colour of its unfilled
remainder (the ring track's stroke too), and `--lr-context-meter-segment-seam-color` (default `var(--lr-color-surface)`) the
hairline seam painted between adjacent segments.
`--lr-context-meter-selected-ring-color` (default `var(--lr-color-text)`) and
`--lr-context-meter-selected-ring-width` (default `var(--lr-border-width-thick)`) paint the inset
ring marking a selected `bar`-shape band or legend row. It is drawn inward, because the track clips
its own overflow and an outward ring would be invisible, and it is a ring rather than an outline so
that it composes with the hover, press and focus outlines instead of being replaced by them — a
selected band stays visibly selected exactly while it is being pointed at or focused, and its focus
ring stays intact. `--lr-context-meter-selected-arc-stroke` (default `16`, in this component's
`0 0 100 100` viewBox units) is the stroke width of a selected `ring`-shape arc: every arc shares
one bounding box, so a selected arc reports itself by thickening in place rather than by an outline
that would trace the whole ring identically for every selection.
`--lr-context-meter-disabled-opacity` (default `var(--lr-opacity-disabled)`) dims a band or legend row whose entry sets
`disabled`; the band keeps its own colour, since that colour is the datum. Each `data-tone` band
color is independently retintable, scoped to just this component rather than the shared token
every other component also reads: `--lr-context-meter-tone-brand-bg` (default
`var(--lr-color-brand)`), `--lr-context-meter-tone-success-bg` (default `var(--lr-color-success)`),
`--lr-context-meter-tone-warning-bg` (default `var(--lr-color-warning)`) and
`--lr-context-meter-tone-danger-bg` (default `var(--lr-color-danger)`) — each read by the bar
segment, its legend swatch, and (as the `stroke`) the ring shape's arc, so all three surfaces for a
tone stay in sync. Otherwise the component consumes shared tokens
`--lr-space-xs`, `--lr-color-text-quiet`, `--lr-font`, `--lr-radius`, `--lr-color-border`,
`--lr-transition-base`.

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
`role="group"` and omits numeric meter attributes. Its accessible name is the host `aria-label`, else
`label`, with the generated summary as `aria-valuetext`; with neither set, the summary is the name. A separate
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
(a 40-radius circle centered at 50,50) has its RADIUS/CENTER match `lr-gauge`'s own radial numbers,
so both components' rings sit on the same circle within their viewBox. The stroke does not match:
at 12px it is intentionally heavier than `lr-gauge`'s 10px, since tightly-packed multi-tone arcs
need more width to stay visually distinct than a gauge's single fill arc.

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

Early ISO dates such as `0001`, `0099`, and `0100` retain their authored local year in the month
grid and month navigation. Valid colored agenda actions preserve their foreground/background pairing
through hover and press, with the existing state tokens remaining overridable. Arbitrary caller
colors still require the caller to choose an accessible contrast pair.

**Properties:**

- `events: CalendarEvent[] = []` (attribute: false) — `{ readonly id?, readonly date, readonly
title, readonly color?, readonly data? }`; `date` accepts an ISO `YYYY-MM-DD` string, finite epoch
  milliseconds, or a valid `Date`, then normalizes to the displayed ISO day. Invalid date/title rows
  are omitted; `lr-event-select.detail.event` remains the original admitted object. `color` is
  sanitized before use as the marker background. The former ignored `start`/`end` fields are not
  part of the contract; use one event per displayed date. Input retains the first 10,000 events
  while preserving event identity. A localized `limit` part discloses omitted input in month and
  agenda views; provide a smaller date range to include other events. Changed loss notices are
  announced politely after mount. Assign a new array to update; mutating an array and assigning it again does not.
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
- `accessibleLabel: string = ''` (attribute `aria-label`) — names the nested calendar section,
  whether authored as the host attribute or set programmatically; unset, the section keeps the
  localized purpose name

At most 4 events render as `event` buttons inside a single month-view day cell, and at most 500
events render as `agenda-event` buttons in agenda view; either ceiling past that count renders a
localized `event-limit`/`agenda-limit` "+N more" notice rather than mounting an unbounded number of
buttons.

For a large event archive, let the host query the displayed month and replace `events` with a
bounded result. Listen for `lr-view-change.detail.viewDate` from the previous/next buttons and
out-of-grid keyboard moves. Assigning `viewDate` programmatically does not emit that event, so the
host must also call its loader for a programmatic jump. The host owns request cancellation and
obsolete-result checks: abort superseded month/page fetches and ignore results whose date window
or request generation is no longer current.

Keep each assigned window within the 10,000-event input bound and treat the four-per-day or
500-entry agenda as previews when the selected period is dense. Show an explicit host total and
preview count for server-omitted events; native calendar overflow counts only admitted events.
For complete dense-event traversal, compose a configured `lr-table` with
`paginationMode = 'server'`, `pageSize`, `totalItems`, controlled one-based `page`, and the current
page's `rows`. Set `totalItems` to the full event count for the selected month or date. Handle
`lr-page-change.detail.page` by querying that page, then assigning `page` and `rows`; use stable
`rowKey` identities across pages.
`lr-row-activate.detail.row` identifies an event reached through the table, while
`lr-event-select.detail.event` identifies a calendar preview action. Complete traversal comes
from the paged table; the calendar remains a bounded month/day preview.

**Keyboard:** the month grid is a fixed 6×7 matrix (leading/trailing days of adjacent months fill it
out) with one roving tab stop — `focusedDate`, else `value`, else today, else the first rendered day.
Arrows move by 1 day (Left/Right swapped under RTL) or 7, PageUp/PageDown by one month (clamping
the day), Home/End to the month's first/last day; stepping past the rendered grid rolls
`viewDate` to the target's month and emits `lr-view-change`. Enter/Space select.

**Events:** `lr-date-select` (`detail: { date }`), `lr-event-select` (`detail: { event }`),
`lr-view-change` (`detail: { viewDate }`, from the prev/next buttons and out-of-grid arrow moves).

**Slots:** none.

**CSS parts:** `header` and `navigation` are aliases on the header wrapper; `nav` is shared by both
month-navigation buttons; `previous-button` and `next-button` identify each direct button;
`nav-glyph` is the chevron (`scaleX(-1)`-mirrored under RTL); `title`, `weekdays`, `weekday`,
`grid`, `week` (`display: contents`), `day`, `date`, `event` (a month-view marker), `event-limit`
(localized "+N more" notice shown in a day cell whose events exceed the 4-event per-cell render
ceiling), `agenda`, `agenda-event`, `agenda-limit` (localized "+N more" notice shown in agenda
view when the visible month's events exceed the 500-event render ceiling), `limit` (input-admission
notice), and `empty` (the agenda
view's localized "no events" message).

**Themeable custom properties:** `--lr-calendar-day-min-block-size` (default `var(--lr-size-6rem)`)
and `--lr-calendar-day-min-block-size-narrow` (default `var(--lr-size-4rem)`, applied at container inline-size
≤ 28rem); `--lr-calendar-day-selected-bg` (default `var(--lr-color-brand-quiet)`) for a selected
day's background; `--lr-calendar-day-outside-color` (default `var(--lr-color-text-quiet)`) and
`--lr-calendar-day-outside-bg` (default `var(--lr-color-surface)`) for adjacent-month days; and
`--lr-calendar-day-today-outline-color` (default `var(--lr-color-brand)`) for today's outline.
`--lr-calendar-nav-hover-bg`, `--lr-calendar-nav-active-bg`, `--lr-calendar-day-hover-bg`,
`--lr-calendar-day-active-bg`, `--lr-calendar-agenda-event-hover-bg`, and
`--lr-calendar-agenda-event-active-bg` independently theme navigation, day, and agenda-event
hover/pressed states through inheritable inline fallbacks.
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

Every assigned item remains mounted; the timeline does not window large collections. Flow mode
leaves untouched items' positioning styles alone. Time mode reuses item geometry between targeted
resize notifications; allocation, timestamp placement, structural and orientation changes can
remeasure the complete mounted list.

Horizontal time layouts using `collision="overlap"` or `collision="stack"` allocate their block size
from the actual item content and lane offsets. The height follows content growth, shrinkage, and
changes in lane count. `--lr-timeline-time-extent` still controls only the main-axis distance, and
horizontal scrolling retains clipping on the cross axis. Cluster mode keeps its existing sizing
behavior. Vertical time layouts keep the `--lr-timeline-time-extent` axis and reserve room after it
for the latest item, which sits at the axis end, so it never overlaps the content that follows.

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
  items: readonly LyraTimelineItem[];
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
(default `var(--lr-color-border-subtle)`), `--lr-timeline-marker-color` (default
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

**Provider hierarchy:** `treeSource: FileTreeSource | undefined` (attribute: false)
uses `LyraHierarchySource<FileTreeNode, LyraHierarchyQuery>` from
`@aceshooting/lyra-ui/data-sources.js`. A defined source takes precedence over `nodes`, preserving
its identity; invalid defined input shows a localized source error. Setting `undefined` restores
the current legacy `nodes` input. Reassign even the same source, or call a keyless
`requestUpdate()`, after revision/provider-state changes. Locale, reconnect and adoption refresh
the source; unrelated named display updates do not.

The provider projects the complete visible preorder using the same `project` actions, fixed empty
query and required direct key lookup described for `lr-tree` above. `total` includes collapsed
nodes and `rows.count` counts all visible logical rows. Those counts can describe a million-node
host hierarchy while at most 301 rows mount and at most 401 rows are retained (four 100-row pages
and one focused row). Each range read requests at most 100 rows, with at most two physically
pending reads. No full path/ancestor index or nested subtree copy is built. The provider owns
storage, global uniqueness, selection/expansion snapshots and cancellation; source replacement
and obsolete replies cannot commit old rows or focus.

Global row keys must exactly equal `value.path`: nonblank strings of at most 65,536 UTF-16 units,
preserved verbatim without filesystem resolution. Paths are identities, not permission to read or
open a file; the host authorizes any resulting operation. Displayed `name`/`mimeType` use at most
65,536 aggregate text units per row; oversized or accessor-backed fields fail visibly. Source
events contain only bounded frozen displayed metadata, with no `children`. The provider's
`childCount` identifies branches even when `kind` is omitted; branches never emit file-open.
Nested `value.children` is ignored. Logical depth, sibling positions, bounded keyboard navigation,
localized loading/empty/error states and retry follow the source tree contract above. The legacy
snapshot limits below remain separate from this route; `maxNodes` does not raise its source window.

**Controlled source selection:** an accepted user selection updates `selectedPath` and emits
`lr-file-select`. Activating an already-selected leaf file also emits `lr-file-open`, provided the
same source/projection is still current after the selection listener returns. The provider owns
the authoritative selected flags. External `selectedPath` changes submit an item selection after
the initial projection, without synthetic user events or moving focus; clearing it deselects the
previously controlled key. The default `null` does not request a global clear. A current valid path
is reconciled again after source replacement, rebind or refresh. Invalid empty/blank/oversized
controlled paths are not forwarded. This adapter has no source search/copy controls.

With `treeSource` undefined, the following snapshot and lazy-directory route applies.

An unreadable optional field rejects only that file record; it cannot reserve the path against a
later valid occurrence. Valid siblings retain their source order within the existing depth and
inspected-position budgets.

**Properties:** `nodes: readonly FileTreeNode[] = []` (attribute: false; clone-owned/frozen,
cycle-safe snapshot omitting empty/blank paths and retaining the first successfully admitted occurrence of each path, bounded to
the first 10,000 inspected source positions across 64 descendant levels; reassign after changes;
rebinding the same array is a no-op). `maxNodes: number = 1000` (attribute `max-nodes`) sets the
composed tree's row budget, normalized to `1..10000`; unset or non-finite values restore 1,000.
The source budget remains 10,000 inspected positions. The composed `<lr-tree>` holds at most
`maxNodes` rows: when the
whole listing is larger, each collapsed directory is projected as a single lazy row whose children
load from the snapshot when it expands, so every top-level entry stays reachable;
`selectedPath: string | null = null` (attribute `selected-path`), and `label?: string` — an
accessible-name override for the internal `<lr-tree>`, where omission reads back `undefined` and falls
back to the localized default while an explicitly empty string renders as an empty label.
`additions`/`deletions` are normalized once to finite nonnegative integers before localized visible
and accessible diff summaries. A host `aria-label` wins by presence when naming the internal tree,
including an explicit empty string; removing it restores `label` or the localized fallback.
Derived rows are reused until their data, locale or limit changes; selecting a different path
updates only the affected ancestor paths. An explicit `requestUpdate()` refreshes derived content.

**Read-only getters:** `dataTruncated: boolean` — `true` when normalization omitted a malformed,
duplicate, cyclic, over-depth or over-budget entry, or when the directories currently expanded hold
more rows than the composed tree's configured row budget.
When source normalization reaches its 10,000-node cap, the host shows a localized `limit` part;
the composed tree shows its own notice when its configured valid-node cap is reached.

**Lazy directories:** a directory with `hasChildren: true` and no `children` uses `<lr-tree>`'s own
lazy lifecycle: expanding it shows the row's busy spinner (`aria-busy`), emits `lr-load-children`
once per expansion attempt, and expands when `setChildren()` (or a reassigned `nodes`) supplies its
children; an empty result ends the busy state without expanding. No placeholder row is rendered.

**Methods:** `setChildren(path, children)` supplies a lazily-loaded directory's children.
`revealPath(path)` expands every ancestor directory and scrolls the target row into view, resolving
`true` once found in legacy mode. In source mode it delegates to
`revealSourceKey(key: string): Promise<boolean>`, which requests a provider reveal and focuses its
current visible row; missing/invalid/obsolete requests resolve `false`. The provider must return a
valid `focusIndex` for successful reveal. `expandAll()` and `collapseAll()` forward to the underlying
`<lr-tree>` only in legacy mode and are no-ops in source mode. `setChildren()` updates the legacy
`nodes` input; it does not mutate the provider. Source branch toggles use `project(toggle)` rather
than `lr-load-children`.

**Events:** `lr-file-select` (frozen readonly `detail: { filePath, node }`, a row was activated),
`lr-file-open` (frozen readonly `detail: { filePath, node }`, Enter/click on an already-selected file
row), and `lr-load-children` (frozen readonly `detail: { filePath }`, a lazy unloaded directory
expanded, legacy mode only). Source select/open keep the same `{ filePath, node }` shape, with
`node` limited to the displayed record rather than a complete subtree. The composed tree's own
`lr-expand`, `lr-collapse`, `lr-after-*`, `lr-lazy-*` and
`lr-selection-change` events stay inside the component.

**CSS parts:** `base` — the root wrapper; `limit` — localized notice when the source listing
exceeds its 10,000-item snapshot.
Source mode retains `base` and adds `tree` on the semantic root, plus `source-list`, `source-row`,
`source-toggle` (branch and retry buttons), `source-label`, `source-status`, and `source-error`.
The root owns the accessible name/busy state, and each flat source row owns logical treeitem ARIA.

## `lr-env-list`

A masked key/value list for environment variables and secrets, with per-row reveal and copy.
Masking is presentational, not a security boundary: the real value sits in a DOM property
regardless of mask state. Names, revealed values, and localized action text wrap within narrow
allocations; the name track uses at most 40% of the available inline size.

**Properties:** `entries: readonly EnvEntry[] = []` (attribute: false; clone-owned/frozen snapshots
of at most the first 10,000 source entries; malformed records, blank names, and later duplicate
names are skipped first-wins before render, reveal state, copy actions, and events; reassign after
changes), `withoutReveal: boolean = false` (attribute `without-reveal`, reflected; omits every
secret entry's reveal toggle and re-masks any revealed entry), `withoutCopyButton: boolean = false`
(attribute `without-copy-button`, reflected; omits every entry's copy button), and
`label?: string`. An omitted label uses localized `envListLabel`; an explicit empty string remains
empty. A host `aria-label` wins by attribute presence, including when empty.

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
`var(--lr-color-brand)`) — the background and border color of a revealed entry's reveal button. The background is also the
base its hover/press mixes from. The button is named by its action ("Reveal {name}" / "Hide {name}")
and carries no `aria-pressed`, so its name never contradicts a pressed state.
Both are inline `var()` fallbacks at their point of use rather than `:host` declarations, so either
can be set on the element _or any ancestor_. They exist because Shadow Parts forbids an attribute
selector after `::part()`, so restyling the revealed state otherwise required overriding the
library-wide brand tokens.

## `lr-document-library`

Controlled searchable and filterable document inventory with versions, tags, owners, freshness,
sorting, and bulk selection. It composes the table's bounded 100-row default, so a large document
collection stays reachable through pagination without mounting an unbounded grid.

With `dataSource` unset, the tag facet displays the first 500 locale-sorted distinct tags. A localized `[part="limit"]`
note reports the omitted count. Search and a controlled `tagFilter` continue to match all admitted
document tags, including tags outside the facet window. Matching rows, sorting, and folded search
fields are reused when their inputs are unchanged; loading and selection updates reuse the current
row projection. A custom `filter` that depends on mutable closure state can be refreshed with a
keyless `requestUpdate()`. Publish document edits with a new outer array as described below.

Own `tags: undefined` is treated like omitted tags; malformed tag arrays and entries remain invalid.
Removing `search-term` clears search filtering without rewriting its `null` property readback; an
explicitly empty query also clears filtering and a later query applies normally.

**9.0 migration:** `lr-filter-change.detail.text` is now `searchTerm`, backed by the public
`searchTerm`/`search-term` axis. Replace `sortDirection: 'ascending'|'descending'` with
`sortDir: 'asc'|'desc'`; document sorting now uses the same cancelable `lr-sort-request` followed
by accepted `lr-sort` transaction and `{ phase, sortKey, sortDir }` vocabulary as `lr-table`.

**Properties:** clone-owned frozen `documents: readonly LibraryDocument[] = []` (at most the first
10,000 source documents and 10,000 tags per document are retained; document records, nested tags,
and dates are snapshotted on assignment; malformed records (including missing/non-string names or
non-string tag entries), blank ids, and later duplicate ids are omitted first-wins before filters,
counts, selection, rows, and events; reads return one stable detached snapshot per assignment, so
`Date` mutators cannot reach retained state; reassign a new array after changes; re-assigning the same
array, as a re-rendering parent does, is no change), `filter`, `label`, `loading`,
clone-owned frozen `selectedDocumentIds: readonly string[] = []` (at most 10,000 unique ids; reassign after
changes), public controlled `searchTerm: string = ''`
(`search-term`), `sortKey: LibraryDocumentSortKey = 'name'` (`sort-key`), canonical
`sortDir: 'asc'|'desc' = 'asc'` (`sort-dir`), and clone-owned frozen
`tagFilter: readonly string[] = []` (at most 10,000 unique tags; reassign after changes).
`size?: LyraSize` (reflected) — opt-in density tier forwarded to BOTH composed toolbar controls, the
search `lr-input` and the tag-filter `lr-combobox`, on the library's one six-step ladder
(`2xs`/`xs`/`s`/`m`/`l`/`xl`, or `small`/`medium`/`large`). Forwarding is the only way to reach them:
each resolves its tier inside its own shadow root, so no custom property on this component would get
there. The two always stay on the same tier as each other, so the toolbar row never goes ragged.
With no `size` both keep their own `m` default; an unsupported value normalizes to the omitted state
and removes the attribute.
`error: boolean = false` (reflected) — reports a failed document-list load. Forwarded to the nested
`lr-table`, whose own built-in failed-load state (with retry button) replaces the document rows
while it's set; `error` beats the empty state, matching `lr-table`'s own precedence.
`errorHeading?: string` (`error-heading`) — failed-load heading override, forwarded to the nested
table. Omitted localizes the table's own `tableLoadFailed` default.
`errorDescription: string = ''` (`error-description`) — failed-load supporting copy, forwarded to
the nested table.

The provider query type is `DocumentLibrarySourceQuery { readonly searchTerm: string;
readonly tagFilter: readonly string[]; readonly sortKey: LibraryDocumentSortKey;
readonly sortDir: 'asc' | 'desc'; readonly filter: LyraDocumentLibrary['filter'] }`.

**Full-source paging:** Set property-only `dataSource: DocumentLibrarySource | undefined`
(default `undefined`) to browse a host-owned logical collection. `DocumentLibrarySource` is
`LyraPageSource<LibraryDocument, DocumentLibrarySourceQuery>`; both types are exported by the
component entry and package root. The query contains `searchTerm`, readonly `tagFilter`,
`sortKey`, `sortDir`, and the current `filter` callback. The provider applies AND-tag filtering
and ordering to the complete collection. A custom `filter` replaces the default text predicate;
they are not applied cumulatively. The query forwards `searchTerm` verbatim (null becomes empty).
The provider supplies the callback's trimmed, request-locale-folded text argument and owns any
remote translation of that callback. It must not filter only the returned page. Source-mode
`tagFilter` accepts at most 500 keys; its legacy 10,000-key allowance applies only without a source.

`sourcePage: number = 0` (`source-page`) is zero-based; `sourcePageSize: number = 100`
(`source-page-size`) normalizes to 1–500. Readonly `sourceTotal: number | null` is the exact
accepted query total, or `null` before a current authoritative result. The nested table converts
to its one-based page convention, shows unknown-total/loading/error states, and delegates sorting
to the source. Query or page-size changes reset to source page zero. An out-of-range page receives
one corrective last-page request. No complete array, row index or full-source search corpus is
built by the component.

The provider implements the shared `query`, global `lookup` and `locate` contract from
`@aceshooting/lyra-ui/data-sources.js`. Each accepted page must include `tags`, even when its
catalogue is empty: bounded `{ values, total, unavailableSelected }` facets describe the global
catalogue and supplied labels. Missing rows on the current page never prove a filter is absent;
only `unavailableSelected` removes a controlled tag. Facet values are bounded to 500 and source
rows to 500 tags and 65,536 display-text UTF-16 units each. Source-row tags render as complete text
lists rather than one chip per tag. Malformed or oversized replies show a localized error.

Bulk selection still contains up to 10,000 global IDs. The provider resolves them in sequential
batches of at most 500; only authoritative global lookup absence removes an ID. The header
checkbox selects or clears the loaded page while preserving off-page selections. Selection
changes wait for lookup to complete; failures expose `selection-status` and `selection-retry`.
User `lr-selection-change` carries the complete accepted ID list, and programmatic assignments
remain silent. Page/query changes and page retry reuse the independent selected-record cache.
`lr-filter-change.matchCount` reports the accepted global query total.

A defined source takes display precedence over `documents`; it never overwrites that legacy
getter. Invalid defined sources fail visibly. Setting `dataSource = undefined` restores the
current legacy documents and their existing limits. The source remains host-owned by identity;
after changing its contents or revision, reassign it (including the same object) or call unnamed
`requestUpdate()`. Replacement, explicit refresh, locale change, disconnect and adoption revoke
obsolete work. Named presentation updates reuse accepted data. Both source and legacy routes
forward instance `strings` to the composed table.

**Events:**

- `lr-filter-change` — non-cancelable; fresh frozen readonly `{ searchTerm, tags, matchCount }`.
- `lr-sort-request` — cancelable; proposes frozen readonly `{ phase: 'request', sortKey, sortDir }`.
- `lr-sort` — non-cancelable; an accepted sort commits the same fields with `phase: 'commit'`.
- `lr-selection-change` — non-cancelable; fresh frozen readonly `{ documentIds }`.
- `lr-open` — non-cancelable; frozen readonly `{ documentId }`.
- `lr-retry-request` — cancelable, `detail: null`; the nested table's built-in retry button was
  activated while a host or provider load error is shown. The library contains the child's request, then
  emits its own canonical request. Preventing it leaves both library and table errors set; otherwise
  the default clears the host error and retries the current provider page when a source is set.

**Slots:** `error` — replaces the nested table's built-in failed-load state, including its retry
button, while a host or provider load error is shown.

**CSS parts:** `base`, `toolbar`, `search`, `tag-filter`, `selection-bar`, `selection-count`,
`clear-selection`, `table`, `row`, `cell`, `header-cell`, `document-name`, `error-row`, `error-cell`,
`error` (the nested table's built-in `lr-empty` host), `error-base`, `error-icon`, `error-heading`,
`error-description`, `error-actions`, `retry-button`, `limit` (the count of distinct tags omitted
from the facet), `selection-status` (source selection loading/error), and `selection-retry`.

`selection-bar` is visible ordinary content, not a shadow live region. `selectedDocumentIds`
assignments stay silent; each selection change the user makes (row or select-all checkbox, "Clear
selection") appends the localized selected count to the document's shared light-DOM polite sink.
Internal search, tag-filter, and checkbox native `input`/`change` plus prefixed `lr-input`/
`lr-change` aliases, the checkboxes' `lr-checkbox-toggle-request` proposals, the tag combobox's
lifecycle/filter/clear/invalid events, table pagination and priority-column visibility events, and
the table's click-anywhere selection event stop at the component's translation boundary. The table is still in multiple-selection semantics so
`selectedDocumentIds` reaches row `aria-selected`; document selection itself remains checkbox-owned, while
row activation opens the document. Listen for the document-library events above; one interaction
emits one documented host contract without also leaking a composed child event.

## `lr-graph-query-builder`

Form-associated editor for a typed graph relationship/path query, including entity anchors,
relationship and node-type filters, hop limits, validation, and saved queries.

When the DOM cannot provide `activeElement`, the builder skips focus restoration while chip removal
and saved-query updates continue normally. Each edit updates the query once and emits
`input`/`lr-input` and `change`/`lr-change` on commits, with the complete
`{ value: GraphQuery }` snapshot on the prefixed events. Native value events, prefixed value
aliases and listbox show/hide lifecycle events from every child control are contained; events from
slotted content pass through. Programmatic query assignments remain silent.

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
`lr-query-run-request`, `lr-query-save-request`, `lr-query-load-request`, and
`lr-query-delete-request` requests precede any local effect; non-cancelable `lr-query-run`,
`lr-query-save`, `lr-query-load`, and `lr-query-delete` notifications follow only when accepted.
The matching request/accepted pair reuses one frozen payload: `{ query }` for run,
`{ name, query }` for save, `{ queryId, query }` for load, and `{ queryId }` for delete.
Run validates before its request. Save veto preserves the draft name. Load requests frozen
`{ queryId, query }` before changing `value`, so veto preserves the current query; its accepted event
fires after the new value is applied. Delete remains controlled, so the host removes the accepted
id from `savedQueries`. The full set is native `input`/`change`, `lr-input`/`lr-change`, `lr-validity-change`, `lr-invalid`, and the
eight phased action events (four requests and four accepted notifications).

Migration note: veto save in `lr-query-save-request`, not `lr-query-save`; the existing
`lr-query-*` action events are accepted, non-cancelable notifications. **Slots:** `actions`,
`label`, `hint`, `error`. **CSS
parts:** `base`, `form-control-label` (`label` remains as a compatibility alias on the same node),
`hint`, `error` (the three form-control chrome parts every
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

`components/data/condition-builder/condition-builder-register.js` registers the controls used by
ordinary string, number, boolean and single-value enum rows. Import `lr-date-input.js` for date
fields and `lr-combobox.js` for multi-value enum operators. The default entry registers both.

Each edit updates the builder once and emits one `lr-input` carrying the complete
`{ value: ConditionBuilderValue }` snapshot. Child native `input`/`change`, prefixed value aliases
and listbox show/hide lifecycle events from every row control and the combinator stay inside the
builder; events from slotted consumer content pass through. Programmatic `value` assignments
remain silent. Both builders use the same bounded, own-data option normalization, retaining each
builder's public option type and first-value-wins behavior.

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

## Consumer integration notes

- **Data grid:** variable-height rows use `[part="body"]` as the only vertical and horizontal scroll
  viewport; header and footer mirror its logical inline position. Resize `aria-valuenow` stays in
  CSS pixels while `aria-valuetext` is localized with the effective locale. Row/group measurement is
  cached by stable identity: after width, columns, locale, or display structure changes, a pending
  `scrollToIndex()` target realigns after measurement unless a user scroll supersedes the correction.
  `--lr-data-grid-control-hover-bg`, `--lr-data-grid-control-active-bg`,
  `--lr-data-grid-page-size-active-bg`, `--lr-data-grid-row-active-bg`,
  `--lr-data-grid-sortable-header-hover-bg`, and
  `--lr-data-grid-sortable-header-active-bg` theme those independent state surfaces.
- **Table:** resize-handle numeric ARIA ranges remain CSS pixels, with localized current-pixel
  `aria-valuetext`. Adjacent row-expand controls inherit table typography and use a `1em` glyph.
- **Flow canvas:** only direct child cards participate. A matching `node-id` receives the managed
  `node-{id}` slot. When the canvas stops managing a card, it restores that card's original `slot`
  only if it has not changed in the meantime; a later author-set `slot` is left intact. Unmatched
  direct cards do not render because there is no catch-all slot. The first completed connected
  layout is silent even if truncated; it still shows the limit and emits `lr-layout-change`, while
  only a later false-to-true truncation transition announces.

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-data-calendar-calendar-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/calendar/calendar.class.js`.
  `CalendarEvent {
    readonly id?: string;
    readonly date: string | number | Date;
    readonly title: string;
    readonly color?: string;
    readonly data?: unknown;
  }`

- **`components-data-condition-builder-condition-builder-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/condition-builder/condition-builder.class.js`.
  `ConditionBuilderCondition {
    readonly id: string;
    readonly field: string;
    readonly operator: ConditionBuilderOperator | '';
    readonly value?: string | number | boolean | readonly string[];
  }`
  Import: `@aceshooting/lyra-ui/components/data/condition-builder/condition-builder.class.js`.
  `ConditionBuilderField {
    readonly name: string;
    readonly label?: string;
    readonly type: ConditionBuilderFieldType;
    readonly options?: readonly ConditionBuilderFieldOption[];
    readonly operators?: readonly ConditionBuilderOperator[];
    readonly placeholder?: string;
    readonly min?: number | string;
    readonly max?: number | string;
    readonly step?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/condition-builder/condition-builder.class.js`.
  `ConditionBuilderFieldOption {
    readonly value: string;
    readonly label?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/condition-builder/condition-builder.class.js`.
  `ConditionBuilderValidationIssue {
    readonly conditionId: string;
    readonly code: ConditionBuilderValidationIssueCode;
  }`
  Import: `@aceshooting/lyra-ui/components/data/condition-builder/condition-builder.class.js`.
  `ConditionBuilderValue {
    readonly combinator: ConditionBuilderCombinator;
    readonly conditions: readonly ConditionBuilderCondition[];
  }`

- **`components-data-context-meter-context-meter-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/context-meter/context-meter.class.js`.
  `ContextMeterSegment {
    label: string;
    value: number;
    tone?: ContextMeterTone;
    color?: string;
    disabled?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/context-meter/context-meter.class.js`.
  `LyraContextMeterSegmentActivateDetail {
    readonly index: number;
    readonly label: string;
    readonly value: number;
  }`

- **`components-data-data-grid-data-grid-types-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridCellContextMenuDetail<Row = Record<string, unknown>> extends DataGridCellDetail<Row> {
    readonly originalEvent: MouseEvent | KeyboardEvent;
    // Inherited from DataGridCellDetail<Row>.
    readonly rowKey: DataGridKey;
    readonly columnId: string;
    readonly column: DataGridColumn<Row>;
    readonly value: unknown;
    readonly row: Row;
    readonly index: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridCellDetail<Row = Record<string, unknown>> {
    readonly rowKey: DataGridKey;
    readonly columnId: string;
    readonly column: DataGridColumn<Row>;
    readonly value: unknown;
    readonly row: Row;
    readonly index: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridColumn<Row = Record<string, unknown>> {
    readonly id?: string;
    readonly field?: string;
    readonly label?: string;
    readonly align?: 'left' | 'center' | 'right' | 'start' | 'end';
    readonly width?: number;
    readonly minWidth?: number;
    readonly maxWidth?: number;
    readonly flex?: number;
    readonly formatter?: (value: unknown, row: Row) => string | TemplateResult | Node | unknown;
    readonly cellTitle?: (row: Row) => string | undefined;
    readonly value?: (row: Row) => unknown;
    readonly sortable?: boolean;
    readonly sortFn?: DataGridSortAlgorithm;
    readonly comparator?: (left: unknown, right: unknown, leftRow: Row, rightRow: Row) => number;
    readonly sortDescFirst?: boolean;
    readonly sortUndefined?: 'first' | 'last' | 1 | -1;
    readonly searchable?: boolean;
    readonly filterable?: boolean;
    readonly filterType?: DataGridFilterType;
    readonly filterFn?: (value: unknown, filter: unknown, row: Row) => boolean;
    readonly hidden?: boolean;
    readonly hideable?: boolean;
    readonly resizable?: boolean;
    readonly movable?: boolean;
    readonly pinnable?: boolean;
    readonly pinned?: DataGridPinSide;
    readonly footer?: string | ((rows: readonly Row[]) => unknown);
    readonly aggregation?: DataGridAggregation<Row>;
    readonly aggregatedFormatter?: (value: unknown, rows: readonly Row[]) => string | TemplateResult | Node | unknown;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridColumnMoveDetail {
    readonly columnOrder: readonly string[];
    readonly columnId: string;
    readonly finished: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridColumnPinDetail {
    readonly columnId: string;
    readonly side: DataGridPinSide;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridColumnResizeDetail {
    readonly columnId: string;
    readonly columnKey: string;
    readonly width: number;
    readonly finished: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridColumnState {
    readonly order?: readonly string[];
    readonly widths?: Readonly<Record<string, number>>;
    readonly visibility?: Readonly<Record<string, boolean>>;
    readonly pinning?: Readonly<Record<string, DataGridPinSide>>;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridColumnVisibilityDetail {
    readonly columnId: string;
    readonly visible: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridCopyOptions {
    readonly columnIds?: readonly string[];
    readonly includeHeaders?: boolean;
    readonly format?: 'tsv' | 'csv';
    readonly escapeFormulas?: boolean;
    readonly delimiter?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridCsvOptions {
    readonly delimiter?: string;
    readonly includeHeaders?: boolean;
    readonly columnIds?: readonly string[];
    readonly escapeFormulas?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridDataErrorDetail {
    readonly error: unknown;
    readonly request: DataGridRequest;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridExportOptions extends DataGridCsvOptions {
    readonly fileName?: string;
    // Inherited from DataGridCsvOptions.
    readonly delimiter?: string;
    readonly includeHeaders?: boolean;
    readonly columnIds?: readonly string[];
    readonly escapeFormulas?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridFacets {
    readonly uniqueValues: ReadonlyMap<unknown, number>;
    readonly minMax?: readonly [number, number];
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridFilter {
    readonly id: string;
    readonly value: unknown;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridGroupDetail<Row = Record<string, unknown>> {
    readonly key: string;
    readonly columnId: string;
    readonly value: unknown;
    readonly rows: readonly Row[];
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridPageDetail {
    readonly page: number;
    readonly pageSize: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridRequest {
    readonly sort: DataGridSortingState;
    readonly filters: readonly DataGridFilter[];
    readonly search: string;
    readonly page: number;
    readonly pageSize: number;
    readonly signal: AbortSignal | undefined;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridResponse<Row = Record<string, unknown>> {
    readonly rows: readonly Row[];
    readonly total: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridRowDetail<Row = Record<string, unknown>> {
    readonly rowKey: DataGridKey;
    readonly key: DataGridKey;
    readonly row: Row;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridScrollOptions {
    readonly align?: 'start' | 'center' | 'end';
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridSelectionDetail<Row = Record<string, unknown>> {
    readonly selectedRowKeys: readonly DataGridKey[];
    readonly selectedKeys: readonly DataGridKey[];
    readonly selectedRows: readonly Row[];
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridSort {
    readonly id: string;
    readonly desc: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridStateFilter {
    readonly id: string;
    readonly value: DataGridJsonValue;
  }`
  Import: `@aceshooting/lyra-ui/components/data/data-grid/data-grid.class.js`.
  `DataGridState extends DataGridColumnState {
    readonly sort?: DataGridSortingState;
    readonly filters?: readonly DataGridStateFilter[];
    readonly search?: string;
    readonly selectedRowKeys?: readonly DataGridKey[];
    readonly expandedRowKeys?: readonly DataGridKey[];
    readonly selectedKeys?: readonly DataGridKey[];
    readonly expandedKeys?: readonly DataGridKey[];
    readonly page?: number;
    readonly pageSize?: number;
    // Inherited from DataGridColumnState.
    readonly order?: readonly string[];
    readonly widths?: Readonly<Record<string, number>>;
    readonly visibility?: Readonly<Record<string, boolean>>;
    readonly pinning?: Readonly<Record<string, DataGridPinSide>>;
  }`

- **`components-data-document-library-document-library-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/document-library/document-library.class.js`.
  `DocumentLibraryFilterChangeDetail {
    readonly searchTerm: string;
    readonly tags: readonly string[];
    readonly matchCount: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/document-library/document-library.class.js`.
  `DocumentLibraryOpenDetail {
    readonly documentId: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/document-library/document-library.class.js`.
  `DocumentLibrarySelectionChangeDetail {
    readonly documentIds: readonly string[];
  }`
  Import: `@aceshooting/lyra-ui/components/data/document-library/document-library.class.js`.
  `DocumentLibrarySortCommitDetail {
    readonly phase: 'commit';
    readonly sortKey: LibraryDocumentSortKey;
    readonly sortDir: TableSortDirection;
  }`
  Import: `@aceshooting/lyra-ui/components/data/document-library/document-library.class.js`.
  `DocumentLibrarySortRequestDetail {
    readonly phase: 'request';
    readonly sortKey: LibraryDocumentSortKey;
    readonly sortDir: TableSortDirection;
  }`
  Import: `@aceshooting/lyra-ui/components/data/document-library/document-library.class.js`.
  `LibraryDocument extends DocumentRef {
    tags?: readonly string[];
    owner?: string;
    updatedAt?: Date | string;
    freshness?: LibraryDocumentFreshness;
    // Inherited from DocumentRef.
    id: string;
    name: string;
    mimeType?: string;
    uri?: string;
    version?: string;
  }`

- **`components-data-env-list-env-list-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/env-list/env-list.class.js`.
  `EnvEntry {
    readonly name: string;
    readonly value: string;
    readonly secret?: boolean;
  }`

- **`components-data-file-tree-file-tree-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/file-tree/file-tree.class.js`.
  `FileTreeNode {
    readonly path: string;
    readonly name?: string;
    readonly kind?: 'file' | 'directory';
    readonly mimeType?: string;
    readonly gitStatus?: GitStatus;
    readonly additions?: number;
    readonly deletions?: number;
    readonly children?: readonly FileTreeNode[];
    readonly hasChildren?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/file-tree/file-tree.class.js`.
  `type FileTreeSource = LyraHierarchySource<FileTreeNode, LyraHierarchyQuery>`

- **`components-data-flow-canvas-flow-types-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly sourceHandle?: string;
    readonly targetHandle?: string;
    readonly label?: string;
    readonly tone?: LyraVariant;
  }`
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowHandle {
    readonly id: string;
    readonly label?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowLayoutChangeDetail {
    readonly positions: Readonly<Record<string, Readonly<{
      x: number;
      y: number;
    }>>>;
    readonly truncated: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowNode {
    readonly id: string;
    readonly type?: string;
    readonly position?: Readonly<{
      x: number;
      y: number;
    }>;
    readonly data?: Readonly<Record<string, unknown>>;
    readonly accessibleLabel?: string;
    readonly inputs?: readonly FlowHandle[];
    readonly outputs?: readonly FlowHandle[];
    readonly disabled?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowRunDecoration {
    readonly status: LyraToolStatus;
    readonly progress?: number;
    readonly durationMs?: number;
    readonly detail?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowStructureEdgeSnapshot {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly status?: LyraToolStatus;
  }`
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowStructureNodeSnapshot {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly status?: LyraToolStatus;
  }`
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowStructureSnapshot {
    readonly source?: Readonly<{
      coverage: 'complete' | 'neighborhood' | 'aggregate';
      total: LyraGraphSourceSummary;
      worldBounds: LyraSourceBounds;
      overview: LyraGraphOverview | null;
    }>;
    readonly nodes: readonly FlowStructureNodeSnapshot[];
    readonly edges: readonly FlowStructureEdgeSnapshot[];
    readonly viewport: FlowViewportSnapshot;
    readonly locked: boolean;
    readonly orientation: LyraOrientation;
    readonly layerGap: number;
    readonly nodeGap: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js`.
  `FlowViewportSnapshot {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
    readonly width: number;
    readonly height: number;
    readonly minZoom: number;
    readonly maxZoom: number;
  }`

- **`components-data-funnel-funnel-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/funnel/funnel.class.js`.
  `LyraFunnelStage {
    readonly label: string;
    readonly value: number;
    readonly color?: string;
  }`

- **`components-data-graph-query-builder-graph-query-builder-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/graph-query-builder/graph-query-builder.class.js`.
  `GraphQueryDeleteDetail {
    readonly queryId: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/graph-query-builder/graph-query-builder.class.js`.
  `GraphQuery {
    readonly startId: string;
    readonly endId: string;
    readonly relationshipTypes: readonly string[];
    readonly nodeTypes: readonly string[];
    readonly direction: GraphQueryDirection;
    readonly minHops: number;
    readonly maxHops: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/graph-query-builder/graph-query-builder.class.js`.
  `GraphQueryLoadDetail {
    readonly queryId: string;
    readonly query: GraphQuery;
  }`
  Import: `@aceshooting/lyra-ui/components/data/graph-query-builder/graph-query-builder.class.js`.
  `GraphQueryRunDetail {
    readonly query: GraphQuery;
  }`
  Import: `@aceshooting/lyra-ui/components/data/graph-query-builder/graph-query-builder.class.js`.
  `GraphQuerySaveDetail {
    readonly name: string;
    readonly query: GraphQuery;
  }`
  Import: `@aceshooting/lyra-ui/components/data/graph-query-builder/graph-query-builder.class.js`.
  `GraphQuerySavedItem {
    readonly id: string;
    readonly name: string;
    readonly query: GraphQuery;
  }`
  Import: `@aceshooting/lyra-ui/components/data/graph-query-builder/graph-query-builder.class.js`.
  `GraphQueryTypeOption {
    readonly value: string;
    readonly label?: string;
  }`

- **`components-data-heatmap-calendar-grid-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui`.
  `CalendarDay {
    date: string;
    value: number;
  }`

- **`components-data-heatmap-heatmap-scale-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui`.
  `linearAlpha(value: number, lo: number, hi: number): number`
  Import: `@aceshooting/lyra-ui`.
  `sqrtStep(count: number, max: number, steps: number): number`

- **`components-data-heatmap-heatmap-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `CalendarCellPos {
    week: number;
    weekday: number;
    date: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `HeatmapAnnotation {
    row?: number;
    col?: number;
    date?: string;
    label?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `HeatmapCalendarData {
    readonly kind: 'calendar';
    readonly days: readonly CalendarDay[];
    readonly firstDayOfWeek?: number;
    readonly columnX?: (index: number) => number;
    readonly rowY?: (weekday: number) => number;
    readonly weekdayLabelWidth?: number | 'auto';
    readonly weekdayLabelText?: (jsWeekday: number) => string | undefined;
    readonly monthLabelText?: (jsMonth: number, year: number) => string | undefined;
  }`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `HeatmapLegendStop {
    value: number;
    color?: string;
    label?: string;
    partOfRamp?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `HeatmapMatrixData {
    readonly kind: 'matrix';
    readonly rowLabels: readonly string[];
    readonly colLabels: readonly string[];
    readonly values: readonly (readonly number[])[];
  }`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `HeatmapSelectedCell {
    row?: number;
    col?: number;
    date?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `HeatmapSelectionChangeDetail {
    readonly selectedCells: readonly Readonly<HeatmapSelectedCell>[];
    readonly source: HeatmapSelectionSource;
  }`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `hexToRgb(hex: string): [number, number, number, number] | null`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `MatrixCellPos {
    row: number;
    col: number;
  }`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `normalizeBucketCount(bucketCount: number): number`
  Import: `@aceshooting/lyra-ui/components/data/heatmap/heatmap.class.js`.
  `resolveRgb(color: string, fallbackHex: string, ownerDocument?: Document): [number, number, number, number]`

- **`components-data-pagination-pagination-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/pagination/pagination.class.js`.
  `LyraPaginationChangeDetail {
    readonly page: number;
    readonly pageSize: number;
  }`

- **`components-data-sequence-strip-sequence-strip-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/sequence-strip/sequence-strip.class.js`.
  `LyraSequenceStripActivateDetail {
    readonly index: number;
    readonly id: string;
    readonly item: SequenceStripItem;
  }`
  Import: `@aceshooting/lyra-ui/components/data/sequence-strip/sequence-strip.class.js`.
  `SequenceStripCategory {
    readonly id: string;
    readonly color: string;
    readonly label?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/sequence-strip/sequence-strip.class.js`.
  `SequenceStripItem {
    readonly id: string;
    readonly categoryId: string;
    readonly marker?: boolean;
    readonly label?: string;
    readonly disabled?: boolean;
  }`

- **`components-data-stat-stat-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/stat/stat.class.js`.
  `StatRow {
    readonly label: string;
    readonly value: string;
    readonly exactValue?: string;
  }`

- **`components-data-table-table-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/table/table.class.js`.
  `TableColumn<T> {
    key: string;
    label: string;
    headerCell?: (column: TableColumn<T>) => unknown;
    width?: string;
    minWidth?: string;
    maxWidth?: string;
    resizable?: boolean;
    sortable?: boolean;
    sortValue?: (row: T) => string | number | null | undefined;
    defaultSortDir?: TableSortDirection;
    align?: TableEdgeAlign;
    priority?: 'medium' | 'low';
    sticky?: TableEdgeAlign;
    footer?(rows: readonly T[]): unknown;
    cellStyle?(row: T): Record<string, string> | undefined;
    cellTitle?(row: T): string | undefined;
    heatValue?(row: T): number | null | undefined;
    editTrigger?: TableColumnEditTrigger;
    editValue?: (row: T) => string | number;
    editLabel?: (row: T) => string;
    editType?: 'text' | 'number' | 'select';
    editOptions?: TableColumnEditOption[];
    cell: (row: T) => unknown;
  }`
  Import: `@aceshooting/lyra-ui/components/data/table/table.class.js`.
  `TableColumnEditOption {
    value: string;
    label: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/table/table.class.js`.
  `TableSortCommitDetail {
    readonly phase: 'commit';
    readonly sortKey: string;
    readonly sortDir: TableSortDirection;
  }`
  Import: `@aceshooting/lyra-ui/components/data/table/table.class.js`.
  `TableSortRequestDetail {
    readonly phase: 'request';
    readonly sortKey: string;
    readonly sortDir: TableSortDirection;
  }`

- **`components-data-tree-tree-types-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/tree/tree.class.js`.
  `LyraTreeNodeData {
    readonly id: string;
    readonly label: string;
    readonly selected?: boolean;
    readonly disabled?: boolean;
    readonly lazy?: boolean;
    readonly children?: readonly LyraTreeNodeData[];
    readonly badges?: readonly TreeBadge[];
    readonly icon?: unknown;
    readonly description?: string;
    readonly accessibleLabel?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/tree/tree.class.js`.
  `TreeBadge {
    readonly text: string;
    readonly tone?: LyraVariant;
    readonly label?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/data/tree/tree.class.js`.
  `type TreeSource = LyraHierarchySource<LyraTreeNodeData, LyraHierarchyQuery>`

- **`components-data-word-cloud-word-cloud-layout-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/word-cloud/word-cloud.class.js`.
  `WordCloudWord {
    readonly text: string;
    readonly weight: number;
    readonly color?: string;
    readonly group?: string;
  }`

- **`components-data-word-cloud-word-cloud-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/data/word-cloud/word-cloud.class.js`.
  `WordCloudLegendItem {
    readonly label: string;
    readonly color: string;
  }`

`lr-data-grid` publishes each server-data request through both `request` and `lr-request`.
Both events carry equivalent frozen `DataGridRequest` details with the same abort signal identity.
Listen to either name to handle each request once.
