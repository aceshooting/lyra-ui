# Lyra UI

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)

Free, clean-room [Lit](https://lit.dev) web components — a companion to
[Web Awesome](https://webawesome.com) that provides open-source equivalents of several
Web Awesome **Pro** components, plus a few extras. Token-compatible with Web Awesome, so
the components look native inside a WA app, and fully usable standalone.

> **Independent project.** Not affiliated with or endorsed by Web Awesome. Component APIs
> intentionally mirror Web Awesome's public API (attributes, slots, events, CSS parts) so
> migration is a prefix rename — but every implementation here is original (clean-room).

## Install

```bash
npm install @aceshooting/lyra-ui
# peer: Lit is bundled; Floating UI ships with the positioned components
# optional peer: @aceshooting/lyra-flags, only needed for <lyra-flag>
# optional peer: d3-force, d3-drag, d3-zoom, d3-selection, only needed for <lyra-graph>
# optional peer: chart.js, chartjs-plugin-zoom, only needed for the <lyra-*-chart>/<lyra-histogram> family
# optional peer: @sgratzl/chartjs-chart-boxplot, only needed for <lyra-box-plot>
# optional peer: maplibre-gl, only needed for <lyra-map> — also import
#   `maplibre-gl/dist/maplibre-gl.css` yourself once, since lyra-map only
#   ships its own legend/popup chrome CSS, not maplibre-gl's own stylesheet.
#   <lyra-map> falls back to OpenStreetMap's demo tile server when you don't
#   set `mapStyle` — fine for local dev, but NOT for production (no capacity
#   guarantees, requires an identifying User-Agent, subject to IP-blocking —
#   see https://operations.osmfoundation.org/policies/tiles/). Production
#   apps must supply their own `mapStyle`.
```

## Usage

Import just what you use (tree-shakeable, granular entry points):

```js
import '@aceshooting/lyra-ui/components/combobox/combobox.js';
import '@aceshooting/lyra-ui/components/combobox/option.js';
```

```html
<lyra-combobox label="Fruit" with-clear>
  <lyra-option value="a">Apple</lyra-option>
  <lyra-option value="b">Banana</lyra-option>
</lyra-combobox>
```

…or pull the whole library:

```js
import '@aceshooting/lyra-ui';
```

Imperative toast (a drop-in for `react-hot-toast`):

```js
import { toast } from '@aceshooting/lyra-ui';
toast({ message: 'Saved', variant: 'success' });
```

## For AI agents / LLMs

- **Using this library from a consuming project?** See [`llms.txt`](./llms.txt) (short index) and
  [`llms-full.txt`](./llms-full.txt) (full API reference) in this package directory — a
  consumer-facing reference for coding assistants integrating `@aceshooting/lyra-ui`.
- **Contributing to this repo itself?** See [`../../AGENTS.md`](../../AGENTS.md) instead — that's a
  contributor guide for agents working *on* lyra-ui, not the same document as the two above.

## Migrating from Web Awesome Pro

Everything a consumer touches is mirrored 1:1 — only the prefix differs:

```
<wa-combobox value="x" multiple with-clear>  →  <lyra-combobox value="x" multiple with-clear>
<wa-date-input value="2026-07-15">           →  <lyra-date-input value="2026-07-15">
```

## Theming

Components read Web Awesome's `--wa-*` design tokens (with `--lyra-*` fallbacks). Inside a
WA app they inherit your theme automatically; standalone, they use sensible defaults.

## Components

All 38 tags below have shipped across five incremental releases (v1, then Tier 1, Tier 2,
Tier 3, then a map/file-input batch, then widget). Grouped by the release that introduced each.

**v1 — form controls, toasts, sparkline**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-combobox>` + `<lyra-option>` | `wa-combobox` | Filterable single/multi select, form-associated; async data via `source` property, virtual scrolling with `max-render` |
| `<lyra-select>` | `wa-select` | Closed-list single-select, button trigger (not a text input, no filtering); form-associated, shares `<lyra-option>` with `lyra-combobox` |
| `<lyra-date-picker>` | `wa-date-picker` | Inline calendar, single + range |
| `<lyra-date-input>` | `wa-date-input` | Date field + calendar popover, form-associated |
| `<lyra-toast>` + `<lyra-toast-item>` + `toast()` | `wa-toast` / `wa-toast-item` | Stacking notifications |
| `<lyra-sparkline>` | `wa-sparkline` | Zero-dependency inline SVG |
| `<lyra-flag>` | — (extra) | Country/language flags for i18n pickers — needs the optional peer `@aceshooting/lyra-flags` |

**Tier 1 — dashboard atoms**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-empty>` | — (extra) | Generic empty/no-data state |
| `<lyra-skeleton>` | — (extra) | Loading placeholder (pulse/sheen) |
| `<lyra-stat>` | — (extra) | KPI/stat card with trend pill |
| `<lyra-table>` | — (extra) | Presentational, sort/select-aware data table |
| `<lyra-gauge>` | — (extra) | Radial or linear meter |
| `<lyra-export-button>` | — (extra) | CSV/JSON download button, injection-safe CSV export |
| `<lyra-split>` | — (extra) | Resizable panel layout |
| `<lyra-widget>` | — (extra) | Card shell with collapsible header, fullscreen, and customizable chrome |
| `<lyra-word-cloud>` | — (extra) | Zero-dependency SVG word/tag cloud, spiral-placed by weight |

**Tier 2 — temporal & graph**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-time-range>` | — (extra) | Two-handle brush/scrubber over a numeric domain |
| `<lyra-playback>` | — (extra) | Play/pause index stepper on a fixed interval |
| `<lyra-heatmap>` | — (extra) | DPR-aware Canvas heatmap with matrix and calendar (`mode="calendar"`) layouts, `fit-to-width` responsive scaling |
| `<lyra-graph>` | — (extra) | Force-directed node-link diagram with pan/zoom/drag — needs the optional peer deps `d3-force`, `d3-drag`, `d3-zoom`, `d3-selection` |
| `<lyra-tree>` + `<lyra-tree-node>` | — (extra) | Expand/collapse hierarchy for graph/document navigation |

**Tier 3 — charts**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-chart>` | `wa-chart` | Core Chart.js wrapper (`Series`-based, plus raw `config` passthrough) — needs the optional peer deps `chart.js`, `chartjs-plugin-zoom` |
| `<lyra-bar-chart>`, `<lyra-line-chart>`, `<lyra-pie-chart>`, `<lyra-doughnut-chart>`, `<lyra-scatter-chart>`, `<lyra-bubble-chart>`, `<lyra-radar-chart>`, `<lyra-polar-area-chart>` | `wa-chart` | Typed `<lyra-chart>` subclasses with `type` locked — same optional peer deps as `<lyra-chart>` |
| `<lyra-box-plot>` | — (extra) | Box-and-whisker chart from precomputed five-number summaries — needs `chart.js`, `chartjs-plugin-zoom`, and `@sgratzl/chartjs-chart-boxplot` |
| `<lyra-histogram>` | — (extra) | Bins raw values (`binValues()`) and renders a bar chart — same optional peer deps as `<lyra-chart>` |
| `<lyra-lite-chart>` | — (extra) | Dependency-free bar/line chart (plain SVG/DOM) — **no optional peer deps**, for projects that forbid a charting dependency outright |

**Map & file-input**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-map>` | — (extra) | maplibre-gl wrapper with declarative legend, choropleth GeoJSON layer, and point markers (via `markers` property), plus a raw `map` escape hatch — needs the optional peer `maplibre-gl` (see Install above). Defaults to OpenStreetMap's demo tiles when `mapStyle` is unset — **production apps must supply their own `mapStyle`** (see Install above / Known limitations) |
| `<lyra-file-input>` | — (extra) | Drag-drop + click-to-browse file dropzone, emits raw `File[]` (no CSV/XLSX parsing — that's host-specific) |

## Known limitations

A non-exhaustive list of gaps a new consumer should know about before adopting:

- `<lyra-map>`'s default `mapStyle` (used only when you don't set one) points at OpenStreetMap's
  shared demo tile server — convenient for local development, but its usage policy forbids
  bulk/production traffic and non-compliant clients are rate-limited or IP-blocked (see
  https://operations.osmfoundation.org/policies/tiles/). Always pass your own `mapStyle` in
  production (a hosted vector/raster style from a tile provider you have a plan with).
- `<lyra-split>` has no feasibility check on `min` vs. panel count (e.g. 3 panels with `min=40` is
  unsatisfiable) — the result is a silently frozen splitter with no warning.
- `<lyra-file-input>` has no paste-from-clipboard support and doesn't specially detect a dragged
  folder (surfaces as a phantom zero-byte file rather than a clear rejection).

## Development

Run from the repo root (this package is part of a pnpm workspace):

```bash
pnpm install
pnpm test        # @web/test-runner + Playwright (Chromium) + axe a11y
pnpm lint        # tsc --noEmit
pnpm build       # tsc → dist/ (ESM + .d.ts)
pnpm manifest    # custom-elements.json
pnpm docs        # Storybook docs site, demos this package + lyra-flags together
```

## License

[MIT](./LICENSE) © 2026 Aceshooting
