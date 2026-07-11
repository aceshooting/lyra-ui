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
#   ships its own legend/popup chrome CSS, not maplibre-gl's own stylesheet
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

All 34 tags below have shipped across five incremental releases (v1, then Tier 1, Tier 2,
Tier 3, then a map/file-input batch). Grouped by the release that introduced each. Planned
follow-up work is tracked internally and not yet published as part of this repo's committed docs.

**v1 — form controls, toasts, sparkline**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-combobox>` + `<lyra-option>` | `wa-combobox` | Filterable single/multi select, form-associated |
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

**Tier 2 — temporal & graph**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-time-range>` | — (extra) | Two-handle brush/scrubber over a numeric domain |
| `<lyra-playback>` | — (extra) | Play/pause index stepper on a fixed interval |
| `<lyra-heatmap>` | — (extra) | DPR-aware Canvas matrix heatmap (matrix layout only today — see Known limitations) |
| `<lyra-graph>` | — (extra) | Force-directed node-link diagram with pan/zoom/drag — needs the optional peer deps `d3-force`, `d3-drag`, `d3-zoom`, `d3-selection` |
| `<lyra-tree>` + `<lyra-tree-node>` | — (extra) | Expand/collapse hierarchy for graph/document navigation |

**Tier 3 — charts**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-chart>` | `wa-chart` | Core Chart.js wrapper (`Series`-based, plus raw `config` passthrough) — needs the optional peer deps `chart.js`, `chartjs-plugin-zoom` |
| `<lyra-bar-chart>`, `<lyra-line-chart>`, `<lyra-pie-chart>`, `<lyra-doughnut-chart>`, `<lyra-scatter-chart>`, `<lyra-bubble-chart>`, `<lyra-radar-chart>`, `<lyra-polar-area-chart>` | `wa-chart` | Typed `<lyra-chart>` subclasses with `type` locked — same optional peer deps as `<lyra-chart>` |
| `<lyra-box-plot>` | — (extra) | Box-and-whisker chart from precomputed five-number summaries — needs `chart.js`, `chartjs-plugin-zoom`, and `@sgratzl/chartjs-chart-boxplot` |
| `<lyra-histogram>` | — (extra) | Bins raw values (`binValues()`) and renders a bar chart — same optional peer deps as `<lyra-chart>` |

**Map & file-input**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-map>` | — (extra) | maplibre-gl wrapper with declarative legend + choropleth GeoJSON layer, plus a raw `map` escape hatch — needs the optional peer `maplibre-gl` (see Install above) |
| `<lyra-file-input>` | — (extra) | Drag-drop + click-to-browse file dropzone, emits raw `File[]` (no CSV/XLSX parsing — that's host-specific) |

## Known limitations

A non-exhaustive list of gaps a new consumer should know about before adopting (tracked
internally; fix status isn't yet published as a committed doc in this repo):

- `required` doesn't yet enforce constraint validation on `<lyra-date-input>`/`<lyra-combobox>` —
  neither calls `internals.setValidity()`, so `form.reportValidity()`/`checkValidity()` always
  return `true` regardless of whether a required field is empty.
- `<lyra-tree>` has no keyboard interaction yet — only the expand/collapse button is focusable;
  row selection and tree navigation (arrow keys, Home/End) have no keyboard path.
- `<lyra-heatmap>` is matrix-only today, despite its description mentioning calendar layouts — a
  calendar-heatmap rendering mode isn't implemented yet.
- `<lyra-file-input>`'s `accept` attribute only constrains the native file-picker dialog; it has
  no effect on the drag-drop path, so dropped files of a type `accept` would otherwise exclude are
  silently accepted unless you also set `allowedMimeTypes`/`forbiddenMimeTypes`.

## Development

Run from the repo root (this package is part of a pnpm workspace):

```bash
pnpm install
pnpm test        # @web/test-runner + Playwright (Chromium) + axe a11y
pnpm lint        # tsc --noEmit
pnpm build       # tsc → dist/ (ESM + .d.ts)
pnpm manifest    # custom-elements.json
pnpm docs        # Vite playground, demos this package + lyra-flags together
```

## License

[MIT](./LICENSE) © 2026 Aceshooting
