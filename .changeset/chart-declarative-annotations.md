---
"@aceshooting/lyra-ui": minor
---

`<lr-chart>`: declarative reference lines and shaded bands via a new `annotations` property.

Marking a threshold, an event year, a regime change or a highlighted period previously meant
importing `chartjs-plugin-annotation` yourself and wiring it through the raw `config` passthrough —
the point where a declarative component dropped the user into raw Chart.js, for one of the most
common things anyone needs on a time series.

- `annotations: readonly LyraChartAnnotation[]`, where `LyraChartAnnotation` is
  `{ axis?: 'x' | 'y'; value?: number; from?: number; to?: number; label?: string; tone?: 'neutral'
  | 'brand' | 'success' | 'warning' | 'danger' }`. A finite `value` renders a reference line on that
  axis; a finite `from`/`to` pair renders a band bounded on that axis and spanning the other. `axis`
  defaults to `'y'`.
- Entries specifying neither a finite value nor a finite range are dropped rather than handed to
  Chart.js, where they render nothing at best; a reversed range is normalized rather than rejected.
- Tones resolve through the same `getComputedStyle`-then-`resolveCanvasColor` path every other chart
  color takes, since canvas silently ignores an unparseable `strokeStyle`/`fillStyle`.
- Labelled entries are included in the generated accessible description, mirroring `lr-heatmap`. The
  label is consumer-supplied text and so is not localized; an unlabelled line has no nameable
  meaning to announce beyond a coordinate.
- The optional `chartjs-plugin-annotation` peer loads on first actual demand, so a page with no
  annotated charts never downloads it. Without it installed the chart still renders and a single
  console warning explains the no-op — the same fail-closed contract `data-labels` uses.

On the filed concern about Chart.js's page-wide singleton registry: this plugin is registered
globally, like `chartjs-plugin-zoom` and unlike `chartjs-plugin-datalabels`. The distinction is that
datalabels draws on every dataset the moment it is globally registered, whereas annotation draws
nothing at all unless a chart supplies annotation options — so the registration is unobservable to a
chart that sets none, covered by an explicit test. It also *has* to be global: registration is what
installs the plugin's own element types and defaults, and an inline `config.plugins` entry skips
that, leaving the plugin to throw on missing `borderWidth`/`borderCapStyle` the moment it draws.
