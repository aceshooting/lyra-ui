## `lr-chart` (core)

Chart.js wrapper every other `lr-*-chart` tag subclasses; supports both a simplified
`Series`-based attribute surface and a raw Chart.js `config` passthrough (mirrors Web Awesome's
`wa-chart` `config` property).

**Properties:**
- `type: LyraChartType = 'line'` — `LyraChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'doughnut' |
  'radar' | 'polarArea' | 'bubble'` — every type string the typed `lr-*-chart` subclasses lock `type` to is
  already a first-class member, so `<lr-chart type="pie">` needs no subclass or cast to work;
  unknown runtime attribute/property values fall back to `line` before reaching Chart.js
- `labels: string[] = []` (attribute: false)
- `datasets: Series[] = []` (attribute: false) — `Series { label: string; data?: (number|null)[];
  points?: {x,y,label?}[]; color?: string|string[]; fill?: boolean; width?: number; dash?: boolean;
  noTooltip?: boolean; axis?: 'y'|'y2'; pointColors?: string[]; pointRadius?: number; type?:
  'line'|'bar' }`
- `legend: boolean = false`
- `legendPosition: LyraChartLegendPosition = 'top'` (attribute `legend-position`) — places the
  legend at `top`, `right`, `bottom`, or `left`; `auto` chooses right above 480px and bottom below
  that allocation width
- `valueFormatter?: LyraChartValueFormatter` (attribute: false) — formats numeric tick, tooltip,
  and legend values; the callback receives the value and `'tick'`, `'tooltip'`, or `'legend'`
  context
- `area: boolean = false`
- `zoom: boolean = false` — wheel/drag/pinch zoom on the `x` axis only (pan disabled, and the zoom
  range is limited to the original data extent); shows the `reset-zoom-button` while zoomed
- `height: string = '280px'`
- `xLabel: string = ''` (attribute `x-label`)
- `yLabel: string = ''` (attribute `y-label`)
- `y2Label: string = ''` (attribute `y2-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
- `horizontal: boolean = false` — sets `options.indexAxis = 'y'`, Chart.js's own mechanism for
  horizontal bars (also flips `line`/`area` types onto a horizontal category axis)
- `stacked: boolean = false` — stacks the `x`/`y`(/`y2`) scale entries `buildScales()` returns; only
  meaningful for `bar`/`line` types (scatter/bubble's linear `x` scale and the radial `r` scale used
  by radar/polar-area are out of scope)
- `config?: Partial<ChartConfiguration>` (attribute: false) — deep-merged over the generated
  config; any nested key wins without clobbering sibling generated keys. This is the raw Chart.js
  escape hatch, so a caller-supplied `config.type` is passed through rather than normalized.
- `accessibleLabel: string = ''` (attribute `accessible-label`) — canvas name override; a host
  `aria-label` has highest precedence
- `accessibleDescription: string = ''` (attribute `accessible-description`) — overrides the
  localized data/trend summary
- `showDataTable: boolean = false` (attribute `show-data-table`) — makes the always-available
  accessible data table visible rather than screen-reader-only
- `chartArea: LyraChartArea | undefined` (readonly) — current Chart.js chart-area geometry in
  canvas-local coordinates (`top`, `left`, `right`, `bottom`, `width`, `height`), when a chart is
  drawn
- `appendData(label, values, maxPoints?)` — appends one aligned numeric category and optionally
  keeps only the newest `maxPoints`; point-based scatter/bubble series are left unchanged

**Methods:** `resetZoom()` (reset any active zoom/pan to the original view), `refreshTheme()`, and
`exportData('csv' | 'png')` (returns a spreadsheet-safe CSV snapshot or the current PNG data URL
when Chart.js is loaded)
(forces a redraw so the `--lr-chart-*` tokens below are re-read from the current computed style. A
built-in `ThemeWatcher` now calls this automatically when `prefers-color-scheme` flips or an
ancestor's `class`/`style`/`data-theme`/`data-color-scheme` attribute mutates — the most common
theme-toggle mechanisms — so a consumer rarely needs to call it by hand; it remains public as the
escape hatch for theme changes those signals can't observe)

**Events:** `lr-zoom` (`detail: { zoomed: boolean }`, fired on zoom-complete and on
`resetZoom()`), `lr-point-click` (fired when a click lands on, or nearest to — intersect-only —
a data point/segment, for any chart type, not just bar; `detail: { datasetIndex: number, index:
number, label: string | undefined, value: unknown }`)

**Slots:** `data-table` — an optional consumer-provided accessible table alternative; `center` —
optional overlay content positioned at the chart area's center, useful for doughnut and pie totals.

**CSS parts:** `base`, `canvas`, `reset-zoom-button`, `description`, `data-table`, `center` (the
chart-area-centered wrapper for the `center` slot), `error` (`role="alert"` message rendered in
place of `canvas` when the optional `chart.js` peer dependency fails to load)

**Themeable custom properties:** `--lr-chart-height` (set programmatically on the host from the
`height` property — must be read from the host, not a shadow-tree descendant, since custom
properties only cascade downward); `--lr-chart-grid-color` (default `var(--lr-color-border)`),
`--lr-chart-tick-color` (default `var(--lr-color-text-quiet)`), `--lr-chart-legend-color`
(default `var(--lr-color-text)`), `--lr-chart-tooltip-bg` (default `var(--lr-color-surface)`),
`--lr-chart-tooltip-text` (default `var(--lr-color-text)`) — each resolved fresh via
`getComputedStyle` on every draw (Chart.js renders to canvas, not the DOM, so it can't consume CSS
`var()` directly), driving the grid lines, tick labels **and axis titles** (`xLabel`/`yLabel`/
`y2Label` title text reuses `--lr-chart-tick-color` too — there's no separate title-color token),
legend text, and tooltip background/text respectively; plus shared `--lr-space-xs`.

**Optional peer deps:** `chart.js` (mandatory peer, lazy-imported on every `connectedCallback()`
regardless of `zoom`), `chartjs-plugin-zoom` (lazy-imported *additionally* only when `zoom` is — or
later becomes — `true`; never fetched for a chart that keeps `zoom` unset/false, since the plugin
has a hard dependency on `hammerjs`). Both loads are memoized once per page via `chart-loader.ts`
(`loadChartJs()` / `loadChartJsWithZoom()`), registering only the tree-shaken controller/element/scale
subset actually used.

```html
<lr-chart type="line" x-label="Day" y-label="kWh" legend></lr-chart>
<script>
  const c = document.querySelector('lr-chart');
  c.labels = ['Mon', 'Tue', 'Wed'];
  c.datasets = [{ label: 'Production', data: [12, 19, 7], color: '#2563eb' }];
</script>
```

**Known gotchas:**
- supported `type` values are normalized before reaching Chart.js; unknown runtime attribute or
  property values fall back to `line`. Each typed `lr-*-chart` subclass (e.g.
  `llms/components/lr-bar-chart.md`) locks its *own* `type` via a real prototype accessor — a
  genuine runtime lock, not just a compile-time default.
- a built-in `ThemeWatcher` auto-retheme an already-drawn chart when `prefers-color-scheme` flips or
  an ancestor's `class`/`style`/`data-theme`/`data-color-scheme` attribute mutates (coalesced to one
  redraw). `refreshTheme()` stays public for out-of-band theme changes those signals can't observe.
- generated `scales` are keyed off the *effective* type (`config.type` ?? `type`, see
  `effectiveType()`) and are type-appropriate: no scale at all for `type="pie"`/`"doughnut"` (true of
  `<lr-chart type="pie">` directly, not just the `lr-pie-chart`/`lr-doughnut-chart` subclasses),
  and a single radial `r` scale (respecting `beginAtZero`) for `type="radar"`/`"polarArea"`
  (`lr-radar-chart`/`lr-polar-area-chart`), instead of always generating the cartesian `x`/`y`/
  `y2` block. `xLabel`/`yLabel`/`y2Label` are still silently inert for all four of those types (a
  radial scale and "no scale" both have nowhere to put an axis title) — reach a titled radial scale
  only via raw `config`.
- No `chartjs-plugin-annotation` is registered by default — reachable only by importing it
  separately and using the raw `config` passthrough (Chart.js's registry is a global singleton).
- while the `chart.js` peer is resolving, `render()` swaps in a `<lr-skeleton variant="rect">` for
  the canvas, and the **host element itself** (not the skeleton) carries `aria-busy="true"` — set/
  cleared in `updated()` off the private `loading` state (same lazy-load pattern as
  `lr-graph`/`lr-map`/`lr-flag`). Chart.js's own ~1000ms draw-in animation only ever fires on
  initial construction or a type change that rebuilds the `Chart` instance (every in-place data
  update already passes `'none'` to `Chart#update()` and never animates regardless); that
  construction-time animation is additionally skipped outright under `prefers-reduced-motion: reduce`.
  The raw `config` passthrough is deep-merged with `__proto__`/`constructor`/`prototype` keys skipped
  unconditionally, so a JSON-sourced `config` (e.g. parsed from an API response) can't reach up and
  pollute `Object.prototype` through the merge.
- lazy-redraw + change gating: an `IntersectionObserver` gates `draw()` — while the host is scrolled
  off-screen, property changes that would otherwise trigger a Chart.js redraw are skipped (and a
  single redraw fires once it re-enters the viewport). Independently, `updated()` only reaches
  Chart.js when at least one of `type`, `labels`, `datasets`, `legend`, `legendPosition`, the
  internal resolved auto legend position, `valueFormatter`, `area`, `height`, `xLabel`, `yLabel`,
  `y2Label`, `beginAtZero`, `horizontal`, `stacked`, `config`, `zoom`, `locale`, `strings`, or the
  internal loading state actually changed in that update (so an unrelated property/state update, or
  a bare `requestUpdate()`, draws nothing). `refreshTheme()` calls `draw()` directly and is
  unaffected by either gate — it always redraws, since a theme change isn't reflected in any tracked
  property.
- Chart.js receives `effectiveLocale`; generated summary values use the same locale. Cartesian y/y2
  axes swap logical sides under RTL, and host `aria-label` is forwarded to the canvas and data-table
  caption.

---

## `lr-lite-chart`

A dependency-free bar/line chart — plain SVG/DOM rendering, zero peer dependencies (unlike
`lr-chart`, which wraps `chart.js`). For a project whose architecture forbids a charting
dependency outright: covers grouped/stacked bars, multi-series lines, per-point click, and hover
tooltips (native SVG `<title>`, no positioning JS) — not a full `lr-chart` replacement (no
zoom/pan, no pie/doughnut/radar/scatter/bubble types, no horizontal/dual-y-axis, no raw-config
passthrough). Not a subclass of `LyraChart`.

**Properties:**
- `type: LyraLiteChartType = 'bar'` — `'bar' | 'line'`
- `labels: string[] = []` (attribute: false)
- `datasets: LiteSeries[] = []` (attribute: false) — `LiteSeries { label: string; data:
  (number|null)[]; color?: string }`
- `legend: boolean = false`
- `height: string = '280px'`
- `xLabel: string = ''` (attribute `x-label`)
- `yLabel: string = ''` (attribute `y-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
- `stacked: boolean = false` — sums each category's bars into one segmented bar instead of grouping
  them side by side; ignored for `type="line"`
- `tickFormat?: (value: number) => string` (attribute: false) — formats a y-axis tick value for
  display (e.g. `(v) => \`$${v.toFixed(2)}\`` for currency, or a duration formatter for `"42s"`).
  Falls back to the built-in "nice numbers" formatter when unset.
- `layout: 'fit' | 'scroll' = 'fit'` (reflected) — `'fit'` (default) is the original squeeze-the-
  whole-plot-to-host-width behavior, unchanged. `'scroll'` gives bars a fixed `barWidth` instead: plot
  content width becomes `categoryCount * barWidth` (can exceed the host's measured width), and
  `[part='base']` becomes horizontally `overflow-x: auto` so the user scrolls to see every bar at a
  legible fixed width instead of them compressing as category count grows. Bar type only.
- `barWidth: number = 32` (attribute `bar-width`, px) — each bar's fixed width in `layout="scroll"`
  mode; ignored in the default `'fit'` mode.
- `maxLabels?: number` (attribute `max-labels`, type Number) — decimates which category axis labels
  actually render *text* when `labels.length > maxLabels` (bars themselves are never decimated, only
  their axis `<text>` labels): always shows the first and last label, and roughly evenly distributes
  the rest between them. Works in either `layout` mode. Unset (the default) renders every label,
  unchanged.
- `barX?: (index: number) => number` (attribute: false, bar type only) — overrides the internal
  per-category x-origin formula (`plotX + i * slot`) used by both bars and their axis labels, so a
  consumer can pixel-align this chart's bars with a sibling `<lr-heatmap>` calendar's week columns
  (see that component's own `columnX`) by supplying the same coordinate function to both. Unset (the
  default) is the original formula, unchanged.
- `pointText?: (label: string, value: number, datasetIndex: number) => string` (attribute: false) —
  overrides the per-bar/per-point `<title>`/`aria-label` tooltip text (mirrors `lr-heatmap`'s
  `cellText`). Falls back to the built-in raw-value template when unset.
- `legendText?: (label: string, datasetIndex: number) => string` (attribute: false) — appends
  formatter-supplied text (e.g. a value or percentage share) after each series' label in the
  built-in legend row, mirroring `pointText`/`tickFormat`'s opt-in-hook convention. Falls back to
  the label alone when unset; no-op while `legend` is `false`.
- `roundedBars: boolean = false` (attribute `rounded-bars`, bar type only) — draws each bar as a
  rounded-top-corner shape instead of a square-cornered `<rect>`.
- `skipZero: boolean = false` (attribute `skip-zero`, bar type only) — omits a bar entirely (no
  mark/tabindex/tooltip) for a value that is exactly `0`; `null`/non-finite values are always
  skipped regardless.
- `padLeft?: number` (attribute `pad-left`) — overrides the internal 36px `PAD_LEFT` plot-left-
  padding constant. Unset keeps the fixed 36px.
- `barGapRatio?: number` (attribute `bar-gap-ratio`) — overrides the internal 0.2 `BAR_GROUP_GAP`
  fraction of a category slot left as a gap between categories. Unset keeps the fixed 0.2.
- `scale: 'linear' | 'sqrt' = 'linear'` (bar type only) — `'sqrt'` maps a bar's value to height via
  `Math.sqrt(value / domainMax)` instead of the standard linear `niceDomain` fraction (mirroring
  `lr-heatmap`'s matrix-mode `sqrt` scale), so a skewed dataset's smaller bars aren't washed out
  by one dominant value; gridlines/tick labels stay on the linear domain either way, and `type="line"`
  ignores it entirely.
- `hideAxis: boolean = false` (attribute `hide-axis`) — suppresses gridlines/y-axis tick labels
  altogether; x-axis category labels (rendered separately) are unaffected.
- `selectedIndex: number[] = []` (attribute: false) — category indexes to mark `data-selected` on
  every bar/segment at that index, across every dataset — e.g. to highlight a whole selected week's
  column in a stacked chart. Empty (the default) reproduces the exact existing output: no bar
  carries `data-selected`. This component takes no opinion on what the highlight looks like, only
  which bars it applies to — style the highlight via the `--lr-lite-chart-selected-outline-color`
  custom property (documented below). Note `::part(bar)[data-selected]` is **invalid CSS** — Shadow
  Parts forbids an attribute selector after `::part()` — so it silently never matches; the outline
  is painted inside the shadow root and exposed through that token instead.
- `minBarHeight?: number` (attribute `min-bar-height`) — optional minimum visible bar height for
  small non-zero values
- `accessibleLabel?: string` (attribute `accessible-label`) — SVG accessible-name override; a host
  `aria-label` wins
- `appendData(label, values, maxPoints?)` — appends one aligned category and optionally trims the
  oldest categories

**Events:** `lr-point-click` — fired when a bar/point is activated (click, or Enter/Space while
focused). `detail: { datasetIndex: number, index: number, label: string | undefined, value: number
| null }` — same shape as `lr-chart`'s `lr-point-click`.

**Methods:** `exportData('csv' | 'svg')` returns a spreadsheet-safe CSV snapshot or the current SVG
markup. The method does not download a file; pair it with `lr-export-button` for download UX.

The axis gutter/title and y-axis labels mirror to logical start under RTL. Built-in mark summaries
are complete localized templates and format values with `effectiveLocale`.

**Performance:** `render()` recomputes the grid/marks on every update rather than memoizing against a
content signature — `datasets`/`labels` can hold callbacks (`tickFormat`, `barX`) or arbitrary,
possibly circular or BigInt-bearing application data that a fingerprint can't serialize safely, so a
fresh, small SVG render is cheaper and more correct than a lossy cache.

**Slots:** none.

**CSS parts:** `base`, `grid-line`, `axis-label`, `axis-title`, `bar` (each bar rect; carries
`data-selected` when its category index is in `selectedIndex`), `line`, `point`, `legend`,
`legend-item`, `legend-swatch`, `legend-text` (extra per-item text after the series label,
rendered only when `legendText` is set), `live-region` (the current mark announcement for keyboard
users), `data-list` (a visually hidden list of all plotted data points).

**Themeable custom properties:** `--lr-chart-height` (same host-level property as `lr-chart`);
`--lr-chart-grid-color`, `--lr-chart-tick-color`, `--lr-chart-legend-color` — same token
*names* as `lr-chart`, so a host already theming `lr-chart` themes this for free;
`--lr-lite-chart-selected-outline-color` (default `var(--lr-color-brand)`) — the stroke drawn on
`[part='bar'][data-selected]`, i.e. bars whose category index is in `selectedIndex` (bars only;
`[part='point']` is never marked `data-selected`, and the stroke width is a fixed 2px). Unlike
`lr-chart` (canvas-rendered, needs `getComputedStyle`-based re-theming on every draw), this is
plain SVG/DOM and reads these via native CSS `var()` — no JS-side resolution step, and no
`refreshTheme()` method needed (there's nothing to go stale).

**Optional peer deps:** none. This is the point of the component.

```html
<lr-lite-chart type="bar" stacked legend x-label="Week" y-label="Commits"></lr-lite-chart>
<script>
  const c = document.querySelector('lr-lite-chart');
  c.labels = ['W1', 'W2', 'W3', 'W4'];
  c.datasets = [
    { label: 'Docs', data: [4, 6, 3, 8] },
    { label: 'Bugs', data: [3, 2, 5, 4] },
  ];
</script>
```

**Known gotchas:**
- No `horizontal` mode (unlike `lr-chart`) — deliberately cut from scope, not a stub: bars are
  always vertical.
- No dual y-axis (`Series.axis: 'y2'`) — every series shares one y-axis/domain.
- Series colors default to a fixed built-in 8-color categorical palette (round-robin by dataset
  index) when `color` is unset — not configurable beyond passing `color` per series.
- Bar/point elements are real focusable DOM nodes (`tabindex="0" role="button"`, each with its own
  `aria-label`), so the `<svg>` itself uses `role="group"`, not `role="img"` — an "img" role would
  conflict with genuinely interactive descendants (axe's `nested-interactive` rule).
- Tick values use a standard "nice numbers" (1/2/5 × 10ⁿ) rounding step, not exact data min/max —
  intentional (readable axis labels), matches how most charting libraries pick tick steps.

---

## Typed subclasses: `lr-line-chart`, `lr-bar-chart`, `lr-pie-chart`, `lr-doughnut-chart`, `lr-radar-chart`, `lr-polar-area-chart`, `lr-bubble-chart`, `lr-scatter-chart`

Each is `LyraChart` with `type` locked to a fixed value — respectively `line`, `bar`, `pie`,
`doughnut`, `radar`, `polarArea`, `bubble`, `scatter` — via a real `get`/`set` accessor pair the
shared `lockChartType()` helper installs on the subclass's own prototype (`declare type: '…'`
narrows the TS type at compile time; the runtime lock is the `Object.defineProperty` pair alongside
it — the same helper `lr-histogram` uses), not merely a class-field default a later assignment
could still override.

Everything else is inherited verbatim from `lr-chart`; each name below has the same type, default,
and behavior there. **See `llms/components/lr-chart.md` for the details, code example, and gotchas
of every entry in these lists.**

**Properties:** `labels`, `datasets`, `legend`, `legendPosition` (attribute `legend-position`),
`valueFormatter`, `area`, `zoom`, `height`, `xLabel` (`x-label`), `yLabel` (`y-label`), `y2Label`
(`y2-label`), `beginAtZero` (`begin-at-zero`), `horizontal`, `stacked`, `config`, `accessibleLabel`
(`accessible-label`), `accessibleDescription` (`accessible-description`), `showDataTable`
(`show-data-table`), `chartArea` (readonly). `type` is the only member that differs: read-only,
locked to this tag's value.

**Methods:** `resetZoom()`, `refreshTheme()`.

**Events:** `lr-zoom` (`detail: { zoomed: boolean }`), `lr-point-click` (`detail: { datasetIndex,
index, label, value }`).

**Slots:** `data-table`, `center`.

**CSS parts:** `base`, `canvas`, `reset-zoom-button`, `description`, `data-table`, `center`,
`error` (`role="alert"` message rendered in place of `canvas` when the optional `chart.js` peer
dependency fails to load — see `llms/components/lr-chart.md`).

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text`.

**Optional peer deps:** same as `lr-chart` — `chart.js`, plus `chartjs-plugin-zoom` only once
`zoom` is set.

```html
<lr-bar-chart legend></lr-bar-chart>
<lr-pie-chart></lr-pie-chart>
<script>
  document.querySelector('lr-bar-chart').labels = ['A', 'B'];
  document.querySelector('lr-bar-chart').datasets = [{ label: 'Count', data: [4, 9] }];

  document.querySelector('lr-pie-chart').labels = ['A', 'B', 'C'];
  document.querySelector('lr-pie-chart').datasets = [{ label: 'Share', data: [30, 45, 25], color: ['#2563eb', '#16a34a', '#dc2626'] }];
</script>
```

**Known gotchas (in addition to the core `lr-chart` list in `llms/components/lr-chart.md`):**
- `type` truly is locked per subclass: `<lr-pie-chart type="bar">` or `el.type = 'bar'` at runtime
  is a genuine no-op (the accessor's setter silently ignores the write), not a footgun like a plain
  overridden class-field default would be.
- `lr-bubble-chart` needs `Series.points` entries with an `x`/`y`/`r` triple, but `Series.points`
  is typed as `{x, y, label?}[]` with no `r` field — cast the array through `as unknown as
  Series['points']` (or a local `BubblePoint` type) when constructing bubble data.

---

## `lr-histogram`

Bins `values` into `bins` equal-width buckets and renders as a bar chart (extends `LyraChart`,
`type` fixed to `'bar'`).

**Properties:**
- `bins: number = 10` — finite values are floored and clamped to 0–1,000 before allocation;
  non-finite values produce no buckets
- `values: number[] = []` (attribute: false)
- `label: string = ''` — dataset label used for the legend/tooltip/accessible summary; empty (the
  default) falls back to the localized "Frequency" string
- `labels`/`datasets`/`type` are **derived, read-only** (installed as getter/setter pairs on the
  prototype; direct writes are silently ignored) — `labels`/`datasets` are computed from
  `values`/`bins` (memoized per instance, keyed by reference equality on `values` plus the
  normalized `bins`), and `type` always reads back `'bar'` regardless of any assignment. The `type`
  lock is the same `lockChartType()` accessor pair the typed `lr-*-chart` subclasses use (e.g.
  `llms/components/lr-bar-chart.md`) — `el.type = 'line'` is a genuine no-op here too.
- All other `LyraChart` properties are inherited and usable: `legend`, `legendPosition` (attribute
  `legend-position`), `valueFormatter`, `area`, `zoom`, `config`, `height`, `xLabel` (`x-label`),
  `yLabel` (`y-label`), `y2Label` (`y2-label`), `beginAtZero` (`begin-at-zero`), `horizontal`,
  `stacked`, `accessibleLabel` (`accessible-label`), `accessibleDescription`
  (`accessible-description`), `showDataTable` (`show-data-table`), `chartArea` (readonly).

**Methods:** `resetZoom()`, `refreshTheme()` — both inherited.

**Events:** `lr-zoom`, `lr-point-click` — inherited; `lr-point-click`'s `index` is the bucket index
and `label` the generated bucket range string (`"lo–hi"`, both bounds at one decimal place).

**Slots:** `data-table`, `center`.

**CSS parts:** `base`, `canvas`, `reset-zoom-button`, `description`, `data-table`, `center`,
`error` (`role="alert"` message rendered in place of `canvas` when the optional `chart.js` peer
dependency fails to load — inherited from `LyraChart`, unaffected by the binning logic).

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text` — inherited from `LyraChart`, identical in meaning.

**Optional peer deps:** the same `chart.js` (+ `chartjs-plugin-zoom` when `zoom` is set) peers.

All of the above behave exactly as documented in `llms/components/lr-chart.md` — read that file for
their semantics, defaults, and gotchas.

```html
<lr-histogram bins="12"></lr-histogram>
<script>
  document.querySelector('lr-histogram').values = [1, 2, 2, 3, 5, 5, 5, 8, 13, 13];
</script>
```

**Known gotchas:**
- `bins <= 0` no longer crashes: `binValues()` now returns an empty bucket array for `binCount <= 0`
  (or empty `values`), so the histogram just renders with no bars instead of throwing.
- excessively large finite bin counts are capped at 1,000, preventing an attribute or direct
  property write from requesting an unbounded bucket array.
- non-finite samples in `values` are dropped before bucketing rather than corrupting bucket-index
  math; constant data (every sample equal) lands wholly in the **first** bucket, not the last.

---

## `lr-box-plot`

Box-and-whisker chart from a precomputed five-number summary (no raw sample data sent to the
browser). Does **not** extend `LyraChart` — a deliberately bespoke API.

**Properties:**
- `labels: string[] = []` (attribute: false)
- `boxes: BoxPlotSeries[] = []` (attribute: false) — `BoxPlotSeries { label: string; data:
  BoxPlotPoint[]; color?: string }`, `BoxPlotPoint { min, q1, median, q3, max }`
- `legend: boolean = false`
- `height: string = '280px'`
- `yLabel: string = ''` (attribute `y-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
- `accessibleLabel: string = ''` (attribute `accessible-label`) — canvas name override; host
  `aria-label` wins
- `accessibleDescription: string = ''` (attribute `accessible-description`) — overrides the
  localized five-number summary
- `showDataTable: boolean = false` (attribute `show-data-table`) — reveals the accessible data table

**Methods:** `refreshTheme()` re-reads canvas theme custom properties after an ancestor theme change.

**Events:** none.

**Slots:** `data-table` — an optional consumer-provided accessible table alternative.

**CSS parts:** `base`, `canvas`, `description`, `data-table`, `error` (`role="alert"` message shown
instead of `canvas` when the optional box-plot peer fails to load)

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text` — same host-level mechanism, token names, and defaults as `lr-chart`
(also `getComputedStyle`-resolved on every draw), but declared in its own stylesheet, not a
re-export: `lr-box-plot` has no `zoom`, so no `reset-zoom-button` chrome exists here.

**Optional peer deps:** `@sgratzl/chartjs-chart-boxplot` (plus `chart.js` transitively, loaded
independently of the base `chart-loader.ts`).

```html
<lr-box-plot y-label="Latency (ms)"></lr-box-plot>
<script>
  const bp = document.querySelector('lr-box-plot');
  bp.labels = ['Run A', 'Run B'];
  bp.boxes = [{ label: 'p50–p99', data: [{ min: 10, q1: 20, median: 30, q3: 45, max: 90 }, { min: 12, q1: 18, median: 25, q3: 35, max: 60 }] }];
</script>
```

**Known gotchas:**
- no raw `config` passthrough — limited to the properties above; can't reach the underlying
  controller's own options (`itemRadius`, `outlierRadius`, `coef`).
- Chart.js receives `effectiveLocale`; generated numeric summaries use it, the y axis moves to
  logical start in RTL, canvas tooltip/axis colors are token-driven, and animation is disabled
  under reduced motion.
- If `@sgratzl/chartjs-chart-boxplot` fails to load, the component warns to the console and
  fails closed with a localized `role="alert"` error part rather than leaving a blank canvas.

---
## Chart streaming and export

`lr-lite-chart` and `lr-chart` expose additive imperative helpers for live dashboards:
`appendData(label, values, maxPoints?)` appends one aligned category and optionally trims the oldest
points. `lr-lite-chart.exportData('csv' | 'svg')` returns a spreadsheet-safe CSV snapshot or the
current SVG markup. `lr-chart.exportData('csv' | 'png')` returns a CSV snapshot or Chart.js's current
PNG data URL when the optional peer is loaded. These helpers do not download files; compose them
with `lr-export-button` so the host owns filenames and download policy.
