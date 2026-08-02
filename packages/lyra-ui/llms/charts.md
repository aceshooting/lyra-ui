## `lr-chart` (core)

Chart.js wrapper every other `lr-*-chart` tag subclasses; supports both a simplified
`Series`-based attribute surface and a raw Chart.js `config` passthrough (mirrors Web Awesome's
`wa-chart` `config` property).

**Properties:**
- `type: LyraChartType = 'bar'` — `LyraChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'doughnut' |
  'radar' | 'polarArea' | 'bubble'` — every type string the typed `lr-*-chart` subclasses lock `type` to is
  already a first-class member, so `<lr-chart type="pie">` needs no subclass or cast to work;
  unknown runtime attribute/property values fall back to `bar` before reaching Chart.js
- `description: string | null = null` — accessible chart description; the additive
  `accessibleDescription` remains a fallback alias
- `grid: 'x'|'y'|'both'|'none' = 'both'` — controls cartesian grid lines. On a radial chart, `x`
  controls angle lines and `y` controls concentric grid lines
- `indexAxis: 'x'|'y' = 'x'` (attribute `index-axis`) — Chart.js index axis. The additive
  `horizontal` boolean remains a positive alias for `'y'`
- `label: string | null = null` — accessible chart label. Host `aria-label` has highest precedence;
  additive `accessibleLabel` remains the fallback alias
- `max: number | null = null`, `min: number | null = null` — finite value-axis bounds. They apply to
  the cartesian value axis selected by `indexAxis`, or the radial `r` scale; non-finite writes are
  omitted before Chart.js sees them
- `plugins: object[] = []` — per-instance Chart.js plugins, combined without duplicates with Lyra's
  on-demand data-label plugin and any `config.plugins` entries
- `labels: string[] = []` (attribute: false)
- `datasets: Series[] = []` (attribute: false) — `Series { label: string; data?: (number|null)[];
  points?: ChartPoint[]; color?: string|string[]; fill?: boolean; width?: number; dash?: boolean;
  noTooltip?: boolean; axis?: 'y'|'y2'; pointColors?: string[]; pointRadius?: number|number[];
  segmentColors?: string[]; type?: 'line'|'bar' }`. Both the package root and granular chart entry
  export `ChartPoint { x: number; y: number; r?: number; label?: string }`: `r` is the bubble
  radius, and the optional per-point `label` is retained by events, CSV export, keyboard
  announcements, generated summaries, and the accessible table.
  - `pointRadius` takes a single number (applied to every point) **or** an array matching `data`'s
    length that sizes each point independently — passed straight through to Chart.js, which
    supports both natively. Useful for emphasizing a single outlier or the latest reading without
    splitting the series in two.
  - `segmentColors` colors each *segment* (the line drawn between two consecutive points) by the
    segment's **starting** point index, so `['red', 'green']` over 3 points paints the first
    segment red and the second green; a shorter array cycles. Wired to Chart.js's
    `segment.borderColor` scriptable option, so it is only meaningful for line-type series.
    Typical use is threshold/anomaly banding along one line. A series that omits it (or passes an
    empty array) emits no `segment` key at all, leaving line rendering exactly as before.
- `legend: boolean = true` — additive positive alias for the visible legend; renders a wrapping DOM
  legend whose keyboard-operable buttons toggle
  dataset visibility. The DOM surface preserves long public labels that a canvas legend would clip.
  Its pressed state honors an effective dataset's declarative `hidden` value before Chart.js is
  ready and across chart type/plugin rebuilds, while an in-place redraw preserves an explicit
  legend-button toggle.
- `legendPosition: LyraChartLegendPosition = 'top'` (attribute `legend-position`) — accepts the
  Chart.js `left|top|right|bottom|center|chartArea|{ [scaleId]: number }` positions plus logical
  `start`/`end`; the additive `auto` chooses right above 480px and bottom below that allocation
  width. Logical positions swap under RTL
- `valueFormatter?: LyraChartValueFormatter` (attribute: false) — formats numeric (value-axis)
  tick, tooltip, legend, and generated accessible-table values; the callback receives the value
  and `'tick'`, `'tooltip'`, `'legend'`, or `'table'` context. Never runs against the categorical
  x-axis's own labels (line/bar's `labels` strings) — Chart.js's category scale passes the tick
  index to `ticks.callback`, not the label text
- `area: boolean = false`
- `zoom: boolean = false` — wheel/drag/pinch zoom on the `x` axis only (pan disabled, and the zoom
  range is limited to the original data extent); shows the `reset-zoom-button` while zoomed
- `height: string = '280px'`
- `xLabel: string | null = null` (attribute `x-label`)
- `yLabel: string | null = null` (attribute `y-label`)
- `y2Label: string = ''` (attribute `y2-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
- `horizontal: boolean = false` — sets `options.indexAxis = 'y'`, Chart.js's own mechanism for
  horizontal bars (also flips `line`/`area` types onto a horizontal category axis)
- `stacked: boolean = false` — stacks the `x`/`y`(/`y2`) scale entries `buildScales()` returns; only
  meaningful for `bar`/`line` types (scatter/bubble's linear `x` scale and the radial `r` scale used
  by radar/polar-area are out of scope)
- `withoutAnimation: boolean = false` (attribute `without-animation`, reflected) — disables Chart.js
  construction animation; reduced-motion preference also disables it regardless of this value
- `withoutLegend: boolean = false` (attribute `without-legend`, reflected) — hides the legend;
  it wins over the positive `legend` alias
- `withoutTooltip: boolean = false` (attribute `without-tooltip`, reflected) — disables the
  Chart.js tooltip plugin for this instance
- `dataLabels: boolean = false` (attribute `data-labels`) — draws each point's value on the chart via
  the optional `chartjs-plugin-datalabels` peer (see `peers.md`). Unset (the default) leaves labels
  off; because the plugin is registered **per chart instance** (not globally), a `<lr-chart
  data-labels>` never affects any other chart on the page. If the peer is not installed the chart
  still renders and the attribute is inert, with one `console.warn`. The screen-reader equivalent is
  the always-present accessible data table (`show-data-table` makes it visible) — labels are a
  purely visual, canvas-only addition and add no new a11y surface.
- `stackTotals: boolean = false` (attribute `stack-totals`) — with `stacked` (bar/line only), draws
  the per-category stack total above each stack, via the same `chartjs-plugin-datalabels` peer.
  Null/undefined points are skipped; a category whose every value is null shows no total (not
  `0`). The generated accessible table receives the same formatted total column; a dual-axis stack
  receives separately labelled primary- and secondary-axis total columns. The table totals do not
  depend on the optional visual-label peer being installed
- `config?: Partial<ChartConfiguration>` (attribute: false) — deep-merged over the generated
  config; any nested key wins without clobbering sibling generated keys. This is the raw Chart.js
  escape hatch, so a caller-supplied `config.type` is passed through rather than normalized.
  Explicit `config.data.labels` and `config.data.datasets` arrays are authoritative independently:
  an omitted member still comes from the simplified `labels`/`datasets` properties, while an
  explicit array replaces that generated member rather than concatenating with it. This effective
  model drives canvas rendering, `appendData()`, export, the accessible name/summary, keyboard
  navigation and activation events, the DOM legend, and the generated fallback table.
  As a declarative alternative, place one `<script type="application/json">` in the default slot;
  an explicitly assigned `config` property wins over the slotted object. Invalid/non-object JSON is
  ignored without evaluating script or exposing prototype-pollution keys to the merge.
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
  keeps only the newest `maxPoints`. Each labels/datasets member is written back to the surface
  that owns it: an explicitly overridden `config.data` member stays in `config`, while an omitted
  member continues through the simplified property and retains its generated Chart.js styling.
  Point-based scatter/bubble series are left unchanged because appending their x/y/r coordinates
  needs a richer caller-defined contract.

**Methods:** `resetZoom()` resets any active zoom/pan to the original view. `refreshTheme()` forces
a redraw so the `--lr-chart-*` tokens below are re-read from the current computed style. A
built-in `ThemeWatcher` now calls this automatically when `prefers-color-scheme` flips or an
ancestor's `class`/`style`/`data-theme`/`data-color-scheme` attribute mutates — the most common
theme-toggle mechanisms — so a consumer rarely needs to call it by hand; it remains public as the
escape hatch for theme changes those signals can't observe. Canvas redraw remains visibility-gated;
when a DOM legend is present its computed swatch colors are refreshed too.
`exportData('csv' | 'png')` returns a spreadsheet-safe CSV snapshot or the current PNG data URL
when Chart.js is loaded. Numeric datasets retain the compact one-column-per-series CSV shape.
Point datasets expand into `<series> x`, `<series> y`, and, when present, `<series> r` and
`<series> label` columns so radius and per-point labels are not flattened away.

**The categorical series ramp.** Eight tokens, `--lr-color-chart-1` … `--lr-color-chart-8`, with a
separate set of values for light and dark mode. A series that sets no `color` of its own is assigned
one of them by index.

The ramp is **generated, not hand-picked**, by a search that maximises worst-case separation between
every pair of series under all three dichromacies, over a candidate pool that already clears 3:1
against the surface (WCAG 1.4.11 — a chart series is a non-text graphical object conveying data).
The consequence worth designing around: the ramp separates on **lightness** as well as hue. Hue is
exactly the channel colour-vision deficiency collapses, so two series that differ only in hue become
the same series under red-green colour blindness; lightness is the channel every form of colour
blindness preserves. That is also why the eight colours are not evenly lit — an evenly-lit
categorical ramp cannot satisfy the constraint at all.

The separation guarantee is *pairwise across all eight*, so any subset of the ramp — and any
ordering of it — inherits it; you can pick entries 1 and 5 as freely as 1 and 2. What forfeits the
guarantee is supplying your own colours through `Series.color` or replacing the ramp with a set
chosen by hue alone. An eight-hue set at one lightness looks tidier on screen and is unreadable to
the ~8% of men with red-green colour-vision deficiency.

**`--lr-theme-color-chart-1` … `-8` is the retheme hook.** Each internal `--lr-color-chart-N` reads
the matching `--lr-theme-color-chart-N` application input and falls back to the generated value, so
setting the theme inputs once at `:root` recolours every chart in the app with no per-component
override and no `::part()` rule. Charts are canvas-rendered, so a live theme change is picked up by
the built-in `ThemeWatcher` (or `refreshTheme()`) rather than by CSS alone.

Under `forced-colors: active` the ramp deliberately collapses onto the three system colors the mode
actually guarantees (`Highlight`/`LinkText`/`CanvasText`, cycling), so more than three series stop
being distinguishable by colour there — a chart that must stay readable in forced colors needs a
non-colour channel (dashes, point styles, direct labels via `dataLabels`) as well.

The instance method `seriesPalette(): string[]` resolves that ramp through `getComputedStyle` and
returns the concrete, theme-aware colors — the exact same values the chart hands an uncolored
series, with any `--lr-theme-color-chart-*` override already applied.

The module also exports `seriesPalette(scope?: Element | null): string[]`, which can run before a
chart exists. Omit `scope` to read `document.documentElement`, pass an element to resolve its theme
scope, or pass `null` to request the light-mode fallback directly. When a scope has no component
token layer yet, the helper reads the `--lr-theme-color-chart-N` inputs directly. Both forms return
a fresh eight-color array each call (safe to mutate) and let chart-adjacent UI, KPI tiles, or the
`Series` array itself come from one source of truth.

```ts
import { seriesPalette } from '@aceshooting/lyra-ui/components/charts/chart/chart.js';

const colors = seriesPalette();
const series = [
  { label: 'Revenue', data: [12, 19], color: colors[0] },
  { label: 'Costs', data: [7, 11], color: colors[1] },
];
```

**Events:** `lr-zoom` (`detail: { zoomed: boolean }`, fired on zoom-complete and on
`resetZoom()`), `lr-point-click` (fired when pointer input lands on an intersecting data
point/segment, when a generated-table value is activated, or when Enter/Space activates the
keyboard-current canvas datum; `detail: { datasetIndex: number, index: number, label: string |
undefined, value: unknown }`). For scatter/bubble points, `label` prefers the per-point label and
`value` is the complete `ChartPoint`, including optional `r` and `label`.

**Slots:** default — one optional `<script type="application/json">` Chart.js configuration;
`data-table` — an optional consumer-provided accessible table alternative; `center` —
optional overlay content positioned at the chart area's center, useful for doughnut and pie totals.

**CSS parts:** `base`, `plot` (the fixed-height canvas/overlay region), `canvas`, `legend` (the
wrapping DOM legend), `legend-item` (a dataset-visibility button), `legend-swatch`,
`reset-zoom-button`, `description`, `data-table`, `center` (the chart-area-centered wrapper for the
`center` slot), `error` (`role="alert"` message rendered in place of `canvas` when the optional
`chart.js` peer dependency fails to load)

**Themeable custom properties:** `--lr-chart-height` (set programmatically on the host from the
`height` property; sizes the `plot` region and the host's minimum block size, while a visible table
or wrapping legend grows the host in normal flow — it must be read from the host, not a shadow-tree
descendant, since custom properties only cascade downward);
`--lr-chart-grid-color` (default `var(--lr-color-border)`),
`--lr-chart-tick-color` (default `var(--lr-color-text-quiet)`), `--lr-chart-legend-color`
(default `var(--lr-color-text)`), `--lr-chart-tooltip-bg` (default `var(--lr-color-surface)`),
`--lr-chart-tooltip-text` (default `var(--lr-color-text)`) — each resolved fresh via
`getComputedStyle` on every draw (Chart.js renders to canvas, not the DOM, so it can't consume CSS
`var()` directly), driving the grid lines, tick labels **and axis titles** (`xLabel`/`yLabel`/
`y2Label` title text reuses `--lr-chart-tick-color` too — there's no separate title-color token),
legend text, and tooltip background/text respectively; plus
`--lr-chart-canvas-hover-outline-width` (default `var(--lr-border-width-thin)`) — the width of
`[part="canvas"]`'s own `:hover` outline. Unlike the tokens above, this one is a real CSS
declaration on a DOM element (the outline is painted by the stylesheet, not by Chart.js), so it is
consumed directly with no `getComputedStyle` bridging; it is an inline `var()` fallback at the point
of use, so it can be set on the element or any ancestor, and left unset the outline is exactly the
`--lr-border-width-thin` it always was. Plus shared `--lr-space-xs`.

The mirrored Chart styling hooks are also available on all nine tags. All canvas-bound values are
resolved to concrete colors/CSS-pixel numbers on every draw; `rem` uses the live root font size and
`em` uses the chart's own font size rather than a hard-coded conversion.

- `--border-color-1`, `--border-color-2`, `--border-color-3`, `--border-color-4`,
  `--border-color-5`, `--border-color-6` — first six dataset/slice stroke colors, each falling back
  to matching `--lr-color-chart-N`
- `--fill-color-1`, `--fill-color-2`, `--fill-color-3`, `--fill-color-4`, `--fill-color-5`,
  `--fill-color-6` — first six dataset/slice fill colors, with the same Lyra
  palette fallbacks. A directly authored fill is used as-is; an unoverridden line-area fallback
  retains Lyra's translucent area treatment
- `--border-radius` → `--lr-radius`; `--border-width` → `--lr-border-width-thin`
- `--grid-border-width` → `--lr-border-width-thin`; `--grid-color` →
  `--lr-chart-grid-color`
- `--line-border-width` → `--lr-border-width-medium`; `--point-radius` → `--lr-space-2xs`

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
  property values fall back to `bar`. Each typed `lr-*-chart` subclass (e.g.
  `llms/components/lr-bar-chart.md`) locks its *own* `type` via a real prototype accessor — a
  genuine runtime lock, not just a compile-time default.
- a built-in `ThemeWatcher` automatically rethemes an already-drawn chart when
  `prefers-color-scheme` flips or an ancestor's `class`/`style`/`data-theme`/`data-color-scheme`
  attribute mutates (coalesced to one redraw). `refreshTheme()` stays public for out-of-band theme
  changes those signals can't observe.
- the focusable canvas is an interactive `application`, not a static image: Arrow keys move through
  finite data, Home/End jump to the endpoints, and Enter/Space activates the current datum. Its
  localized `aria-roledescription` identifies the application as a chart; the generated table is
  the non-canvas alternative.
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
  construction-time animation is additionally skipped when `without-animation` is set or under
  `prefers-reduced-motion: reduce`.
  The raw `config` passthrough is deep-merged with `__proto__`/`constructor`/`prototype` keys skipped
  unconditionally, so a JSON-sourced `config` (e.g. parsed from an API response) can't reach up and
  pollute `Object.prototype` through the merge.
- lazy-redraw + change gating: an `IntersectionObserver` gates `draw()` — while the host is scrolled
  off-screen, property changes that would otherwise trigger a Chart.js redraw are skipped (and a
  single redraw fires once it re-enters the viewport). Independently, `updated()` only reaches
  Chart.js when at least one of `type`, `labels`, `datasets`, `description`, `grid`, `indexAxis`,
  `label`, `legend`, `legendPosition`, `min`, `max`, `plugins`, the internal resolved auto legend
  position, `valueFormatter`, `area`, `height`, `xLabel`, `yLabel`, `y2Label`, `beginAtZero`,
  `horizontal`, `stacked`, any `without*` control, `dataLabels`, `stackTotals`, `config`, the parsed
  slotted config, `zoom`, `locale`, `strings`, or the internal loading state actually changed in
  that update (so an
  unrelated property/state update, or a bare `requestUpdate()`, draws nothing). Resize callbacks
  ignore unchanged inline sizes and coalesce into one animation-frame task; a responsive legend
  position change and its reactive update share that same single redraw. `refreshTheme()`, resize,
  optional-plugin completion, and histogram data changes all use the same connected/visible gate.
  A theme refresh may still rerender the cheap DOM legend while off-screen so its computed swatches
  do not go stale, but it does not repaint the canvas there.
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
  (number|null)[]; color?: string }`; `color` accepts a valid CSS `color`, while invalid values,
  declaration-breaking input, and `url()` paint servers fall back to the built-in palette
- `legend: boolean = false`
- `height: string = '280px'` — accepts a valid CSS `height`; invalid values, declaration-breaking
  input, and `url()` leave the stylesheet's `--lr-chart-height` default/consumer override in control
- `xLabel: string = ''` (attribute `x-label`)
- `yLabel: string = ''` (attribute `y-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
- `stacked: boolean = false` — sums each category's bars into one segmented bar instead of grouping
  them side by side; ignored for `type="line"`
- `tickFormat?: (value: number) => string` (attribute: false) — formats a y-axis tick value for
  display (e.g. `(v) => \`$${v.toFixed(2)}\`` for currency, or a duration formatter for `"42s"`).
  Falls back to the built-in "nice numbers" formatter when unset.
- `tableCellFormatter?: LyraLiteChartTableCellFormatter` (attribute: false) — formats each finite
  numeric cell in the built-in multi-series accessible table. The callback receives `(value,
  context)`, where `context` is `{ kind: 'value' | 'total'; datasetIndex: number | null; index:
  number; label: string; seriesLabel: string | null }`; total cells have `datasetIndex` and
  `seriesLabel` set to `null`. Unset cells retain locale-aware `Intl.NumberFormat` output.
- `tableTotals: boolean = false` (attribute `table-totals`) — adds a localized total column to the
  multi-series accessible table when `type="bar"` and `stacked` are both active. Ignored for
  grouped bars, line charts, and the single-series `data-list`.
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
  the rest between them. Works in either `layout` mode. Unset (the default) renders every label.
  Each rendered category label is allocation-aware: narrow/long text is ellipsized before paint,
  with the complete caller label retained as its accessible name.
- `barX?: (index: number) => number` (attribute: false, bar type only) — overrides the internal
  per-category x-origin formula (`plotX + i * slot`) used by both bars and their axis labels, so a
  consumer can pixel-align this chart's bars with a sibling `<lr-heatmap>` calendar's week columns
  (see that component's own `columnX`) by supplying the same coordinate function to both. Unset (the
  default) is the original formula, unchanged.
- `pointText?: (label: string, value: number, datasetIndex: number) => string` (attribute: false) —
  overrides the per-bar/per-point native SVG `<title>` text (mirrors `lr-heatmap`'s `cellText`).
  The same text is written to `aria-label`, because WebKit accessibility APIs do not consistently
  derive an ARIA command name from an SVG `<title>`; the title remains the native browser tooltip.
  Falls back to the built-in raw-value template when unset.
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
- `selectedIndex: number[] = []` (attribute: false) — applies to every interactive data mark for
  both `type="bar"` and `type="line"`: matching bars and line points receive `data-selected` and
  explicit `aria-pressed="true"`; all other marks render `aria-pressed="false"`. For a multi-series
  chart, the category index selects the matching mark in every dataset. Empty is the default.
  Style the built-in highlight through `--lr-lite-chart-selected-outline-color`. Note
  `::part(bar)[data-selected]` and `::part(point)[data-selected]` are **invalid CSS** — Shadow Parts
  forbids an attribute selector after `::part()` — so they silently never match; the outline is
  painted inside the shadow root and exposed through that token instead.
- `minBarHeight?: number` (attribute `min-bar-height`) — optional minimum visible bar height for
  small non-zero values
- `accessibleLabel?: string` (attribute `accessible-label`) — SVG accessible-name override; a host
  `aria-label` wins
- `appendData(label, values, maxPoints?)` — appends one aligned category and optionally trims the
  oldest categories

**Events:** `lr-point-click` — fired for bars and line points on pointer activation or Enter/Space
while focused. `detail: { datasetIndex: number, index: number, label: string | undefined, value:
number | null }` — same shape as `lr-chart`'s `lr-point-click`. When different series' expanded
line-point targets overlap, pointer activation selects the closest rendered point in two-dimensional
screen space; an exact distance tie retains the point whose target received the click.

**Methods:** `exportData('csv' | 'svg')` returns a spreadsheet-safe CSV snapshot or the current SVG
markup. The method does not download a file; pair it with `lr-export-button` for download UX.

The axis gutter/title and y-axis labels mirror to logical start under RTL. Built-in mark summaries
are complete localized templates and format values with `effectiveLocale`.

**Performance:** `render()` recomputes the grid/marks on every update rather than memoizing against a
content signature — `datasets`/`labels` can hold callbacks (`tickFormat`, `barX`) or arbitrary,
possibly circular or BigInt-bearing application data that a fingerprint can't serialize safely, so a
fresh, small SVG render is cheaper and more correct than a lossy cache.

**Slots:** none.

**CSS parts:** `base`, `grid-line`, `axis-label`, `axis-title`, `bar` and `point` (each carries
`data-selected` when its category index is in `selectedIndex`, with explicit pressed state on every
mark), `line`, `legend`, `legend-item`, `legend-swatch`, `legend-text` (extra per-item text after
the series label, rendered only when `legendText` is set), `live-region` (the current mark
announcement for keyboard users), `data-list` (a visually hidden list of all plotted data points —
single-series only), `data-table` (a visually hidden category×series data table, rendered instead
of `data-list` when there is more than one dataset).

**Screen-reader data alternative:** a single dataset renders the flat `data-list` (one `<li>` per
plotted point, matching the roving-tabindex mark order). More than one dataset instead renders a
`data-table` — a category-labelled `<caption>` (the shared localized `chartData` string), one
`<th scope="col">` per series (plus a leading `chartCategory` corner header), and one
`<th scope="row">` per category label with its per-series values in the body — so a screen-reader
user hears the values grouped by series rather than one flattened N×M sequence.
Finite table cells use `tableCellFormatter` when supplied and otherwise use the component's
effective locale. A stacked multi-series bar chart with `tableTotals` adds a localized total
column; null/non-finite inputs are skipped, while an all-missing category leaves the total cell
blank instead of reporting a misleading zero.

**Themeable custom properties:** `--lr-chart-height` (same host-level property as `lr-chart`);
`--lr-chart-grid-color`, `--lr-chart-tick-color`, `--lr-chart-legend-color` — same token
*names* as `lr-chart`, so a host already theming `lr-chart` themes this for free;
`--lr-chart-color-1` … `--lr-chart-color-8` (each defaulting to the matching
`var(--lr-color-chart-N)` ramp entry) — the per-series colors, so one element can be recolored
without moving the library-wide ramp; `--lr-lite-chart-selected-outline-color` (default
`var(--lr-color-brand)`) — the stroke drawn on
selected `[part='bar']` and `[part='point']` marks whose category index is in `selectedIndex`.
Unlike `lr-chart` (canvas-rendered, needs `getComputedStyle`-based re-theming on every draw), this
is plain SVG/DOM and reads these via native CSS `var()` — no JS-side resolution step, and no
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
- Series colors default to the shared categorical ramp (round-robin by dataset index) when `color`
  is unset or invalid — the same eight `--lr-color-chart-1..8` tokens `lr-chart` uses, so both
  chart implementations agree on the palette and both follow a `--lr-theme-color-chart-*` retheme.
  Being plain SVG, they resolve through native `var()` at paint time, so a theme or color-scheme
  change needs no JS-side redraw pass here.
- Bar/point elements are real focusable DOM nodes (`role="button"` with one roving `tabindex="0"`);
  each carries the same localized text as an explicit `aria-label` and native SVG `<title>`, giving
  every engine a command name while retaining the tooltip. The `<svg>` itself uses
  `role="group"`, not `role="img"` — an image role would conflict with genuinely interactive
  descendants (axe's `nested-interactive` rule).
- Dense transparent hit regions expand toward 24px only while remaining inside the neighboring
  mark's midpoint lane; stacked segments keep their own vertical region. This prevents a
  later-painted mark from stealing pointer input from an adjacent datum. Cross-series line targets
  are additionally arbitrated by two-dimensional screen distance.
- In narrow allocations, category labels are ellipsized to their available lane and retain the
  complete label through `aria-label`; SVG overflow is contained within the host.
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

**Properties:** `description`, `grid`, `indexAxis` (`index-axis`), `label`, `legendPosition`
(`legend-position`), `max`, `min`, `plugins`, `stacked`, `withoutAnimation` (`without-animation`),
`withoutLegend` (`without-legend`), `withoutTooltip` (`without-tooltip`), `xLabel` (`x-label`),
`yLabel` (`y-label`), plus additive `labels`, `datasets`, `legend`, `valueFormatter`, `area`, `zoom`,
`height`, `y2Label` (`y2-label`), `beginAtZero` (`begin-at-zero`), `horizontal`, `dataLabels`
(`data-labels`), `stackTotals` (`stack-totals`), `config`, `accessibleLabel`
(`accessible-label`), `accessibleDescription` (`accessible-description`), `showDataTable`
(`show-data-table`), `chartArea` (readonly). `type` is the only member that differs: read-only,
locked to this tag's value.

**Methods:** `appendData(label, values, maxPoints?)`, `exportData('csv' | 'png')`, `resetZoom()`,
`refreshTheme()`.

**Events:** `lr-zoom` (`detail: { zoomed: boolean }`), `lr-point-click` (`detail: { datasetIndex,
index, label, value }`).

**Slots:** default JSON configuration script, `data-table`, `center`.

**CSS parts:** `base`, `plot`, `canvas`, `legend`, `legend-item`, `legend-swatch`,
`reset-zoom-button`, `description`, `data-table`, `center`, `error` (`role="alert"` message
rendered in place of `canvas` when the optional `chart.js` peer dependency fails to load — see
`llms/components/lr-chart.md`).

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text`, `--lr-chart-canvas-hover-outline-width` — all inherited from `LyraChart`,
identical in meaning and default (see `lr-chart` above); each of the eight variants below reads the
same set, so one rule retunes them together. The mirrored hooks are `--border-color-1`,
`--border-color-2`, `--border-color-3`, `--border-color-4`, `--border-color-5`,
`--border-color-6`, `--fill-color-1`, `--fill-color-2`, `--fill-color-3`, `--fill-color-4`,
`--fill-color-5`, `--fill-color-6`, `--border-radius`, `--border-width`, `--grid-border-width`,
`--grid-color`, `--line-border-width`, and `--point-radius`, also identical to the core chart.

**Optional peer deps:** same as `lr-chart` — `chart.js`, plus `chartjs-plugin-zoom` only once
`zoom` is set, and `chartjs-plugin-datalabels` only once `data-labels`/`stack-totals` is set.

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
- `lr-bubble-chart` consumes the exported `ChartPoint` shape directly. Set `x`/`y`, optional `r`
  for bubble radius, and optional `label` for the point-level accessible/event/export label; no
  runtime cast is needed.

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
- All other `LyraChart` properties are inherited and usable: `description`, `grid`, `indexAxis`
  (`index-axis`), `legend`, `legendPosition` (`legend-position`), `max`, `min`, `plugins`,
  `withoutAnimation` (`without-animation`), `withoutLegend` (`without-legend`), `withoutTooltip`
  (`without-tooltip`), `valueFormatter`, `area`, `zoom`, `config`, `height`, `xLabel` (`x-label`),
  `yLabel` (`y-label`), `y2Label` (`y2-label`), `beginAtZero` (`begin-at-zero`), `horizontal`,
  `stacked`, `dataLabels` (`data-labels`), `stackTotals` (`stack-totals`), `accessibleLabel`
  (`accessible-label`), `accessibleDescription` (`accessible-description`), `showDataTable`
  (`show-data-table`), `chartArea` (readonly).

**Methods:** `resetZoom()`, `refreshTheme()` — both inherited; plus
`appendData(_label, values, maxPoints?)`, which appends finite raw samples to `values` and
optionally retains only the newest `maxPoints`. The label argument is ignored because bucket
labels are regenerated from the rebinned sample range.

**Events:** `lr-zoom`, `lr-point-click` — inherited; `lr-point-click`'s `index` is the bucket index
and `label` the generated bucket range string (`"lo–hi"`, both bounds at one decimal place).

**Slots:** default JSON configuration script, `data-table`, `center`.

**CSS parts:** `base`, `plot`, `canvas`, `legend`, `legend-item`, `legend-swatch`,
`reset-zoom-button`, `description`, `data-table`, `center`, `error` (`role="alert"` message
rendered in place of `canvas` when the optional `chart.js` peer dependency fails to load —
inherited from `LyraChart`, unaffected by the binning logic).

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text`, `--lr-chart-canvas-hover-outline-width` — inherited from `LyraChart`,
identical in meaning, together with the mirrored `--border-color-1`, `--border-color-2`,
`--border-color-3`, `--border-color-4`, `--border-color-5`, `--border-color-6`, `--fill-color-1`,
`--fill-color-2`, `--fill-color-3`, `--fill-color-4`, `--fill-color-5`, `--fill-color-6`,
`--border-radius`, `--border-width`, `--grid-border-width`, `--grid-color`,
`--line-border-width`, and `--point-radius` hooks listed on the core chart.

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
- `values`/`bins`/`label` changes join the inherited connected-and-visible redraw path. There is no
  second post-update refresh, so a same-tick disconnect cannot recreate Chart.js on a detached
  canvas and off-screen sample updates do not repaint it.

---

## `lr-box-plot`

Box-and-whisker chart from a precomputed five-number summary (no raw sample data sent to the
browser). Does **not** extend `LyraChart` — a deliberately bespoke API.

**Properties:**
- `labels: string[] = []` (attribute: false)
- `boxes: BoxPlotSeries[] = []` (attribute: false) — `BoxPlotSeries { label: string; data:
  BoxPlotPoint[]; color?: string }`, `BoxPlotPoint { min, q1, median, q3, max }`
- `legend: boolean = false` — renders a wrapping DOM legend whose buttons toggle box-series
  visibility without clipping long labels.
- `height: string = '280px'`
- `yLabel: string = ''` (attribute `y-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
- `accessibleLabel: string = ''` (attribute `accessible-label`) — canvas name override; host
  `aria-label` wins
- `accessibleDescription: string = ''` (attribute `accessible-description`) — overrides the
  localized five-number summary
- `showDataTable: boolean = false` (attribute `show-data-table`) — reveals the accessible data table

**Methods:** `refreshTheme()` re-reads canvas theme custom properties after an ancestor theme
change. Canvas work remains connected/visible-gated, while a rendered DOM legend also refreshes
its computed color swatches.

**Events:** none.

**Slots:** `data-table` — an optional consumer-provided accessible table alternative.

**CSS parts:** `base`, `plot` (the fixed-height canvas region), `canvas`, `legend`,
`legend-item`, `legend-swatch`, `description`, `data-table`, `error` (`role="alert"` message shown
instead of `canvas` when the optional box-plot peer fails to load)

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text` — same host-level mechanism, token names, and defaults as `lr-chart`
(also `getComputedStyle`-resolved on every draw), but declared in its own stylesheet, not a
re-export: `lr-box-plot` has no `zoom`, so no `reset-zoom-button` chrome exists here. A `BoxPlotSeries`
that sets no `color` is assigned an entry from the same `--lr-color-chart-1..8` ramp `lr-chart` uses,
so `--lr-theme-color-chart-*` retheming reaches box plots too.

**Optional peer deps:** `@sgratzl/chartjs-chart-boxplot` plus `chart.js`; Chart.js is obtained
through the same cached `chart-loader.ts` used by `lr-chart`.

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
  logical start in RTL, and live ancestor `lang`/`dir` changes redraw the already-mounted canvas
  without requiring another box property write. Canvas tooltip/axis colors are token-driven, and
  animation is disabled under reduced motion.
- `--lr-chart-height` fixes the `plot` height and the host's minimum height, not the complete host.
  A visible or slotted table and the wrapping legend remain in normal document flow, grow the
  component, and cannot overlap following content; oversized tables scroll inside the host.
- If `@sgratzl/chartjs-chart-boxplot` fails to load, the component warns to the console and
  fails closed with a localized `role="alert"` error part rather than leaving a blank canvas.

---
## Chart streaming and export

`lr-lite-chart` and `lr-chart` expose additive imperative helpers for live dashboards:
`appendData(label, values, maxPoints?)` appends one aligned category and optionally trims the oldest
points. `lr-histogram` retains the same method signature but treats `values` as finite raw samples,
ignores the category label, rebins the complete retained sample window, and applies `maxPoints` to
that raw history. `lr-lite-chart.exportData('csv' | 'svg')` returns a spreadsheet-safe CSV snapshot
or the current SVG markup. `lr-chart.exportData('csv' | 'png')` returns a CSV snapshot or Chart.js's
current PNG data URL when the optional peer is loaded; point datasets expand x/y and optional
radius/point-label columns. These helpers do not download files; compose them with
`lr-export-button` so the host owns filenames and download policy.
