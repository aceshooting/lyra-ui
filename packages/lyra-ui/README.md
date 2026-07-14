# Lyra UI

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)

**Web Awesome, plus.** Free, clean-room [Lit](https://lit.dev) web components — a companion to
[Web Awesome](https://webawesome.com) that provides open-source equivalents of selected,
documented Web Awesome **Pro** surfaces (form controls, date pickers, toasts, charts, …), *plus*
dozens of original components Web Awesome has no equivalent for at all — dashboard atoms, a chart
family, temporal/graph/map visualizations, and (newest) a full **Conversation & Agent UI** family
for building chat/agent products: message bubbles, streaming text, tool-call chips and approval
dialogs, citations, model/settings pickers, and more. Token-compatible with Web Awesome, so the
mirrored components look native inside a WA app, and everything is fully usable standalone.

> **Independent project.** Not affiliated with or endorsed by Web Awesome, and no `wa-` prefix or
> Web Awesome trademark/branding is used here. For components that *do* have a Web Awesome
> counterpart, this package gives you a free, open-source component wherever Web Awesome Pro
> normally charges — the public API (attributes, slots, events, CSS parts) mirrors Web Awesome's
> own documented surface under the `lyra-` prefix. Read the migration notes and component entry
> before treating a migration as a drop-in swap — but every implementation in this package is original
> (clean-room; no Web Awesome Pro source was ever available to or copied by this project). Most of
> the library, and all of the Conversation & Agent UI family, has no Web Awesome counterpart to
> mirror in the first place — see the "Mirrors" column in the tables below.

## Install

```bash
npm install @aceshooting/lyra-ui
# runtime dependencies: Lit and Floating UI are installed transitively with this package
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

These component entry points register their tags. For a class-only import (for subclassing or
type-directed composition), use the matching `.class.js` entry, such as
`@aceshooting/lyra-ui/components/empty/empty.class.js`; class-only entries do not touch the
custom-element registry.

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

This registers every component **except** `<lyra-chart>` and its typed subclasses,
`<lyra-box-plot>`, `<lyra-histogram>`, `<lyra-map>`, and `<lyra-graph>` — each of those
needs an optional peer dependency (see Install above), so they always require their
own explicit subpath import, even when pulling the rest of the library in bulk:

```js
import '@aceshooting/lyra-ui/components/chart/chart.js';
import '@aceshooting/lyra-ui/components/map/map.js';
import '@aceshooting/lyra-ui/components/graph/graph.js';
```

The root import registers `<lyra-flag>` without pulling in the optional flag asset graph. If a
flag uses `country` or `language`, also import the peer registration entry once:

```js
import '@aceshooting/lyra-ui/components/flag/flag-peer.js';
```

Passing a pre-resolved `src` does not require that entry.

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

For every component marked with a `wa-*` counterpart in the "Mirrors" column, the documented
compatible surface (attributes, slots, events, CSS parts, and custom properties) uses the same
public names under the `lyra-` prefix. Read the component notes before migrating: for example,
Lyra's combobox uses `with-clear`, while Web Awesome's equivalent uses `clearable`.

```
<wa-combobox value="x" multiple with-clear>  →  <lyra-combobox value="x" multiple with-clear>
<wa-date-input value="2026-07-15">           →  <lyra-date-input value="2026-07-15">
```

Everything else in the tables below — marked `— (extra)` — has no Web Awesome equivalent to
migrate *from* in the first place, so there's nothing to rename: install the package and import
what you need (see Usage above). That's most of this library, including every dashboard atom
(stat cards, gauges, empty/skeleton states), the whole chart family, the temporal/graph/tree
components, `<lyra-map>`, and the entire **Conversation & Agent UI** family (chat messages,
streaming text, tool-call chips/dialogs, citations, model/settings pickers, and more) — Web
Awesome has no chat/agent UI component family at all.

## Theming, internationalization & RTL

Every component is built on the same three guarantees, verified across the whole library rather
than opt-in per component:

**Theming.** Components read Web Awesome's `--wa-*` design tokens (with `--lyra-*` fallbacks).
Inside a WA app they inherit your theme automatically; standalone, they use sensible defaults —
override any `--lyra-*`/`--wa-*` custom property to retheme.

**Internationalization.** Every built-in string (button labels, status announcements,
`aria-label`s) resolves through a small runtime, in two ways you can combine:

```ts
import { registerLyraLocale, setLyraLocale } from '@aceshooting/lyra-ui';

// App-wide: register translations once, anywhere in the app.
registerLyraLocale('fr', { close: 'Fermer', retry: 'Réessayer', /* ... */ });
setLyraLocale('fr'); // or just set <html lang="fr">/an ancestor `lang` — components pick it up
```

```html
<!-- Per-instance: override specific keys on one element without a global registry. -->
<lyra-toast .strings=${{ close: 'Fermer' }}></lyra-toast>
```

No rebuild, no per-locale bundle, no per-component API to learn — register the strings once and
every component that uses that key picks it up reactively, including ones added after your app's
first render.

**RTL.** Set `dir="rtl"` on `<html>` or any ancestor (or just a `lang` whose default direction is
RTL, e.g. `ar`/`he`/`fa`) — every component mirrors its layout automatically via CSS logical
properties and swaps directional keyboard navigation (e.g. the arrow keys in a date grid or a
roving-tabindex list) to match. No per-component RTL flag or opt-in needed.

## Components

The catalog below lists all 93 tags in the current Custom Elements Manifest, grouped by
capability. The manifest and live docs are the authoritative sources for the complete generated
API details.

**Form controls, toasts, sparkline, and flags**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-combobox>` + `<lyra-option>` | `wa-combobox` | Filterable single/multi select, form-associated; async data via `source` property, virtual scrolling with `max-render` |
| `<lyra-select>` | `wa-select` | Closed-list single-select, button trigger (not a text input, no filtering); form-associated, shares `<lyra-option>` with `lyra-combobox` |
| `<lyra-date-picker>` | `wa-date-picker` | Inline calendar, single + range |
| `<lyra-date-input>` | `wa-date-input` | Date field + calendar popover, form-associated |
| `<lyra-toast>` + `<lyra-toast-item>` + `toast()` | `wa-toast` / `wa-toast-item` | Stacking notifications |
| `<lyra-sparkline>` | `wa-sparkline` | Zero-dependency inline SVG |
| `<lyra-textarea>` | `wa-textarea` | Bare multiline plain-text input, form-associated |
| `<lyra-flag>` | — (extra) | Country/language flags for i18n pickers — needs the optional peer `@aceshooting/lyra-flags` |

**Dashboard atoms**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-empty>` | — (extra) | Generic empty/no-data state |
| `<lyra-skeleton>` | — (extra) | Loading placeholder (pulse/sheen) |
| `<lyra-stat>` | — (extra) | KPI/stat card with trend pill and an optional breakdown row list; either can carry an `exactValue` shown as a hover/focus tooltip alongside the rounded/formatted display value |
| `<lyra-table>` | — (extra) | Presentational, sort/select-aware data table; a column's responsive `priority` (`medium`/`low`) hides it first as the container narrows, with a reveal-columns button to force hidden columns back |
| `<lyra-gauge>` | — (extra) | Radial or linear meter |
| `<lyra-export-button>` | — (extra) | CSV/JSON download button, injection-safe CSV export |
| `<lyra-copy-button>` | — (extra) | Standalone icon-only copy-to-clipboard button for a plain text value, no positioning opinion |
| `<lyra-split>` | — (extra) | Resizable panel layout; one pane can opt into responsive `collapse` (`"start"`/`"end"`) to a fixed-width rail, then a floating overlay card, as the split's container narrows |
| `<lyra-widget>` | — (extra) | Card shell with collapsible header, fullscreen, and customizable chrome |
| `<lyra-word-cloud>` | — (extra) | Zero-dependency SVG word/tag cloud, spiral-placed by weight |

**Temporal & graph**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-time-range>` | — (extra) | Two-handle brush/scrubber over a numeric domain |
| `<lyra-playback>` | — (extra) | Play/pause index stepper on a fixed interval |
| `<lyra-heatmap>` | — (extra) | DPR-aware Canvas heatmap with matrix and calendar (`mode="calendar"`) layouts, `fit-to-width` responsive scaling |
| `<lyra-graph>` | — (extra) | Force-directed node-link diagram with pan/zoom/drag — needs the optional peer deps `d3-force`, `d3-drag`, `d3-zoom`, `d3-selection` |
| `<lyra-tree>` + `<lyra-tree-node>` | — (extra) | Expand/collapse hierarchy for graph/document navigation |

**Charts**

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

**Conversation & Agent UI — chat/agent product building blocks**

Web Awesome has no chat/agent UI component family at all, so every component in this table is
original to lyra-ui (`— (extra)`) — there's nothing to migrate from. See
[`llms-full.txt`](./llms-full.txt) for the full API (properties, events, parts, tokens) behind
each one-liner below.

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-chat-message>` | — (extra) | Role-based (`user`/`assistant`/`system`) message bubble shell; avatar/badges header, status-aware footer (built-in retry on `status="failed"`), attachments strip — renders no message content itself, just the chrome around a slotted body |
| `<lyra-typing-indicator>` | — (extra) | Purely presentational "assistant is responding" cue; `dots`/`pulse`/`cursor` variants |
| `<lyra-streaming-text>` | — (extra) | Token-coalescing incremental text renderer for streamed output; auto-detects Markdown (or force via `markdown`), optional blinking cursor |
| `<lyra-thinking-panel>` | — (extra) | Collapsible panel for an agent's intermediate reasoning transcript; `live` mode auto-scrolls (stick-to-bottom) while streaming, `post-hoc` doesn't |
| `<lyra-generation-status>` | — (extra) | Ticking elapsed-time / token-count / throughput readout for an in-progress response, plus a built-in Stop button |
| `<lyra-stream-status>` | — (extra) | Compact transport-health indicator (`idle`/`connecting`/`streaming`/`stalled`) with heartbeat-aware stall detection via `recordActivity()` |
| `<lyra-markdown>` | — (extra) | Sanitized Markdown → HTML (GFM tables, fenced code, links); lazy-loads the optional peers `marked` + `dompurify` |
| `<lyra-code-block>` | — (extra) | Fenced code display with a copy button; lazy-loads the optional peer `shiki` for syntax highlighting, degrades to plain `<pre><code>` without it |
| `<lyra-live-region>` | — (extra) | Throttled/coalesced ARIA live-region announcer for streaming UIs, built on the reusable internal `Announcer` engine |
| `<lyra-chat-composer>` | — (extra) | Auto-resizing message `<textarea>` + built-in send/stop button; form-associated, Enter-to-send with Shift+Enter/IME handling |
| `<lyra-attachment-chip>` | — (extra) | Pre-send or sent file chip with thumbnail/size/upload-progress/retry; derives metadata from a real `File` or from persisted server metadata |
| `<lyra-attachment-trigger>` | — (extra) | Attach-file affordance for a composer's leading slot; a single icon button, or a `<lyra-menu>` when more than one capability (`files`/`image`/`camera`) is configured |
| `<lyra-mention-popover>` | — (extra) | Caret-anchored `@`-mention/`/`-command autocomplete popover for a host-owned `<textarea>`/`<input>`; never takes DOM focus itself |
| `<lyra-tool-call-chip>` | — (extra) | Compact inline pill for one tool/function call mid-conversation; status-aware glyph/color, optional hover/focus detail tooltip |
| `<lyra-tool-result-view>` + `registerToolRenderer()` | — (extra) | Dispatches a tool call's result to a host-registered renderer (by tool name or shape `matches()`), falling back to `<lyra-json-viewer>` |
| `<lyra-tool-result-dialog>` | — (extra) | Full tool-call detail overlay: status/duration header plus a consumer-assembled `body` slot (typically a `<lyra-tabs>` of Input/Preview/JSON/Raw) |
| `<lyra-tool-approval-dialog>` | — (extra) | Human-in-the-loop approve/deny gate for one proposed tool call, with an optional inline JSON argument editor before approving |
| `<lyra-tool-param-form>` | — (extra) | Renders one form control per property of a flat JSON Schema object, for ad hoc tool invocation or approval-time argument editing |
| `<lyra-tool-select-dialog>` | — (extra) | Category-grouped, filterable, searchable dialog for picking which agent tools are enabled in a conversation |
| `<lyra-json-viewer>` | — (extra) | Collapsible, copyable tree view for an arbitrary JSON value; path-keyed expand state survives a streamed in-place `data` patch |
| `<lyra-citation-badge>` | — (extra) | Inline `[n]` citation marker with a hover/focus preview popover and confidence/verification-status coloring |
| `<lyra-source-list>` + `<lyra-source-card>` | — (extra) | Collapsible "Sources" panel for one chat message, grouping per-source cards with an excerpt + "Show more" full-text toggle |
| `<lyra-conversation-item>` | — (extra) | Selectable chat-history row with inline rename; usable standalone or as `<lyra-virtual-list>`'s `renderItem()` payload |
| `<lyra-virtual-list>` | — (extra) | Generic windowed/virtualized list host — renders only the viewport's rows as real DOM, for a multi-thousand-row history sidebar |
| `<lyra-app-rail>` + `<lyra-app-rail-item>` | — (extra) | Responsive navigation rail: `full` ↔ `icon-only` ↔ `mobile` overlay, tracked off live viewport-width breakpoints; the item provides an accessible icon/label link or button |
| `<lyra-responsive-panel>` | — (extra) | The same slotted content docked inline in normal layout flow (desktop) or as a fullscreen/bottom-sheet overlay (mobile) |
| `<lyra-dock-panel>` | — (extra) | Single panel docked to one edge of its container, drag/keyboard-resizable and collapsible — the single-edge counterpart to `<lyra-split>`'s multi-sibling-panel case |
| `<lyra-model-select>` | — (extra) | Provider/model picker: closed dropdown over a fixed `catalog`, or a filterable free-text combobox when there isn't one (or `allow-custom` is set) |
| `<lyra-model-settings-panel>` | — (extra) | Fixed `<lyra-model-select>` + `<lyra-slider>` composition for picking a model and tuning its sampling temperature in one `lyra-change` |
| `<lyra-slider>` | — (extra) | Numeric range control (e.g. an LLM "temperature" setting), form-associated, mirrors native `<input type="range">` semantics |
| `<lyra-context-meter>` | — (extra) | Segmented bar/ring occupancy meter for a token budget or context window, split across labeled categories |
| `<lyra-dialog>` + `confirm()` | — (extra) | General-purpose modal/overlay (focus-trapped, Escape/backdrop-dismissible, scroll-locking, dialog stacking); `confirm()` is a promise-based `window.confirm()` replacement built on it |
| `<lyra-tabs>` | — (extra) | Tab strip over direct light-DOM panels; WAI-ARIA APG automatic-activation keyboard pattern |
| `<lyra-checkbox>` | — (extra) | Boolean form control, `role="checkbox"` with a visual/`indeterminate` mixed state |
| `<lyra-switch>` | — (extra) | Boolean toggle-switch form control, `role="switch"` on/off semantics |
| `<lyra-menu>` + `<lyra-menu-item>` | — (extra) | Anchored dropdown menu around a consumer-supplied trigger; WAI-ARIA "menu button" pattern with real roving focus (not a listbox) |
| `<lyra-chip>` + `<lyra-chip-group>` | — (extra) | Content-agnostic label pill (tag/filter/scope indicator) and a flex-wrap group with a "+N" overflow indicator |
| `<lyra-kbd>` | — (extra) | Keyboard-shortcut chip; renders platform-appropriate glyphs (⌘ vs. Ctrl) from a single `"mod+k"`-style `keys` string |
| `<lyra-result-card>` + `<lyra-result-field>` | — (extra) | Small bordered card + label/value row shell, for giving custom `lyra-tool-result-view` renderers a consistent look with no bespoke box |
| `<lyra-document-preview>` | — (extra) | Format-dispatching document/attachment viewer (`text/*`/JSON inline, `image/*` inline, else a download fallback) plus a host-driven async-conversion status shell |
| `<lyra-media-card>` | — (extra) | Lightweight inline preview for one already-sent image/video/file attachment inside a rendered chat message |
| `<lyra-avatar>` | — (extra) | Small, fixed-size identity marker — image, or an initials fallback with `lyra-chip`-style tone recoloring |
| `<lyra-card>` | — (extra) | Generic bordered content container (`header`/`media`/`footer`/`actions` slots) — a direct `<lyra-*>` counterpart to `wa-card` |
| `<lyra-stepper>` | — (extra) | Ordered multi-step wizard navigation — label + index, current/completed/locked/error state, click-to-jump, data-driven and controlled |
| `<lyra-segmented>` | — (extra) | Single-select button row with the WAI-ARIA APG `radiogroup` contract built in (roving tabindex, automatic activation) |
| `<lyra-diff-view>` | — (extra) | Real two-string line diff (LCS-aligned), rendered as interleaved unified-diff output |
| `<lyra-poll-status>` | — (extra) | "Next scheduled refresh" countdown with a built-in pause control and live-region announcements |
| `<lyra-code-block-core>` | — (extra) | Build-lean `lyra-code-block` variant for a consumer whose `languages` map already covers every language it renders — never references shiki's full ~200-language table |

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
