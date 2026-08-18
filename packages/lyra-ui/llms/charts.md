## Breaking changes in 9.0.0

Breaking changes in this release (v9): `<lr-chart>` and `<lr-box-plot>` drop the deprecated
`accessible-label`/`accessible-description` attributes and `accessibleLabel`/`accessibleDescription`
properties — use the mirrored `label`/`description` instead (identical semantics, just renamed).
`<lr-box-plot>` drops the deprecated `boxes` property — use `datasets`. `<lr-lite-chart>` drops three
deprecated aliases: `pad-left`/`padLeft` (use `value-axis-gutter`/`valueAxisGutter`), `hide-axis`/
`hideAxis` (use `without-value-axis`/`withoutValueAxis`), and `selectedIndex` (use the grammatically
plural `selectedIndices`, which was already the canonical property). `<lr-chart>` drops its redundant
positive-polarity `legend` property/attribute, which duplicated `withoutLegend`/`without-legend` — the
legend now shows by default and is hidden only with `without-legend`; remove any `legend` attribute
from markup (it is now a no-op host attribute) and any `el.legend = true` from code (`<lr-box-plot>`
and `<lr-lite-chart>` are unaffected — their own `legend` property is each component's only visibility
toggle, not a duplicate). The deprecated type aliases `ChartPoint`, `Series` (superseded by
`LyraChartPoint`/`LyraChartSeries`), `BoxPlotPoint`, `BoxPlotSeries` (superseded by
`LyraBoxPlotSummary`/`LyraBoxPlotSeries`), and `LiteSeries` (superseded by `LyraLiteChartSeries`) are
removed — update TypeScript imports to the canonical `Lyra*`-prefixed names. The internal
`lockChartType` helper is no longer exported from the public `chart.ts` entry point; it is now used
solely by `<lr-histogram>` to keep its `type` fixed to `'bar'` — every other `lr-*-chart` subclass
keeps its `type` writable, matching its mirrored WA counterpart. `chart-loader.ts`'s v8 compatibility
facade is removed; `./components/charts/chart/chart-core-loader.js` and
`./components/charts/chart/chart-feature-loader.js` are now the real public entry points.

Non-breaking: `<lr-histogram>`'s `appendData()` is no longer marked deprecated; prefer the
histogram-specific `appendSamples(values, maxSamples?)` for new code. `<lr-lite-chart>`'s legend is
documented as a static color key with no interactive dataset-visibility toggle, matching its scope as
the lightweight chart variant; its own `accessibleLabel`/`accessible-label` property is unaffected by
the `lr-chart`/`lr-box-plot` removal above.

## `lr-chart` (core)

Chart.js wrapper used directly and by the eight typed Chart.js tags plus `lr-histogram`;
`lr-lite-chart` and `lr-box-plot` are independent implementations. It supports both a simplified
series surface and a raw Chart.js `config` passthrough (mirrors Web Awesome's `wa-chart` `config`
property).

**Properties:**
- `type: LyraChartType = 'bar'` — `LyraChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'doughnut' |
  'radar' | 'polarArea' | 'bubble'` — every named default used by a typed `lr-*-chart` is
  already a first-class member, so `<lr-chart type="pie">` needs no subclass or cast to work;
  unknown runtime attribute/property values fall back to `bar` before reaching Chart.js
- `description: string | null = null` — accessible chart description
- `grid: 'x'|'y'|'both'|'none' = 'both'` — controls cartesian grid lines. On a radial chart, `x`
  controls angle lines and `y` controls concentric grid lines
- `indexAxis: 'x'|'y' = 'x'` (attribute `index-axis`) — Chart.js index axis. `'y'` is Chart.js's own
  mechanism for horizontal bars (it also flips `line`/`area` types onto a horizontal category axis).
  The `horizontal` boolean that used to alias `'y'` was removed in 9.0.0 — use `index-axis="y"`
- `label: string | null = null` — accessible chart label. Host `aria-label` has highest precedence
  by presence, including an explicit empty string
- `max: number | null = null`, `min: number | null = null` — finite value-axis bounds. They apply to
  the cartesian value axis selected by `indexAxis`, or the radial `r` scale; non-finite writes are
  omitted before Chart.js sees them
- `annotations: readonly LyraChartAnnotation[] = []` (attribute: false) — declarative reference
  lines and shaded bands: a threshold, an event year, a regime change, a highlighted period.
  `LyraChartAnnotation { axis?: 'x' | 'y'; value?: number; from?: number; to?: number; label?:
  string; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' }`. A finite `value` renders
  a reference line on that axis; a finite `from`/`to` pair renders a band bounded on that axis and
  spanning the other. `axis` defaults to `'y'`. An entry with neither (or non-finite numbers) is
  dropped rather than handed to Chart.js; a reversed range is normalized. Labelled entries are
  included in the generated accessible description, mirroring `lr-heatmap` — the label is
  consumer-supplied text and so is not localized, and an unlabelled line has no nameable meaning to
  announce. Needs the optional `chartjs-plugin-annotation` peer, loaded on first actual demand, so a
  page with no annotated charts never downloads it; without it the chart still renders and a single
  console warning explains the no-op. The plugin is registered globally, like `chartjs-plugin-zoom`
  and unlike `chartjs-plugin-datalabels`: it draws nothing unless a chart supplies annotation
  options, so the registration is unobservable to charts that set none, and registration is also
  what installs the plugin's own element defaults
- `scaleType: 'linear' | 'logarithmic' = 'linear'` (attribute `scale-type`, type
  `LyraChartScaleType`) — scale type for the **value** axis; the categorical axis is never
  affected. `'logarithmic'` plots data spanning several orders of magnitude (prices, latency
  percentiles, file sizes) honestly, where a linear axis collapses everything below the maximum
  into the baseline. Inherited by `lr-line-chart`, `lr-scatter-chart` and `lr-bar-chart`, and
  applied to the secondary `y2` axis too when one is present. A logarithmic axis cannot represent
  zero (`log(0)` is `-Infinity`), so `beginAtZero` is not forwarded in that mode and non-positive
  points are dropped by Chart.js's own log scale. Chart.js rejects an unregistered scale type at
  construction, so `LogarithmicScale` is registered with the core — it ships inside the `chart.js`
  module already loaded, adding no download weight
- `plugins: LyraChartPlugin[] = []` — peer-neutral per-instance Chart.js plugin structures,
  combined without duplicates with Lyra's
  on-demand data-label plugin and any `config.plugins` entries
- `labels: readonly string[] = []` (attribute: false)
- `datasets: readonly LyraChartSeries[] = []` (attribute: false) — `LyraChartSeries { readonly
  label: string; readonly data?: readonly (number|null)[]; readonly points?: readonly
  LyraChartPoint[]; readonly color?: string|readonly string[]; ... }`. The deprecated `Series` and
  `ChartPoint` names remain aliases for migration. `LyraChartPoint { readonly x: number; readonly
  y: number; readonly r?: number; readonly label?: string }`: `r` is the bubble
  radius, and the optional per-point `label` is retained by events, CSV export, keyboard
  announcements, generated summaries, and the accessible table. Point wording is localized as
  whole messages: `chartPointCoordinates`, `chartBubblePointCoordinates`, and
  `chartLabeledPoint` own coordinate names, order, separators, and the label wrapper. A caller's
  point label is interpolated verbatim rather than translated or parsed.
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
- `hiddenDatasets?: readonly number[]` (attribute: false) — complete controlled DOM-legend
  visibility state. Leave it `undefined` (the default) to honor each effective dataset's declarative
  `hidden` value; pass `[]` to deliberately show every dataset, or a canonical list of zero-based
  indexes to hide those datasets. A defined value wins over the declarative defaults. Duplicate,
  non-integer, negative, and out-of-range indexes are discarded. The component writes the accepted
  legend-toggle snapshot back to this property so a host can persist it, and a programmatic write
  reconciles Chart.js and the DOM legend silently without emitting either legend-visibility event.
- `withoutLegend: boolean = false` (attribute `without-legend`) — the legend shows by default;
  set this to hide it. Renders a wrapping DOM legend (when shown) whose keyboard-operable buttons
  toggle dataset visibility. The DOM surface preserves long public labels that a canvas legend
  would clip. Its pressed state follows `hiddenDatasets` whenever that controlled snapshot is
  defined, otherwise the effective dataset's declarative `hidden` value before Chart.js is ready
  and across chart type/plugin rebuilds.
- `legendPosition: LyraChartLegendPosition = 'top'` (attribute `legend-position`) — accepts the
  Chart.js `left|top|right|bottom|center|chartArea|{ [scaleId]: number }` positions plus logical
  `start`/`end`; the additive `auto` chooses right above 480px and bottom below that allocation
  width. Logical positions swap under RTL, and a literal `left`/`right` stays on the physical edge
  it names in both directions — the rendered DOM legend honors both, so `legend-position="start"`
  really does paint at the reading-start edge under `dir="rtl"`
- `valueFormatter?: LyraChartValueFormatter` (attribute: false) — formats numeric (value-axis)
  tick, tooltip, legend, and generated accessible-table values; the callback receives the value
  and `'tick'`, `'tooltip'`, `'legend'`, or `'table'` context. Never runs against the categorical
  x-axis's own labels (line/bar's `labels` strings) — Chart.js's category scale passes the tick
  index to `ticks.callback`, not the label text
- `formatter?: LyraChartFormatter` (attribute: false) — the family-wide context-object formatter:
  `({ value, surface, datasetIndex?, index?, label?, seriesLabel?, statistic? }) => string`.
  `surface` identifies `visual`, `spoken`, `export`, `tick`, `tooltip`, `legend`, or `table`.
  It takes precedence over the legacy positional `valueFormatter` where both are supplied.
- `area: boolean = false` — chart-wide default for whether line-type series fill the region under
  their line; a series's own `fill` overrides it, rendered with a translucent version of its color
- `zoom: boolean = false` — wheel/drag/pinch zoom on the `x` axis only (pan disabled, and the zoom
  range is limited to the original data extent); shows the `reset-zoom-button` while zoomed
- `height: string = '280px'` — a valid CSS length used only as the component's private fallback.
  A consumer-set `--lr-chart-height` always takes precedence; invalid values remove that fallback
  and likewise leave the public token/default in control.
- `xLabel: string | null = null` (attribute `x-label`)
- `yLabel: string | null = null` (attribute `y-label`)
- `y2Label: string = ''` (attribute `y2-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
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
  data-labels>` never affects any other chart on the page. If the peer is unavailable or cannot
  register, the core chart remains usable, labels stay disabled, and a localized visible
  `feature-warning` plus assertive announcement explains the nonfatal limitation. The screen-reader
  equivalent is the always-present accessible data table (`show-data-table` makes it visible) —
  labels are a purely visual, canvas-only addition and add no new a11y surface.
- `stackTotals: boolean = false` (attribute `stack-totals`) — with `stacked` (bar/line only), draws
  the per-category stack total above each stack, via the same `chartjs-plugin-datalabels` peer.
  Null/undefined points are skipped; a category whose every value is null shows no total (not
  `0`). The generated accessible table receives the same formatted total column; a dual-axis stack
  receives separately labelled primary- and secondary-axis total columns. The table totals do not
  depend on the optional visual-label peer being installed. If that peer is unavailable, the chart
  retains its core rendering and generated table totals while a localized nonfatal warning explains
  that the canvas labels cannot be drawn.
- `config?: LyraChartConfiguration` (attribute: false) — peer-neutral configuration structurally
  compatible with Chart.js's `ChartConfiguration`, deep-merged over the generated
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
- `showDataTable: boolean = false` (attribute `show-data-table`) — makes the always-available
  accessible data table visible rather than screen-reader-only
- `chartArea: LyraChartArea | undefined` (readonly) — current Chart.js chart-area geometry in
  canvas-local coordinates (`top`, `left`, `right`, `bottom`, `width`, `height`), when a chart is
  drawn
- `chart: LyraChartInstance | undefined` (readonly-by-convention) — peer-neutral structural view of
  the live Chart.js instance; absent before load and after disconnect
- `appendData(label, values, maxPoints?)` — appends one aligned numeric category and optionally
  keeps only the newest `maxPoints`. Each labels/datasets member is written back to the surface
  that owns it: an explicitly overridden `config.data` member stays in `config`, while an omitted
  member continues through the simplified property and retains its generated Chart.js styling.
  Point-based scatter/bubble series are left unchanged because appending their x/y/r coordinates
  needs a richer caller-defined contract.

**Methods:** `renderChart()` requests a connected/visibility-gated render or incremental update.
`resetZoom()` resets any active zoom/pan to the original view. `refreshTheme()` forces
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
actually guarantees (`Highlight`/`LinkText`/`CanvasText`, cycling), so colour alone stops separating
more than three series there. The chart therefore adds a **non-colour encoding automatically** in
that mode, cycling eight variants by series index: a canvas fill pattern (stripes, crosshatch, dots,
checker), a `borderDash` stroke pattern, a `pointStyle` shape, and the matching texture on the DOM
legend's `legend-swatch`, which carries a `data-encoding` attribute naming the variant (`solid`,
`horizontal`, `vertical`, `diagonal`, `reverse-diagonal`, `crosshatch`, `dots`, `checker`). Nothing
is opt-in and no author colour is substituted. Direct labels via `dataLabels` are still worth adding
when a chart must stay readable with no legend at all.

The instance method `seriesPalette(): string[]` resolves that ramp through `getComputedStyle` and
returns the concrete, theme-aware colors — the exact same values the chart hands an uncolored
series, with any `--lr-theme-color-chart-*` override already applied.

The module also exports `seriesPalette(scope?: Element | null): string[]`, which can run before a
chart exists. Omit `scope` to read `document.documentElement`, pass an element to resolve its theme
scope, or pass `null` to request the light-mode fallback directly. When a scope has no component
token layer yet, the helper reads the `--lr-theme-color-chart-N` inputs directly. Both forms return
a fresh eight-color array each call (safe to mutate) and let chart-adjacent UI, KPI tiles, or the
`Series` array itself come from one source of truth.

Import the standalone form from `.../chart/chart-colors.js`, not from `.../chart/chart.js`: the
latter is `<lr-chart>`'s registration entry, so it defines the element (and pulls in `<lr-skeleton>`)
as a side effect. `chart-colors.js` is side-effect-free and carries nothing but the palette helpers,
so a KPI tile that only needs eight color strings stays a ~1KB import.

```ts
import { seriesPalette } from '@aceshooting/lyra-ui/components/charts/chart/chart-colors.js';

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
`value` is the complete `LyraChartPoint`, including optional `r` and `label`.
`lr-datum-activate` emits the same activation with `kind: 'bar'|'point'|'segment'|'slice'` for
family-wide handling; `lr-point-click` remains as a compatibility event. Also
`lr-before-legend-visibility-change` (cancelable proposal), and
`lr-legend-visibility-change` (accepted commit). Both legend events carry
`{ datasetIndex: number, visible: boolean, hiddenDatasets: readonly number[] }`; the latter is the
complete, sorted, valid next snapshot. Call `preventDefault()` on the proposal to veto the toggle;
then no property change or commit event occurs.

**Slots:** default — one optional `<script type="application/json">` Chart.js configuration;
`data-table` — an optional consumer-provided complete, paginated, or virtualized accessible table
alternative; `center` —
optional overlay content positioned at the chart area's center, useful for doughnut and pie totals.

**Bounded rendering and data alternative:** simplified `labels`/`datasets` canvas rendering, the
DOM legend, generated table, keyboard-operable datum model, generated point-details in the summary,
and automatic canvas name process at most 1,000 category×series records. When sampling is necessary,
the selected category and series indexes are distributed
deterministically and retain their first and last endpoints; a localized `data-truncation` notice
is shown and announced. Supplying `slot="data-table"` suppresses the generated detailed sample and
notice, so use that escape hatch when the complete data set needs pagination, virtualization, or
another application-owned presentation. Explicit `config.data` is the deliberate full-fidelity
Chart.js escape hatch and is not rewritten by the simplified-surface sampler.

**CSS parts:** `base`, `plot` (the fixed-height canvas/overlay region), `canvas`, `legend` (the
wrapping DOM legend), `legend-item` (a dataset-visibility button), `legend-item-hidden` (added to
that button while its dataset is hidden), `legend-swatch`,
`reset-zoom-button`, `description`, `notices` (wrapper for nonfatal feature warnings and
bounded-alternative truncation notices), `data-table`, `data-truncation` (the bounded-alternative
notice), `feature-warning` (a nonfatal missing optional-feature warning), `center` (the
chart-area-centered wrapper for the `center` slot), `error` (neutral visible message rendered in
place of `canvas` when the optional `chart.js` peer dependency fails to load; the failure transition
is announced through the shared document-level light-DOM assertive sink)

**Themeable custom properties:** `--lr-chart-height` (the public, consumer-owned plot-height hook;
it sizes the `plot` region and the host's minimum block size, while a visible table or wrapping
legend grows the host in normal flow. The `height` property writes only a private fallback, so this
public token wins across valid, invalid, and unset `height` updates. Set it on the host or an
ancestor, not a shadow-tree descendant, since custom properties only cascade downward);
`--lr-chart-grid-color` (default `var(--lr-color-border)`),
`--lr-chart-tick-color` (default `var(--lr-color-text-quiet)`), `--lr-chart-legend-color`
(default `var(--lr-color-text)`), `--lr-chart-tooltip-bg` (default `var(--lr-color-surface)`),
`--lr-chart-tooltip-text` (default `var(--lr-color-text)`) — each resolved fresh via
`getComputedStyle` on every draw (Chart.js renders to canvas, not the DOM, so it can't consume CSS
`var()` directly), driving the grid lines, tick labels **and axis titles** (`xLabel`/`yLabel`/
`y2Label` title text reuses `--lr-chart-tick-color` too — there's no separate title-color token),
legend text, and tooltip background/text respectively; plus
`--lr-chart-legend-item-hover-bg` / `--lr-chart-legend-item-active-bg`,
`--lr-chart-data-table-button-hover-bg` / `--lr-chart-data-table-button-active-bg`, and
`--lr-chart-reset-zoom-button-hover-bg` / `--lr-chart-reset-zoom-button-active-bg` — independent
background hooks for each DOM control's hover and pressed states. Hover defaults to
`--lr-color-brand-quiet`; pressed defaults to its standard active color mix. Override one pair
without repainting the other controls;
`--lr-chart-legend-side-max` (default `var(--lr-size-15rem)`) caps the side-positioned legend track;
the responsive grid also limits it to one third of the chart allocation and stacks it below the
plot in narrow containers;
`--lr-chart-canvas-hover-outline-width` (default `var(--lr-border-width-thin)`) — the width of
`[part="canvas"]`'s own `:hover` outline. Unlike the tokens above, this one is a real CSS
declaration on a DOM element (the outline is painted by the stylesheet, not by Chart.js), so it is
consumed directly with no `getComputedStyle` bridging; it is an inline `var()` fallback at the point
of use, so it can be set on the element or any ancestor, and left unset the outline is exactly the
`--lr-border-width-thin` it always was.

`--lr-chart-pattern-step` (default `var(--lr-space-2xs)`) is the tile size of the texture painted on
`[part="legend-swatch"]` while `forced-colors: active` matches — the legend half of the non-colour
encoding described under "The categorical series ramp" above, and the reason repeated system colours
stay tellable apart in the DOM legend. It has no effect outside forced colors, where the swatch is a
plain colour chip. It scales the tile, not the mark inside it: the stripe/crosshatch line width
stays `--lr-border-width-thin` and the `dots` radius stays absolute, so a larger step spaces those
marks further apart rather than thickening them (the percentage-based `checker` variant is the one
that scales with the step). It does not touch the **canvas** pattern, whose 8×8 bitmap geometry is
part of the encoding algorithm and is not themeable. Unlike
the properties above it is declared by the shadow stylesheet on the swatch itself, not inherited
from the host, so setting it on `lr-chart` does nothing — override it through the part:

```css
lr-chart::part(legend-swatch) {
  --lr-chart-pattern-step: 0.5rem;
}
```

Plus shared `--lr-space-xs`.

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
regardless of options), `chartjs-plugin-zoom` (lazy-imported *additionally* only when `zoom` is — or
later becomes — `true`; never fetched for a chart that keeps `zoom` unset/false, since the plugin
has a hard dependency on `hammerjs`), and `chartjs-plugin-datalabels` only when `data-labels` or
`stack-totals` is enabled. Each capability load is memoized once per page, registering
only the tree-shaken controller/element/scale subset actually used. A failed zoom or data-label
peer is not a failed chart: the canvas, legend, and accessible alternative remain usable; the
requested enhancement is disabled and a localized static `feature-warning` is visibly rendered and
announced. In particular, unavailable data labels do not remove generated table totals.

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
  property values fall back to `bar`. Each typed `lr-*-chart` tag supplies its named chart type as
  a default while retaining the mirrored writable `type` surface.
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
- while the `chart.js` peer is resolving, `render()` swaps in a `<lr-skeleton shape="rect">` for
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
  `label`, `hiddenDatasets`, `legend`, `legendPosition`, `min`, `max`, `plugins`, the internal resolved auto legend
  position, `valueFormatter`, `formatter`, `area`, `height`, `xLabel`, `yLabel`, `y2Label`, `beginAtZero`,
  `stacked`, any `without*` control, `dataLabels`, `stackTotals`, `config`, the parsed
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
- `labels: readonly string[] = []` (attribute: false)
- `datasets: readonly LyraLiteChartSeries[] = []` (attribute: false) —
  `LyraLiteChartSeries { readonly label: string; readonly data: readonly (number|null)[];
  readonly color?: string }`; the deprecated `LiteSeries` name remains an alias for migration.
  `color` accepts a valid CSS `color`, while invalid values,
  declaration-breaking input, and `url()` paint servers fall back to the built-in palette
- `legend: boolean = false`
- `legendPosition: 'top'|'bottom'|'start'|'end' = 'bottom'` (attribute `legend-position`) — logical
  placement for the DOM legend; side positions are bounded and stack responsively in narrow hosts
- `label: string | null = null`, `description: string | null = null` — canonical accessible name
  and description; host `aria-label` wins by presence, including an explicit empty string
- `accessibleLabel?: string` (attribute `accessible-label`) — overrides the `<svg>`'s auto-derived
  `aria-label` (`datasets.map(d => d.label).join(', ') || 'Chart'`); a host `aria-label` still wins.
  Unset keeps the auto-derived (English-fallback) label. `lr-lite-chart` keeps this property under
  its original `accessible-label` name, unrelated to the deprecated `accessible-label` alias that
  `lr-chart`/`lr-box-plot` dropped in favor of their mirrored `label` property.
- `height: string = '280px'` — accepts a valid CSS `height` as a private fallback. A consumer-set
  `--lr-chart-height` always wins; invalid values, declaration-breaking input, and `url()` remove
  the fallback and leave the public token/default in control.
- `xLabel: string = ''` (attribute `x-label`)
- `yLabel: string = ''` (attribute `y-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
- `stacked: boolean = false` — sums each category's bars into one segmented bar instead of grouping
  them side by side; ignored for `type="line"`
- `tickFormat?: (value: number) => string` (attribute: false) — formats a y-axis tick value for
  display (e.g. `(v) => \`$${v.toFixed(2)}\`` for currency, or a duration formatter for `"42s"`).
  Falls back to the built-in "nice numbers" formatter when unset.
- `formatter?: LyraChartFormatter` (attribute: false) — family-wide context-object formatter used
  by visual/tooltips, spoken text, legends, tables, and CSV export. It takes precedence over the
  older surface-specific hooks, which remain available as compatibility fallbacks.
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
  legible fixed width instead of them compressing as category count grows. The plot content width
  is capped at 1,000,000px, so hostile category counts or widths cannot produce
  unbounded geometry. Bar type only.
- `barWidth: number = 32` (attribute `bar-width`, px) — each bar's fixed width in `layout="scroll"`
  mode; ignored in the default `'fit'` mode. An excessive value is reduced as needed by the
  1,000,000px scroll-content ceiling.
- `maxLabels?: number` (attribute `max-labels`, type Number) — decimates which category axis labels
  actually render *text* when `labels.length > maxLabels`: always shows the first and last label,
  and roughly evenly distributes
  the rest between them. Works in either `layout` mode. Unset (the default) renders every label.
  Each rendered category label is allocation-aware: narrow/long text is ellipsized before paint,
  with the complete caller label retained as its accessible name. Independently, the global
  1,000-record safety sampler may bound both marks and labels for very large category×series input.
- `barX?: (index: number) => number` (attribute: false, bar type only) — overrides the internal
  per-category x-origin formula (`plotX + i * slot`) used by both bars and their axis labels, so a
  consumer can pixel-align this chart's bars with a sibling `<lr-heatmap>` calendar's week columns
  (see that component's own `columnX`) by supplying the same coordinate function to both. Unset (the
  default) is the original formula, unchanged. The callback runs once per rendered category per
  render and its finite result is shared by that category's bars and label; a non-finite result
  falls back to the normal slot position.
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
- `valueAxisGutter?: number` (attribute `value-axis-gutter`) — value-axis gutter width.
- `barGapRatio?: number` (attribute `bar-gap-ratio`) — overrides the internal 0.2 `BAR_GROUP_GAP`
  fraction of a category slot left as a gap between categories. Unset keeps the fixed 0.2.
- `scale: 'linear' | 'sqrt' = 'linear'` (bar type only) — `'sqrt'` maps a bar's value to height via
  `Math.sqrt(value / domainMax)` instead of the standard linear `niceDomain` fraction (mirroring
  `lr-heatmap`'s matrix-mode `sqrt` scale), so a skewed dataset's smaller bars aren't washed out
  by one dominant value; gridlines/tick labels stay on the linear domain either way, and `type="line"`
  ignores it entirely.
- `withoutValueAxis: boolean = false` (attribute `without-value-axis`) — suppresses gridlines and
  value-axis tick labels; x-axis category labels remain.
- `selectedIndices: readonly number[] = []` (attribute: false) — applies to every interactive data mark for
  both `type="bar"` and `type="line"`: matching bars and line points receive `data-selected` and
  explicit `aria-pressed="true"`; all other marks render `aria-pressed="false"`. For a multi-series
  chart, the category index selects the matching mark in every dataset. Empty is the default.
  Style the built-in highlight through `--lr-lite-chart-selected-outline-color` and
  `--lr-lite-chart-selected-outline-width`. Note
  `::part(bar)[data-selected]` and `::part(point)[data-selected]` are **invalid CSS** — Shadow Parts
  forbids an attribute selector after `::part()` — so they silently never match; the outline is
  painted inside the shadow root and exposed through that token instead.
- `labels`, `datasets`, and `selectedIndices` are clone-owned, bounded, frozen snapshots. Mutating
  a previously assigned array or nested series data has no effect; create and reassign a new
  collection.
- `minBarHeight?: number` (attribute `min-bar-height`) — optional minimum visible bar height for
  small non-zero values; finite input is capped at 1,000,000px before derived SVG geometry is
  calculated
- `appendData(label, values, maxPoints?)` — appends one aligned category and optionally trims the
  oldest categories

**Events:** `lr-datum-activate` — canonical family activation with `kind: 'bar'|'point'`,
`datasetIndex`, `index`, `label`, and `value`. The compatibility `lr-point-click` event is emitted
for the same pointer or Enter/Space activation. When different series' expanded
line-point targets overlap, pointer activation selects the closest rendered point in two-dimensional
screen space; an exact distance tie retains the point whose target received the click.

**Methods:** `exportData('csv' | 'svg')` returns a spreadsheet-safe CSV snapshot or the current SVG
markup. CSV rows cover the canonical record count — the maximum of `labels.length` and every
`dataset.data.length` — and use empty cells for missing labels/values, so a longer or ragged series
is never truncated or shifted. The method does not download a file; pair it with
`lr-export-button` for download UX.

The axis gutter/title and y-axis labels mirror to logical start under RTL. Built-in mark summaries
are complete localized templates and format values with `effectiveLocale`.

**Performance:** `render()` recomputes the grid/marks on every update rather than memoizing against a
content signature — `datasets`/`labels` can hold callbacks (`tickFormat`, `barX`) or arbitrary,
possibly circular or BigInt-bearing application data that a fingerprint can't serialize safely, so a
fresh, small SVG render is cheaper and more correct than a lossy cache. The shared sampling path
keeps that render bounded to 1,000 category×series marks/keyboard records, retaining endpoints
instead of materializing an unbounded hidden DOM or SVG tree.

**Slots:** `data-table` — optional consumer-provided complete, paginated, or virtualized accessible
data alternative.

**CSS parts:** `base`, `description`, `grid-line`, `axis-label`, `axis-title`, `bar` and `point` (each carries
`data-selected` when its category index is in `selectedIndices`, with explicit pressed state on every
mark), `line`, `legend`, `legend-item`, `legend-swatch`, `legend-text` (extra per-item text after
the series label, rendered only when `legendText` is set), `live-region` (the current mark
announcement for keyboard users), `data-list` (a visually hidden sampled list of plotted data
points — single-series only), `data-table` (the generated/slotted alternative container), `table`
(the generated semantic category×series table rendered when there is more than one dataset), and
`data-truncation` (the
visible/announced sampling notice).

**Screen-reader data alternative:** a single dataset renders the flat `data-list` (one `<li>` per
plotted point, matching the roving-tabindex mark order). More than one dataset instead renders a
`data-table` — a category-labelled `<caption>` (the shared localized `chartData` string), one
`<th scope="col">` per series (plus a leading `chartCategory` corner header), and one
`<th scope="row">` per category label with its per-series values in the body — so a screen-reader
user hears the values grouped by series rather than one flattened N×M sequence.
Finite table cells use `tableCellFormatter` when supplied and otherwise use the component's
effective locale. A stacked multi-series bar chart with `tableTotals` adds a localized total
column; null/non-finite inputs are skipped, while an all-missing category leaves the total cell
blank instead of reporting a misleading zero. Built-in SVG marks, keyboard targets, and this data
alternative share one endpoint-preserving sample of at most 1,000 category×series records. When
sampling occurs, a localized `data-truncation` notice is shown and announced; provide
`slot="data-table"` for a complete paginated, virtualized, or application-owned alternative, which
suppresses the generated sample and notice.

**Themeable custom properties:** `--lr-chart-height` (same public host-level property and precedence
as `lr-chart`; it always wins over the `height` property's private fallback);
`--lr-chart-grid-color`, `--lr-chart-tick-color`, `--lr-chart-legend-color` — same token
*names* as `lr-chart`, so a host already theming `lr-chart` themes this for free;
`--lr-chart-color-1`, `--lr-chart-color-2`, `--lr-chart-color-3`, `--lr-chart-color-4`,
`--lr-chart-color-5`, `--lr-chart-color-6`, `--lr-chart-color-7`, and `--lr-chart-color-8` (each
defaulting to the matching `var(--lr-color-chart-N)` ramp entry) — the per-series colors, so one element can be recolored
without moving the library-wide ramp; `--lr-chart-legend-side-max` (default
`var(--lr-size-15rem)`) caps side legend allocation; `--lr-lite-chart-selected-outline-color` (default
`var(--lr-color-brand)`) — the stroke drawn on
selected `[part='bar']` and `[part='point']` marks whose category index is in `selectedIndices`;
`--lr-lite-chart-selected-outline-width` (default `var(--lr-size-2px)`) — that stroke's width.
Unlike `lr-chart` (canvas-rendered, needs `getComputedStyle`-based re-theming on every draw), this
is plain SVG/DOM and reads these via native CSS `var()` — no JS-side resolution step, and no
`refreshTheme()` method needed (there's nothing to go stale). `--lr-chart-pattern-step`
(default `var(--lr-space-2xs)`) sizes the forced-colors legend texture, exactly as on `lr-chart`.

**Forced colors:** under `forced-colors: active` the `--lr-color-chart-*` ramp behind
`--lr-chart-color-1..8` is remapped onto the small repeating system-color cycle the platform
exposes, so series 1/4/7 (and 2/5/8, 3/6) would otherwise paint identically. `lr-lite-chart` then
encodes each series a second way, using the same eight-way vocabulary as `lr-chart`: `[part='bar']`
takes a per-series SVG texture fill, `[part='line']` takes a per-series `stroke-dasharray`, and
`[part='legend-swatch']` carries a `data-encoding` attribute selecting the matching CSS texture.
Nothing is opt-in, the encodings exist only while the media query matches, and no author color is
substituted.

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
- No horizontal-bar mode (unlike `lr-chart`'s `index-axis="y"`) — deliberately cut from scope, not a
  stub: bars are always vertical.
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

Each is `LyraChart` with a named default `type` — respectively `line`, `bar`, `pie`, `doughnut`,
`radar`, `polarArea`, `bubble`, `scatter`. In parity with the mirrored tags, `type` remains writable
and accepts the full `LyraChartType` vocabulary; the tag name is a convenient default, not a lock.

Everything else is inherited verbatim from `lr-chart`; each name below has the same type, default,
and behavior there. **See `llms/components/lr-chart.md` for the details, code example, and gotchas
of every entry in these lists.**

**Properties:** `description`, `grid`, `indexAxis` (`index-axis`), `label`, `hiddenDatasets`, `legendPosition`
(`legend-position`), `max`, `min`, `plugins`, `stacked`, `withoutAnimation` (`without-animation`),
`withoutLegend` (`without-legend`), `withoutTooltip` (`without-tooltip`), `xLabel` (`x-label`),
`yLabel` (`y-label`), plus additive `labels`, `datasets`, `valueFormatter`, `formatter`, `area`, `zoom`,
`height`, `y2Label` (`y2-label`), `beginAtZero` (`begin-at-zero`), `dataLabels`
(`data-labels`), `stackTotals` (`stack-totals`), `config`, `showDataTable`
(`show-data-table`), `chartArea` (readonly), and `chart`. `type` differs only in its initial value.

**Methods:** `appendData(label, values, maxPoints?)`, `exportData('csv' | 'png')`, `renderChart()`, `resetZoom()`,
`refreshTheme()`.

**Events:** `lr-zoom` (`detail: { zoomed: boolean }`), `lr-datum-activate`, `lr-point-click` (`detail: { datasetIndex,
index, label, value }`), `lr-before-legend-visibility-change` (cancelable), and
`lr-legend-visibility-change` (commit; both legend events carry `datasetIndex`, `visible`, and the
complete `hiddenDatasets` snapshot).

**Slots:** default JSON configuration script, `data-table`, `center`.

**CSS parts:** `base`, `plot`, `canvas`, `legend`, `legend-item`, `legend-item-hidden`, `legend-swatch`,
`reset-zoom-button`, `description`, `notices`, `data-table`, `data-truncation`, `feature-warning`, `center`, `error` (neutral visible message
rendered in place of `canvas` when the optional `chart.js` peer dependency fails to load; the
failure transition is announced through the shared document-level light-DOM assertive sink — see
`llms/components/lr-chart.md`).

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text`, `--lr-chart-legend-item-hover-bg`,
`--lr-chart-legend-item-active-bg`, `--lr-chart-data-table-button-hover-bg`,
`--lr-chart-data-table-button-active-bg`, `--lr-chart-reset-zoom-button-hover-bg`,
`--lr-chart-reset-zoom-button-active-bg`, `--lr-chart-canvas-hover-outline-width`, and
`--lr-chart-pattern-step`, plus `--lr-chart-legend-side-max` — all inherited from `LyraChart`, identical in meaning and default (see
`lr-chart` above); each of the eight variants below reads the same set, so one rule retunes them
together. The mirrored hooks are `--border-color-1`,
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
- Changing `type` after construction may rebuild the underlying Chart.js instance; any active zoom
  state is reset and announced before the new type renders.
- `lr-bubble-chart` consumes the exported `LyraChartPoint` shape directly. Set `x`/`y`, optional `r`
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
- `seriesLabel: string = ''` (attribute `series-label`) — dataset label used for the
  legend/tooltip/table; empty falls back to localized "Frequency". Inherited `label` keeps its
  chart-wide accessible-name meaning.
- `labels`/`datasets`/`type` are **derived, read-only** (installed as getter/setter pairs on the
  prototype; direct writes are silently ignored) — `labels`/`datasets` are computed from
  `values`/`bins` (memoized per instance, keyed by reference equality on `values` plus the
  normalized `bins`), and `type` always reads back `'bar'` regardless of any assignment. This
  specialist owns its controller because a non-bar type would contradict the derived distribution.
- All other `LyraChart` properties are inherited and usable: `description`, `grid`, `indexAxis`
  (`index-axis`), `hiddenDatasets`, `legendPosition` (`legend-position`), `max`, `min`, `plugins`,
  `withoutAnimation` (`without-animation`), `withoutLegend` (`without-legend`), `withoutTooltip`
  (`without-tooltip`), `valueFormatter`, `formatter`, `area`, `zoom`, `config`, `height`, `xLabel` (`x-label`),
  `yLabel` (`y-label`), `y2Label` (`y2-label`), `beginAtZero` (`begin-at-zero`),
  `stacked`, `dataLabels` (`data-labels`), `stackTotals` (`stack-totals`), `showDataTable`
  (`show-data-table`), `chartArea` (readonly).

**Methods:** `resetZoom()`, `refreshTheme()`, and `renderChart()` are inherited; `appendSamples(values,
maxSamples?)` appends finite raw samples and optionally retains only the newest samples.
`appendData()` remains a working compatibility adapter (no longer deprecated); prefer
`appendSamples()` for new code.

**Events:** `lr-zoom`, `lr-datum-activate`, `lr-point-click`, `lr-before-legend-visibility-change` (cancelable), and
`lr-legend-visibility-change` — inherited; `lr-point-click`'s `index` is the bucket index and
`label` the generated bucket range string (`"lo–hi"`, both bounds at one decimal place).

**Slots:** default JSON configuration script, `data-table`, `center`.

**CSS parts:** `base`, `plot`, `canvas`, `legend`, `legend-item`, `legend-item-hidden`, `legend-swatch`,
`reset-zoom-button`, `description`, `notices`, `data-table`, `data-truncation`, `feature-warning`, `center`, `error` (neutral visible message
rendered in place of `canvas` when the optional `chart.js` peer dependency fails to load; the
failure transition is announced through the shared document-level light-DOM assertive sink —
inherited from `LyraChart`, unaffected by the binning logic).

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text`, `--lr-chart-legend-item-hover-bg`,
`--lr-chart-legend-item-active-bg`, `--lr-chart-data-table-button-hover-bg`,
`--lr-chart-data-table-button-active-bg`, `--lr-chart-reset-zoom-button-hover-bg`,
`--lr-chart-reset-zoom-button-active-bg`, `--lr-chart-canvas-hover-outline-width`, and
`--lr-chart-pattern-step`, plus `--lr-chart-legend-side-max` — inherited from `LyraChart`, identical in meaning, together with the
mirrored `--border-color-1`,
`--border-color-2`,
`--border-color-3`, `--border-color-4`, `--border-color-5`, `--border-color-6`, `--fill-color-1`,
`--fill-color-2`, `--fill-color-3`, `--fill-color-4`, `--fill-color-5`, `--fill-color-6`,
`--border-radius`, `--border-width`, `--grid-border-width`, `--grid-color`,
`--line-border-width`, and `--point-radius` hooks listed on the core chart.

**Optional peer deps:** the same `chart.js` peer, plus `chartjs-plugin-zoom` when `zoom` is set and
`chartjs-plugin-datalabels` when `data-labels` or `stack-totals` is set.

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
  math; a constant domain produces one truthful single-value bucket, including at numeric extremes.
- raw `config.options` and plugins remain available, but `config.type` and `config.data` are ignored:
  the histogram owns its bar controller and derives all categories from `values`/`bins`.
- `values`/`bins`/`seriesLabel` changes join the inherited connected-and-visible redraw path. There is no
  second post-update refresh, so a same-tick disconnect cannot recreate Chart.js on a detached
  canvas and off-screen sample updates do not repaint it.

---

## `lr-box-plot`

Box-and-whisker chart from a precomputed five-number summary (no raw sample data sent to the
browser). Does **not** extend `LyraChart` — a deliberately bespoke API.

**Properties:**
- `labels: readonly string[] = []` (attribute: false)
- `datasets: readonly LyraBoxPlotSeries[] = []` (attribute: false) — each series contains readonly
  `LyraBoxPlotSummary { min, q1, median, q3, max }` values. Summaries must be finite and ordered
  `min <= q1 <= median <= q3 <= max`; invalid entries are omitted and caller objects are never
  passed to the mutating peer.
- `hiddenDatasets?: readonly number[]` (attribute: false) — complete controlled visibility snapshot
  for the DOM legend. `undefined` leaves every box series visible; `[]` likewise explicitly makes
  every series visible, while a defined canonical list of zero-based indexes hides those series.
  Duplicate, non-integer, negative, and out-of-range indexes are discarded. Accepted user toggles
  write their complete next snapshot back to this property; programmatic writes reconcile silently.
- `labels`, `datasets`, and `hiddenDatasets` are clone-owned, bounded, frozen snapshots. Mutating a
  previously assigned array or nested series data has no effect; create and reassign a new
  collection.
- `legend: boolean = false` — renders a wrapping DOM legend whose buttons toggle box-series
  visibility without clipping long labels.
- `legendPosition: 'top'|'bottom'|'start'|'end' = 'bottom'` (attribute `legend-position`) — logical,
  responsive DOM legend placement
- `height: string = '280px'` — valid CSS height used as a private fallback only. A consumer-set
  `--lr-chart-height` always wins; invalid values remove the fallback and leave the public
  token/default in control.
- `yLabel: string = ''` (attribute `y-label`)
- `beginAtZero: boolean = true` (attribute `begin-at-zero`)
- `label: string | null = null`, `description: string | null = null` — canonical accessible name
  and description; host `aria-label` wins by presence, including an explicit empty string
- `formatter?: LyraChartFormatter`, `valueFormatter?: LyraChartValueFormatter` — numeric axis,
  tooltip, table, summary, and export formatting; the context-object formatter takes precedence
- `showDataTable: boolean = false` (attribute `show-data-table`) — reveals the accessible data table

**Methods:** `exportData('csv'|'png')` returns spreadsheet-safe summary rows or the current canvas
PNG data URL. `refreshTheme()` re-reads canvas theme custom properties after an ancestor theme
change. Canvas work remains connected/visible-gated, while a rendered DOM legend also refreshes
its computed color swatches.

**Events:** `lr-datum-activate` (canonical detail with `kind: 'box'`), `lr-point-click`
(compatibility), `lr-before-legend-visibility-change` (cancelable proposed legend
toggle) and `lr-legend-visibility-change` (accepted commit). The two legend events carry
`{ datasetIndex: number, visible: boolean, hiddenDatasets: readonly number[] }`, where
`hiddenDatasets` is the complete sorted, valid next snapshot. Calling `preventDefault()` on the
proposal leaves state untouched and suppresses the commit event.

`lr-point-click` fires when pointer input lands on a box, or when Enter/Space activates the
keyboard-current box — the same event name and role `lr-chart` and `lr-lite-chart` expose. Its
`detail` is `{ datasetIndex: number, index: number, label: string | undefined, value: LyraBoxPlotSummary |
null }`, where `value` is a fresh copy of that box's five-number summary (never the object you
passed in `datasets`, which the underlying peer may annotate in place). A pointer click that misses every
box emits nothing rather than reporting the nearest one.

**Per-box keyboard access:** the `canvas` part is a focusable `role="application"` surface.
Arrow keys walk the boxes one at a time (Left/Right swap under RTL; Up/Down always mean
previous/next), Home/End jump to the first/last, and Enter or Space activates the current box. Each
move announces that box's series, category, and complete five-number summary through the shared
document-level light-DOM polite sink. The walk visits the same bounded, deterministic sample the
generated data table uses, so a very wide data set stays navigable.

**Slots:** `data-table` — an optional consumer-provided complete, paginated, or virtualized
accessible table alternative.

**Bounded data alternative:** the generated table, automatic canvas name, and generated per-series
description use at most 1,000 category×series records. When sampling is needed, its category and
series indexes are deterministic and retain the first and last endpoint; a localized
`data-truncation` notice is shown and announced. A slotted `data-table` replaces the generated
detailed sample and notice, making it the escape hatch for complete data.

**CSS parts:** `base`, `plot` (the fixed-height canvas region), `canvas`, `legend`,
`legend-item`, `legend-item-hidden` (added to a legend item while its box series is hidden),
`legend-swatch`, `description`, `data-table`, `error` (neutral visible message shown
instead of `canvas` when the optional box-plot peer fails to load; the failure transition is
announced through the shared document-level light-DOM assertive sink), `data-truncation` (the
bounded-alternative sampling notice)

**Themeable custom properties:** `--lr-chart-height`, `--lr-chart-grid-color`,
`--lr-chart-tick-color`, `--lr-chart-legend-color`, `--lr-chart-tooltip-bg`,
`--lr-chart-tooltip-text` — same public host-level precedence, token names, and defaults as `lr-chart`
(also `getComputedStyle`-resolved and CSS-color-validated on every draw; invalid expressions use
concrete semantic fallbacks rather than retaining a prior canvas paint), but declared in its own stylesheet, not a
re-export: `lr-box-plot` has no `zoom`, so no `reset-zoom-button` chrome exists here. A `BoxPlotSeries`
that sets no `color` is assigned an entry from the same `--lr-color-chart-1..8` ramp `lr-chart` uses,
so `--lr-theme-color-chart-*` retheming reaches box plots too. `--lr-chart-pattern-step`
(default `var(--lr-space-2xs)`) sizes the forced-colors legend texture and
`--lr-chart-canvas-hover-outline-width` (default `var(--lr-border-width-thin)`) sizes the `canvas`
hover outline, `--lr-chart-legend-item-active-bg` and `--lr-chart-legend-item-hover-bg` retune the
pressed and hovered legend rows, and `--lr-chart-legend-side-max` caps a side legend — the same tokens and defaults as
`lr-chart`.

**Forced colors:** under `forced-colors: active` the eight-color ramp is remapped onto the small
repeating system-color cycle the platform exposes, so series 1/4/7 (and 2/5/8, 3/6) would otherwise
paint identically. Each box's fill is therefore textured with a per-series pattern, and its legend
swatch carries the matching CSS texture — the same eight-way encoding `lr-chart` applies to its own
repeated colors. Box-and-whisker elements expose no border-dash or point-style option, so texture is
the only channel here; nothing is opt-in and no author color is substituted.

**Optional peer deps:** `@sgratzl/chartjs-chart-boxplot` plus `chart.js`; both validated capability
loads are memoized per page.

```html
<lr-box-plot y-label="Latency (ms)"></lr-box-plot>
<script>
  const bp = document.querySelector('lr-box-plot');
  bp.labels = ['Run A', 'Run B'];
  bp.datasets = [{ label: 'p50–p99', data: [{ min: 10, q1: 20, median: 30, q3: 45, max: 90 }, { min: 12, q1: 18, median: 25, q3: 35, max: 60 }] }];
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
  It is consumer-owned and wins over the `height` property's private fallback. A visible or slotted
  table and the wrapping legend remain in normal document flow, grow the
  component, and cannot overlap following content; oversized tables scroll inside the host.
- If `@sgratzl/chartjs-chart-boxplot` fails to load, the component warns to the console and
  fails closed with a localized, neutral visible error part rather than leaving a blank canvas.
  The transition into that state is announced through the shared document-level light-DOM
  assertive sink.

---
## Chart streaming and export

`lr-lite-chart` and `lr-chart` expose imperative helpers for live dashboards:
`appendData(label, values, maxPoints?)` appends one aligned category and optionally trims the oldest
points; when existing series lengths differ, missing cells are padded before the new category so
labels and values remain aligned. `lr-histogram.appendSamples(values, maxSamples?)` appends finite
raw samples and rebins the retained window. `lr-lite-chart.exportData('csv' | 'svg')` returns a spreadsheet-safe CSV snapshot
or the current SVG markup. `lr-chart.exportData('csv' | 'png')` returns a CSV snapshot or Chart.js's
current PNG data URL when the optional peer is loaded; point datasets expand x/y and optional
radius/point-label columns. `lr-box-plot.exportData('csv'|'png')` exports all five summary values.
These helpers do not download files; compose them with
`lr-export-button` so the host owns filenames and download policy.

For route-level warming, the side-effect-free chart preload entry exports
`preloadCharts({ zoom?, dataLabels?, boxPlot? })`. Core Chart.js is always requested and optional
capabilities only when flagged; the result reports which requested capabilities are available.

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-charts-chart-box-plot-contracts`** — Supporting data types and helpers for this component family.
  `LyraBoxPlotPointDetail {
    datasetIndex: unknown;
    index: unknown;
    label: unknown;
    value: unknown;
  }`
  `LyraBoxPlotSeries {
    label: unknown;
    data: unknown;
    color: unknown;
  }`
  `LyraBoxPlotSummary {
    min: unknown;
    q1: unknown;
    median: unknown;
    q3: unknown;
    max: unknown;
  }`

- **`components-charts-chart-chart-colors-contracts`** — Supporting data types and helpers for this component family.
  `seriesPalette(/* public names: element */): unknown`
  `translucentAreaColor(/* public names: scope, color */): unknown`

- **`components-charts-chart-chart-core-loader-contracts`** — Supporting data types and helpers for this component family.
  `ChartJsModule {
    Chart: unknown;
    defaults: unknown;
    plugins: unknown;
    legend: unknown;
    labels: unknown;
    generateLabels: unknown;
    chart: unknown;
    LineController: unknown;
    BarController: unknown;
    ScatterController: unknown;
    DoughnutController: unknown;
    PieController: unknown;
    RadarController: unknown;
    PolarAreaController: unknown;
    BubbleController: unknown;
    LineElement: unknown;
    PointElement: unknown;
    BarElement: unknown;
    ArcElement: unknown;
    LinearScale: unknown;
    CategoryScale: unknown;
    RadialLinearScale: unknown;
    Filler: unknown;
    Tooltip: unknown;
    Legend: unknown;
  }`
  `loadAndRegisterChartModule(/* public names: importChart, register, mod */): unknown`
  `loadChartJs(): unknown`
  `loadChartModule(/* public names: importChart */): unknown`

- **`components-charts-chart-chart-feature-loader-contracts`** — Supporting data types and helpers for this component family.
  `ChartPluginCapability {
    id: unknown;
  }`

- **`components-charts-chart-chart-legend-visibility-contracts`** — Supporting data types and helpers for this component family.
  `LyraChartLegendVisibilityChangeDetail {
    datasetIndex: unknown;
    visible: unknown;
    hiddenDatasets: unknown;
  }`

- **`components-charts-chart-chart-loader-contracts`** — Supporting data types and helpers for this component family.
  `loadChartAndZoom(/* public names: importChart, importZoom, needsZoom, mod, zoomPlugin */): unknown`
  `loadChartAndDataLabels(/* public names: loadChart, importDataLabels */): unknown`
  `loadChartAndRegisterZoom(/* public names: loadChart, importZoom */): unknown`
  `loadChartJsWithDataLabels(/* public names: importDataLabels, mod, plugin */): unknown`
  `loadChartJsWithDataLabelsResult(/* public names: importDataLabels */): unknown`
  `loadChartJsWithZoom(/* public names: importZoom */): unknown`
  `loadChartJsWithZoomResult(/* public names: importZoom */): unknown`
  `loadDataLabelsPlugin(/* public names: importDataLabels */): unknown`

- **`components-charts-chart-chart-preload-contracts`** — Supporting data types and helpers for this component family.
  `LyraChartPreloadOptions {
    zoom: unknown;
    dataLabels: unknown;
    boxPlot: unknown;
  }`
  `LyraChartPreloadResult {
    core: unknown;
    zoom: unknown;
    dataLabels: unknown;
    boxPlot: unknown;
  }`
  `preloadCharts(/* public names: options */): unknown`

- **`components-charts-chart-chart-contracts`** — Supporting data types and helpers for this component family.
  `lockChartType(/* public names: ctor, value */): unknown`
  `LyraChartArea {
    top: unknown;
    left: unknown;
    right: unknown;
    bottom: unknown;
    width: unknown;
    height: unknown;
  }`
  `LyraChartConfiguration {
    type: unknown;
    data: unknown;
    options: unknown;
    plugins: unknown;
  }`
  `LyraChartDataConfiguration {
    labels: unknown;
    datasets: unknown;
  }`
  `LyraChartDatasetConfiguration {
    type: unknown;
    label: unknown;
    data: unknown;
    hidden: unknown;
    axis: unknown;
    yAxisID: unknown;
    noTooltip: unknown;
    fill: unknown;
    backgroundColor: unknown;
    borderColor: unknown;
    borderRadius: unknown;
    borderWidth: unknown;
    borderDash: unknown;
    color: unknown;
    pointStyle: unknown;
    pointBackgroundColor: unknown;
    pointRadius: unknown;
    segment: unknown;
  }`
  `LyraChartDatumActivateDetail {
    kind: unknown;
    datasetIndex: unknown;
    index: unknown;
    label: unknown;
    value: unknown;
  }`
  `LyraChartFormatterContext {
    value: unknown;
    surface: unknown;
    datasetIndex: unknown;
    index: unknown;
    label: unknown;
    seriesLabel: unknown;
    statistic: unknown;
  }`
  `LyraChartInstance {
    data: unknown;
    labels: unknown;
    datasets: unknown;
    options: unknown;
    config: unknown;
    type: unknown;
    legend: unknown;
    chartArea: unknown;
    destroy: unknown;
    update: unknown;
    mode: unknown;
    toBase64Image: unknown;
    getElementsAtEventForMode: unknown;
    event: unknown;
    useFinalPosition: unknown;
    getDatasetMeta: unknown;
    index: unknown;
    hidden: unknown;
    isDatasetVisible: unknown;
    setDatasetVisibility: unknown;
    visible: unknown;
  }`
  `LyraChartPlugin {
    id: unknown;
  }`
  `LyraChartPoint {
    x: unknown;
    y: unknown;
    r: unknown;
    label: unknown;
  }`
  `LyraChartSeries {
    label: unknown;
    data: unknown;
    points: unknown;
    color: unknown;
    fill: unknown;
    width: unknown;
    dash: unknown;
    noTooltip: unknown;
    axis: unknown;
    pointColors: unknown;
    pointRadius: unknown;
    segmentColors: unknown;
    type: unknown;
  }`

- **`components-charts-chart-histogram-bin-contracts`** — Supporting data types and helpers for this component family.
  `binValues(/* public names: values, binCount, locale */): unknown`
  `HistogramBucket {
    label: unknown;
    count: unknown;
  }`

- **`components-charts-chart-histogram-contracts`** — Supporting data types and helpers for this component family.
  `binnedBuckets(/* public names: el */): unknown`

- **`components-charts-chart-lite-chart-contracts`** — Supporting data types and helpers for this component family.
  `LyraLiteChartSeries {
    label: unknown;
    data: unknown;
    color: unknown;
  }`
  `LyraLiteChartTableCellContext {
    kind: unknown;
    datasetIndex: unknown;
    index: unknown;
    label: unknown;
    seriesLabel: unknown;
  }`
