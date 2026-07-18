# Lyra UI

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)
[![website](https://img.shields.io/badge/website-lyra--ui.com-6366f1)](https://www.lyra-ui.com/)

<p align="center">
  <a href="https://www.lyra-ui.com/">
    <img src="https://raw.githubusercontent.com/aceshooting/lyra-ui/main/.github/readme/lyra-mark.svg" width="112" height="112" alt="Lyra UI constellation logo" />
  </a>
</p>

**Lyra UI — the free, independent web-component alternative.** A MIT-licensed [Lit](https://lit.dev)
library for accessible forms, dashboards, charts, data visualization, and Conversation & Agent UI.
It is a practical open-source alternative to [Shoelace](https://shoelace.style/) and
[Web Awesome](https://webawesome.com/), with 222 custom elements, native custom-element APIs,
tree-shakeable imports, its own `--lyra-*` design tokens, built-in localization and RTL support,
and no runtime dependency on either project.

> **Independent implementation.** Lyra is not affiliated with, endorsed by, or a fork or rebrand of
> Shoelace or Web Awesome. Selected Web Awesome-compatible components retain documented public names
> under the `lyra-` prefix to make migration easier; component notes identify differences. Shoelace
> users get a separate `sl-*` migration map because the APIs are not identical. No competitor runtime,
> theme, token namespace, or source code is required by Lyra.

## Install

```bash
npm install @aceshooting/lyra-ui
# runtime dependencies: Lit and Floating UI are installed transitively with this package
# optional peer: @aceshooting/lyra-flags, only needed for <lyra-flag>
# optional peer: libphonenumber-js, only when creating a <lyra-phone-input>
#   adapter with loadLibphonenumberAdapter(); it is never imported by lyra-ui
#   and international E.164 input works without it
# optional peer: d3-force, d3-drag, d3-zoom, d3-selection, only needed for <lyra-graph>
# optional peer: chart.js, chartjs-plugin-zoom, only needed for the <lyra-*-chart>/<lyra-histogram> family
# optional peer: @sgratzl/chartjs-chart-boxplot, only needed for <lyra-box-plot>
# optional peers: mammoth and dompurify, only needed for <lyra-docx-viewer>
#   — Mammoth converts DOCX files to semantic HTML instead of pixel-exact Word page layout.
# optional peer: jszip, only needed for <lyra-archive-viewer>
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

## Migrating from Web Awesome or Shoelace

For a component marked with a `wa-*` counterpart in the "Mirrors" column, Lyra keeps the documented
public vocabulary where practical: attributes, slots, events, CSS parts, and custom properties use
the same names under the `lyra-` prefix. This makes many migrations a predictable import and tag-name
change, while the component notes remain authoritative for intentional differences. For example,
Lyra's combobox uses `with-clear`, while Web Awesome's equivalent uses `clearable`.

```
<wa-combobox value="x" multiple with-clear>  →  <lyra-combobox value="x" multiple with-clear>
<wa-date-input value="2026-07-15">           →  <lyra-date-input value="2026-07-15">
```

**Automating the rename.** This repo ships a small codemod that performs the mechanical part of
either migration: [`scripts/migrate-wa.mjs`](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/migrate-wa.mjs)
(run from a checkout of this repository — it isn't published as part of the npm package) rewrites
`wa-*`/`sl-*` tag usages and `@shoelace-style/shoelace`/`@awesome.me/webawesome` import specifiers
to their `lyra-*`/`@aceshooting/lyra-ui` equivalents across a target directory, file, or glob,
reading the very tables on this page so the rename can't drift out of sync with them:

```bash
node packages/lyra-ui/scripts/migrate-wa.mjs --dry-run path/to/your/src   # preview only
node packages/lyra-ui/scripts/migrate-wa.mjs path/to/your/src             # apply
```

It only rewrites a tag or import that this page documents a `lyra-*`/`@aceshooting/lyra-ui`
equivalent for — a component's `— (extra)` row (no Web Awesome/Shoelace counterpart) and any
`wa-*`/`sl-*` text that isn't an actual tag usage (comments, unrelated identifiers) are left alone.
It does not rewrite attribute-name differences (e.g. Web Awesome's `clearable` vs. Lyra's
`with-clear`) or deep import subpaths (`.../dist/components/button/button.js`, since Lyra's own
subpath layout doesn't mirror Shoelace's or Web Awesome's) — those are flagged instead, and still
need the component notes below.

Shoelace is now a historical predecessor to Web Awesome, but its component vocabulary remains
familiar to many teams. Lyra provides a conceptual migration path rather than claiming a drop-in
`sl-*` replacement:

| Shoelace | Lyra | Migration note |
|---|---|---|
| `<sl-button>` | `<lyra-button>` | Check `variant`, `appearance`, and loading behavior. |
| `<sl-input>` / `<sl-textarea>` | `<lyra-input>` / `<lyra-textarea>` | Preserve the native editing and form contract; review label/error markup. |
| `<sl-select>` / `<sl-option>` | `<lyra-select>` / `<lyra-option>` | Review option and value events. |
| `<sl-dialog>` / `<sl-drawer>` | `<lyra-dialog>` / `<lyra-drawer>` | Review close reasons, focus behavior, and slots. |
| `<sl-card>` / `<sl-badge>` / `<sl-callout>` | `<lyra-card>` / `<lyra-badge>` / `<lyra-callout>` | Review appearance tokens and dismiss events. |
| `<sl-spinner>` / `<sl-progress-bar>` | `<lyra-spinner>` / `<lyra-progress-bar>` | Built-in status copy is localized through Lyra's runtime. |

For either migration, update the package import, replace the custom-element prefix, run the
component's accessibility story, and check its API notes for behavior that cannot be inferred from
the tag name alone. Lyra's own `--lyra-theme-*` variables are the only theme inputs it reads. For a
staged Web Awesome migration, map existing values explicitly in application CSS; Lyra does not read
competitor token variables itself.

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

**Theming.** Components read independent `--lyra-theme-*` variables and standalone defaults. Lyra
does not depend on another library's theme or token namespace. For a ready-made light/dark base
theme, import `@aceshooting/lyra-ui/theme.css` once and toggle `.lyra-light`/`.lyra-dark` (or the
matching `data-lyra-theme` attribute) on an ancestor:

```css
@import '@aceshooting/lyra-ui/theme.css';
```

```html
<body class="lyra-dark">
  <lyra-button variant="brand">Save</lyra-button>
</body>
```

Applications can override any `--lyra-theme-*` input directly:

```css
:root {
  --lyra-theme-color-surface-default: #101827;
  --lyra-theme-color-text-normal: #f8fafc;
  --lyra-theme-color-brand-fill-loud: #60a5fa;
  --lyra-theme-font-size-m: 1rem;
  --lyra-theme-border-radius-m: 0.5rem;
}
```

See `internal/tokens.styles.ts` for the complete shared token list. Component-specific `--lyra-*`
custom properties remain available for local overrides.

**Frontend quality guarantees.** Every component is designed as a native custom element and tested
for the contract that applies to its shape: semantic roles and accessible names inside shadow DOM,
keyboard navigation, bubbling/composed public events, native form association and validity, logical
CSS for RTL, narrow-container layouts, reduced motion, and forced-colors behavior. Form controls
expose label, hint, error, focus, editing, reset, and validity behavior instead of hiding the useful
native contract behind a private input. Heavy integrations such as Chart.js, MapLibre, D3, Shiki,
Markdown, phone-number metadata, and flag artwork remain optional peer dependencies.

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

Lyra's default messages are English fallbacks, while applications own the translated catalog. Date,
number, byte, relative-time, and calendar formatting use the browser's `Intl` APIs and the resolved
locale. Consumer-provided labels, values, file names, and message content are never altered by the
localization layer. The same runtime also covers accessible names, descriptions, validation messages,
live-region announcements, empty states, status labels, and action buttons; use `.strings` for a
component-specific override when needed.

**RTL.** Set `dir="rtl"` on `<html>` or any ancestor (or just a `lang` whose default direction is
RTL, e.g. `ar`/`he`/`fa`) — every component mirrors its layout automatically via CSS logical
properties and swaps directional keyboard navigation (e.g. the arrow keys in a date grid or a
roving-tabindex list) to match. This covers Arabic, Hebrew, Persian, Urdu, and other RTL locales
through inherited direction; no per-component RTL flag or opt-in is needed. Components do not force
their own `dir`, so they remain composable inside mixed-direction layouts.

## SSR & Declarative Shadow DOM

Every Lyra component is a standard Lit 3 custom element (`extends LitElement` via the shared
`LyraElement` base), so it follows Lit's own server-rendering story rather than needing anything
library-specific: [`@lit-labs/ssr`](https://www.npmjs.com/package/@lit-labs/ssr) can render a Lyra
component to a Declarative Shadow DOM (DSD) `<template shadowrootmode="open">` on the server, so the
resulting markup paints before any JS runs. A spot check rendering `<lyra-button>` through
`@lit-labs/ssr`'s `render()` confirms this in practice — the output is a well-formed DSD template
containing the component's token CSS and internal `<button>` markup, and the constructor's
`ElementInternals`-based `attachInternals()` call (used for native form association) does not throw
under `@lit-labs/ssr-dom-shim`'s server DOM shim.

That said, **lyra-ui has not been systematically tested or tuned for SSR** across its full component catalog:
no CI job renders the library under `@lit-labs/ssr`, no component has been verified to hydrate
correctly on the client afterward, and components that reach for browser-only APIs early
(`ResizeObserver`/`IntersectionObserver`, Floating UI positioning in the popover/tooltip/dropdown
family, `matchMedia` listeners, canvas-based rendering in `<lyra-heatmap>`/the chart family) have not
been checked for graceful server-side behavior. Treat SSR/DSD as "should work in principle, unverified
at scale" rather than a tested, supported deployment target — a meta-framework's own web-component SSR
integration (or a custom `@lit-labs/ssr` server) is still the right place to start, and an issue report
with the specific component and framework is welcome if something breaks.

## Framework integration (Vue, Angular, Svelte)

Lyra ships plain custom elements with no framework-specific wrapper package, so the friction is the
same friction any custom-element library has with a non-Lit framework, not anything Lyra-specific:

- **Property vs. attribute binding.** A complex-typed property (an object, array, or function — e.g.
  `.strings`, `.selectedRows`, `.markers`) must be bound as a JS *property*, not a stringified
  attribute. Use Vue's `:prop` binding (or the `.prop` modifier), Angular's `[prop]="value"` template
  binding, or a plain property assignment; Svelte's compiler binds to a matching element property
  automatically when one exists, so `prop={value}` mostly just works. A bare `attr="value"` or string
  interpolation only ever sets a string attribute — fine for `variant="brand"`, wrong for anything
  non-string.
- **Angular needs `CUSTOM_ELEMENTS_SCHEMA`.** Angular's template compiler rejects unknown elements
  and properties by default. Add `schemas: [CUSTOM_ELEMENTS_SCHEMA]` to the module (or standalone
  component) that uses any `<lyra-*>` tag so Angular stops trying to resolve it as an Angular
  component.
- **Custom events need the framework's DOM event-binding syntax, not its component-event
  shorthand.** A framework's usual event shorthand (Vue's `@event` on a *Vue component*, Angular's
  `(event)` output binding) is wired for that framework's own event system; a plain custom element's
  events are native `CustomEvent`s and need the same binding path used for native DOM events —
  `@lyra-change="handler"` in Vue, `(lyra-change)="handler()"` in Angular, `on:lyra-change` in Svelte,
  or `element.addEventListener('lyra-change', handler)` directly when a template binding isn't
  available. Lyra's own event names are consistently kebab-case (`lyra-change`, `lyra-cell-click`,
  `lyra-selection-change`, …) rather than camelCase, specifically to stay friendly to this binding
  path — some other custom-element libraries use camelCase event names, which can silently fail to
  bind in an in-DOM (non-compiled) Vue template because HTML attribute/directive names are
  case-insensitive there; `addEventListener` works regardless of case either way.

## Editor autocomplete (VS Code, JetBrains)

TypeScript consumers already get tag/attribute completion for free from the generated
`HTMLElementTagNameMap`. Plain HTML, and in-DOM Vue or Angular templates, don't go through that type
graph, so this package also ships small editor data files generated from `custom-elements.json`:
`vscode-html-data.json` (tag names, attributes, and slots) and `vscode-css-data.json` (every
`--lyra-*` custom property). Point VS Code's
[`html.customData`](https://code.visualstudio.com/docs/languages/html#_html-custom-data) and
[`css.customData`](https://code.visualstudio.com/docs/languages/css#_css-custom-data) settings at
them — typically in a workspace `.vscode/settings.json` so the whole team picks it up:

```json
{
  "html.customData": ["./node_modules/@aceshooting/lyra-ui/vscode-html-data.json"],
  "css.customData": ["./node_modules/@aceshooting/lyra-ui/vscode-css-data.json"]
}
```

Both settings accept an array, so add these alongside any other custom-data files the workspace
already references. WebStorm/IntelliJ users get the same tag/attribute/slot/CSS-part/custom-property
coverage automatically from the bundled `web-types.json` — JetBrains IDEs pick up a dependency's
`web-types.json` with no extra configuration once the package is installed.

## Components

The catalog below lists all 222 tags in the current Custom Elements Manifest, grouped by
capability. The manifest and live docs are the authoritative sources for the complete generated
API details.

**Form controls, toasts, sparkline, and flags**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-combobox>` + `<lyra-option>` | `wa-combobox` | Filterable single/multi select, form-associated; `xs`–`xl` sizing; async rich rows and retained selection payloads via `source`/`selectedRows`; virtual scrolling with `max-render` |
| `<lyra-select>` | `wa-select` | Closed-list single-select, button trigger (not a text input, no filtering); form-associated, shares `<lyra-option>` with `lyra-combobox` |
| `<lyra-date-picker>` | `wa-date-picker` | Inline calendar, single + range |
| `<lyra-date-input>` | `wa-date-input` | Date field + calendar popover, form-associated |
| `<lyra-phone-input>` | — (extra) | Country-aware telephone field with canonical E.164 form values; numbering metadata is supplied through an optional adapter |
| `<lyra-toast>` + `<lyra-toast-item>` + `toast()` | `wa-toast` / `wa-toast-item` | Stacking notifications |
| `<lyra-sparkline>` | `wa-sparkline` | Zero-dependency inline SVG |
| `<lyra-textarea>` | `wa-textarea` | Form-associated multiline field with label/hint/error chrome, auto-resize, native editing passthrough, and caret APIs |
| `<lyra-input>` | `wa-input` | Form-associated single-line field (`text`/`password`/`email`/`number`) with label/hint/error chrome and a built-in password-visibility toggle |
| `<lyra-number-input>` + `<lyra-time-input>` | `wa-number-input` / `wa-time-input` | Native number/time aliases retaining Lyra form and event contracts |
| `<lyra-color-picker>` | `wa-color-picker` | Form-associated native color picker with label/hint chrome |
| `<lyra-checkbox-group>` | — (extra) | Form-associated group of checkboxes with array values and group validation |
| `<lyra-token-input>` | — (extra) | Editable, removable form-associated token list |
| `<lyra-icon>` + `<lyra-icon-button>` | — (extra) | Dependency-free SVG icons and accessible icon-only actions |
| `<lyra-button>` | `wa-button` | Generic action-button primitive (`variant`/`appearance`/`size`/`loading`), owns `type="submit"`/`"reset"` via the closest ancestor `<form>` |
| `<lyra-radio>` + `<lyra-radio-group>` | `wa-radio` / `wa-radio-group` | Form-associated single-choice controls with roving arrow-key navigation and group validation |
| `<lyra-spinner>` | `wa-spinner` | Localized indeterminate busy indicator with reduced-motion support |
| `<lyra-progress-bar>` + `<lyra-progress-ring>` | `wa-progress-bar` / `wa-progress-ring` | Determinate or indeterminate progress indicators |
| `<lyra-flag>` | — (extra) | Country/language flags for i18n pickers — needs the optional peer `@aceshooting/lyra-flags` |

**Additional media and interaction primitives**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-animated-image>` | — (extra) | Animated image playback with a captured still frame and reduced-motion support |
| `<lyra-animation>` | — (extra) | Web Animations API wrapper for declarative preset or custom animations |
| `<lyra-avatar-group>` | — (extra) | Responsive avatar grouping with a localized overflow indicator |
| `<lyra-include>` | — (extra) | Loads sanitized HTML or text content from a URL |
| `<lyra-known-date>` | — (extra) | Form-associated date entry control with separate day, month, and year fields |
| `<lyra-lightbox>` | — (extra) | Full-screen modal image viewer with navigation and pan/zoom |
| `<lyra-qr-code>` | — (extra) | Canvas QR renderer; needs the optional peer `qrcode` |
| `<lyra-random-content>` | — (extra) | Random, unique, or sequential slotted-content selection with autoplay |
| `<lyra-timeline>` + `<lyra-timeline-item>` | — (extra) | Vertical or horizontal chronological event layout |
| `<lyra-tour>` | — (extra) | Anchored onboarding tour with spotlight, keyboard navigation, and focus management |

**Dashboard atoms**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-empty>` | — (extra) | Generic empty/no-data state |
| `<lyra-skeleton>` | — (extra) | Loading placeholder (pulse/sheen) |
| `<lyra-scroller>` | `wa-scroller` | Responsive overflow surface with optional navigation controls |
| `<lyra-resize-observer>` | `wa-resize-observer` | Lifecycle-managed ResizeObserver for slotted elements |
| `<lyra-intersection-observer>` | `wa-intersection-observer` | Lifecycle-managed IntersectionObserver for slotted elements |
| `<lyra-mutation-observer>` | `wa-mutation-observer` | Lifecycle-managed MutationObserver for slotted elements |
| `<lyra-stat>` | — (extra) | KPI/stat card with trend pill and an optional breakdown row list; either can carry an `exactValue` shown as a hover/focus tooltip alongside the rounded/formatted display value |
| `<lyra-table>` | — (extra) | Sort/select-aware data table with optional controlled filtering, client/server-friendly pagination, loading state, consumer-owned inline editing, expandable rows, sticky columns, and responsive `priority` columns |
| `<lyra-data-grid>` | — (extra) | Keyboard-navigable sortable grid with roving cell focus and responsive overflow |
| `<lyra-pagination>` | — (extra) | Controlled previous/next and validated page-jump navigation with a localized range summary, loading/empty states, RTL icons, and container-responsive stacking |
| `<lyra-gauge>` | — (extra) | Radial, full-circle ring, or linear meter with a per-instance fill token |
| `<lyra-export-button>` | — (extra) | Injection-safe CSV/JSON downloads plus event-handled custom format descriptors and controlled busy state |
| `<lyra-copy-button>` | — (extra) | Standalone icon-only copy-to-clipboard button for a plain text value, no positioning opinion |
| `<lyra-split>` | — (extra) | Resizable panel layout; one pane can opt into responsive `collapse` (`"start"`/`"end"`) to a fixed-width rail, then a floating overlay card, as the split's container narrows |
| `<lyra-widget>` | — (extra) | Card shell with collapsible header, fullscreen, and customizable chrome |
| `<lyra-word-cloud>` | — (extra) | Zero-dependency SVG word/tag cloud, spiral-placed by weight |
| `<lyra-badge>` + `<lyra-tag>` | `wa-badge` / `wa-tag` | Compact semantic status labels |
| `<lyra-callout>` | `wa-callout` | Dismissible inline status, warning, and error message surface |
| `<lyra-divider>` | `wa-divider` | Horizontal or vertical semantic separator |
| `<lyra-rating>` | `wa-rating` | Keyboard-accessible star rating slider |

**Temporal & graph**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-time-range>` | — (extra) | Two-handle brush/scrubber over a numeric domain |
| `<lyra-playback>` | — (extra) | Play/pause index stepper on a fixed interval |
| `<lyra-heatmap>` | — (extra) | DPR-aware Canvas heatmap with matrix and calendar (`mode="calendar"`) layouts, `fit-to-width` responsive scaling |
| `<lyra-sequence-strip>` | — (extra) | Compact, one-thin-cell-per-item strip visualizing a sequence of categorical states with an optional secondary per-cell marker — pure CSS/flex, no chart.js/SVG/canvas; a glanceable aggregate (`role="img"`) sized/named consistently with the sparkline/heatmap family, not a `role="list"` of separately-operable cells |
| `<lyra-graph>` | — (extra) | Force-directed node-link diagram with pan/zoom/drag, directed/styled relationship links, and rich accessible metadata — needs the optional peer deps `d3-force`, `d3-drag`, `d3-zoom`, `d3-selection` |
| `<lyra-tree>` + `<lyra-tree-node>` | — (extra) | Expand/collapse hierarchy with structured icon/label/description/badge rows, optional richer accessible labels, and APG tree keyboard navigation |

**Flow canvas — workflow & DAG diagramming**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-flow-canvas>` | — (extra) | Pannable/zoomable DAG workflow canvas — positions node cards, draws SVG edges, and runs a shared layered auto-layout for unpositioned nodes; readonly (viewer) by default, opt into editor gestures individually via `nodes-draggable`/`connectable`/`droppable`; a controlled component, never mutates `nodes`/`edges` itself |
| `<lyra-flow-node>` | — (extra) | The default workflow node card — header/body/toolbar chrome, tool-lifecycle `status` tones, and named connection-handle elements edges anchor to; purely presentational, used as `lyra-flow-canvas`'s default card, a slotted override, or standalone |
| `<lyra-flow-minimap>` | — (extra) | Corner overview map of a `lyra-flow-canvas` — scaled node rectangles plus a draggable viewport rectangle; resolves its target canvas via `for` (or the nearest ancestor) and reads geometry only from the canvas's `registerCompanion()` snapshots, never `nodes` directly |
| `<lyra-flow-controls>` | — (extra) | The canvas's zoom-in/zoom-out, fit, and interaction-lock button cluster; drives only view state on a resolved `for` canvas, never touches `nodes`/`edges` |
| `<lyra-node-palette>` | — (extra) | Searchable, categorized node library for workflow editors — drag an item onto a canvas or place it by keyboard, emitting `lyra-palette-place`/`lyra-select`; never creates nodes or touches a canvas's data itself |
| `<lyra-flow-run-overlay>` | — (extra) | Execution-state overlay for a `lyra-flow-canvas` — pushes a `FlowRunDecorations` map into the resolved canvas and renders a compact "{done} of {total} steps complete" run-summary strip; pure pushed state, never executes or polls anything |

**Knowledge graph & RAG exploration**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-graph-legend>` | — (extra) | Node-type legend for a paired `lyra-graph` — one swatch/label/count row per node type, doubling as visibility filters via `lyra-visibility-change`; never reads or writes a graph directly |
| `<lyra-entity-card>` | — (extra) | Knowledge-graph entity dossier card — type badge, description, key/value property rows, degree, community chip, and a built-in "focus in graph" action (`lyra-entity-activate`); never fetches or focuses a graph itself |
| `<lyra-entity-chip>` | — (extra) | Inline `@entity` mention for agent prose — flow content, keyboard-focusable, with a hover/focus preview popover; the knowledge-graph sibling of `lyra-citation-badge`, carrying ids through events only |
| `<lyra-neighbor-list>` | — (extra) | One entity's relationship rows — relation, direction, neighbor — with per-row navigate and expand-in-graph affordances; never computes neighbors itself or mutates a graph |
| `<lyra-path-strip>` | — (extra) | Compact, horizontally scrollable node → relation → node chain rendering "why A connects to B" (GraphRAG local-search reasoning paths); one-dimensional and presentational, no path finding |
| `<lyra-community-card>` | — (extra) | GraphRAG community/cluster summary card — label, LLM summary excerpt, member count, member chips with overflow, and a drill-in action (`lyra-drill`); doesn't own community rendering or membership fetching |
| `<lyra-chunk-inspector>` | — (extra) | Ranked retrieved-chunks list — relevance score bars with tier tones, expandable chunk text, and a `lyra-chunk-open` deep-link event that lands a chunk in `lyra-document-viewer`; never fetches, ranks, or dedupes |
| `<lyra-source-picker>` | — (extra) | Checkbox tree/list scoping which sources ground the next answer — tri-state folders, select-all, type icons, search; deliberately not form-associated, an immediate app-state scoping panel wired through `lyra-sources-change` |
| `<lyra-provenance-panel>` | — (extra) | Sectioned grounding-breakdown disclosure panel for one answer (Entities / Relationships / Communities / Text chunks), composing `lyra-entity-chip`/`lyra-path-strip`/`lyra-community-card`/`lyra-chunk-inspector`; pure projection and event conduit, no fetching |
| `<lyra-mind-map>` | — (extra) | Radial expandable topic tree (NotebookLM-style mind map) — zero-dependency SVG with a closed-form radial layout; hierarchy only, no cross-links, force simulation, communities, or edge labels (that's `lyra-graph`) |

**Overlays**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-popover>` + `<lyra-tooltip>` + `<lyra-dropdown>` | `wa-popover` / `wa-tooltip` / `wa-dropdown` | Floating UI-positioned, RTL-aware overlay primitives with light dismiss and trigger ARIA wiring |

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
| `<lyra-chat-viewport>` | — (extra) | Transcript scroll container: stick-to-bottom while an answer streams, a "jump to latest" pill, and an unread divider; auto-detects slotted `<lyra-chat-message>` children vs. a single nested `<lyra-virtual-list>` (virtual mode) and defers scrolling to it |
| `<lyra-message-actions>` | — (extra) | Per-message action toolbar for `<lyra-chat-message>`'s `actions` slot — opt-in copy/regenerate/edit/feedback built-ins plus a default slot for custom controls (e.g. a slotted `<lyra-branch-picker>`); `role="toolbar"` with APG roving-tabindex across every stop |
| `<lyra-message-feedback>` | — (extra) | Thumbs up/down for one assistant message with an optional inline reason-chips + free-text comment disclosure; emits, never persists — the host reflects a prior rating back via `value` |
| `<lyra-branch-picker>` | — (extra) | The "‹ 2 / 5 ›" navigator across regenerated/edited message variants; pure controlled (`lyra-branch-change`, never mutates its own `index`) — same contract `<lyra-pagination>` establishes for `page`; renders nothing while `count < 2` |
| `<lyra-typing-indicator>` | — (extra) | Purely presentational "assistant is responding" cue; `dots`/`pulse`/`cursor` variants |
| `<lyra-streaming-text>` | — (extra) | Token-coalescing incremental text renderer for streamed output; auto-detects Markdown (or force via `markdown`), optional blinking cursor |
| `<lyra-thinking-panel>` | — (extra) | Collapsible panel for an agent's intermediate reasoning transcript; `live` mode auto-scrolls (stick-to-bottom) while streaming, `post-hoc` doesn't |
| `<lyra-activity-feed>` | — (extra) | Append-only streaming log of granular agent actions ("Searching the web…"), collapsing to a localized "Completed N steps" summary once the run ends; virtualizes past `virtualizeThreshold` entries, shares the `follow`/`lyra-follow-change` stick-to-bottom contract |
| `<lyra-task-list>` | — (extra) | Live, collapsible tracker for an agent's plan — ordered steps with per-step lifecycle status and one level of nested sub-steps; controlled `items`, mirrors `<lyra-stepper>`'s `steps` contract but read-only (several steps can be `running` at once, no selection) |
| `<lyra-generation-status>` | — (extra) | Ticking elapsed-time / token-count / throughput readout for an in-progress response, plus a built-in Stop button |
| `<lyra-stream-status>` | — (extra) | Compact transport-health indicator (`idle`/`connecting`/`streaming`/`stalled`) with heartbeat-aware stall detection via `recordActivity()` |
| `<lyra-checkpoint>` | — (extra) | Inline conversation restore-point marker between messages; its Restore affordance confirms inline, then hands the host a `lyra-restore` event — persists and restores nothing itself |
| `<lyra-handoff-divider>` | — (extra) | Labeled separator marking control transfer between agents in a transcript ("Transferred to Research Agent"), with an optional agent avatar; purely presentational, announced once via an internal `<lyra-live-region>` on connect |
| `<lyra-markdown>` | — (extra) | Sanitized Markdown → HTML (GFM tables, fenced code, links); lazy-loads the optional peers `marked` + `dompurify` |
| `<lyra-code-block>` | — (extra) | Fenced code display with a copy button, optional line numbers, lazy-loaded `shiki` grammars, and built-in GreyCat/GCL highlighting |
| `<lyra-artifact-panel>` | — (extra) | Shell around one agent-generated artifact — title/kind header, preview↔code toggle, version navigation with restore, a streaming indicator, and built-in copy/download actions; renders none of the artifact itself, content is slotted |
| `<lyra-live-region>` | — (extra) | Throttled/coalesced ARIA live-region announcer for streaming UIs, built on the reusable internal `Announcer` engine |
| `<lyra-chat-composer>` | — (extra) | Auto-resizing message `<textarea>` + built-in send/stop button; form-associated, Enter-to-send with Shift+Enter/IME handling |
| `<lyra-suggestion-chips>` | — (extra) | Starter prompts (empty thread) or follow-up suggestions (after a response) as a horizontally scrollable chip row; activation hands the prompt to the host — never composes or sends anything itself |
| `<lyra-emoji-picker>` | — (extra) | Searchable, keyboard-navigable, form-associated emoji picker; ships no emoji data of its own (`groups` is consumer-suppliable) with an optional convenience auto-loader for a default set |
| `<lyra-attachment-chip>` | — (extra) | Pre-send or sent file chip with thumbnail/size/upload-progress/retry; derives metadata from a real `File` or from persisted server metadata |
| `<lyra-attachment-trigger>` | — (extra) | Attach-file affordance for a composer's leading slot; a single icon button, or a `<lyra-menu>` when more than one capability (`files`/`image`/`camera`) is configured |
| `<lyra-mention-popover>` | — (extra) | Caret-anchored `@`-mention/`/`-command autocomplete popover for a host-owned `<textarea>`/`<input>`; never takes DOM focus itself |
| `<lyra-tool-call-chip>` | — (extra) | Compact inline pill for one tool/function call mid-conversation; status-aware glyph/color, optional hover/focus detail tooltip |
| `<lyra-tool-result-view>` + `registerToolRenderer()` | — (extra) | Dispatches a tool call's result to a host-registered renderer (by tool name or shape `matches()`), falling back to `<lyra-json-viewer>` |
| `<lyra-tool-result-dialog>` | — (extra) | Full tool-call detail overlay: status/duration header plus a consumer-assembled `body` slot (typically a `<lyra-tabs>` of Input/Preview/JSON/Raw) |
| `<lyra-tool-approval-dialog>` | — (extra) | Human-in-the-loop approve/deny gate for one proposed tool call, with an optional inline JSON argument editor before approving |
| `<lyra-confirm-bar>` | — (extra) | Inline, non-modal approve/deny block for one proposed action — the in-flow sibling of `<lyra-tool-approval-dialog>` for confirmations that shouldn't hijack focus; same `lyra-approve`/`lyra-deny` event shapes and localization keys as the dialog |
| `<lyra-tool-param-form>` | — (extra) | Renders one form control per property of a flat JSON Schema object, for ad hoc tool invocation or approval-time argument editing |
| `<lyra-tool-select-dialog>` | — (extra) | Category-grouped, filterable, searchable dialog for picking which agent tools are enabled in a conversation |
| `<lyra-command-palette>` | — (extra) | Searchable command menu with groups, keyboard navigation, async-friendly registration, and `mod+k` opening |
| `<lyra-widget-renderer>` | — (extra) | Renders an agent-streamed declarative JSON widget tree through an allowlisted `type -> lyra tag` registry (`registerWidgetType()`); mapped nodes are real elements with props assigned as JS properties (never `innerHTML`), reused by key across a re-resolve |
| `<lyra-json-viewer>` | — (extra) | Collapsible, copyable tree view for an arbitrary JSON value; path-keyed expand state survives a streamed in-place `data` patch |
| `<lyra-citation-badge>` | — (extra) | Inline `[n]` citation marker with a hover/focus preview popover and confidence/verification-status coloring |
| `<lyra-source-list>` + `<lyra-source-card>` | — (extra) | Collapsible "Sources" panel for one chat message, grouping per-source cards with an excerpt + "Show more" full-text toggle |
| `<lyra-conversation-item>` | — (extra) | Selectable chat-history row with inline rename; usable standalone or as `<lyra-virtual-list>`'s `renderItem()` payload |
| `<lyra-virtual-list>` | — (extra) | Generic windowed/virtualized list host — renders only the viewport's rows as real DOM, for a multi-thousand-row history sidebar |
| `<lyra-thread-list>` | — (extra) | Conversation sidebar — grouped, searchable chat-session list with pin/archive/delete/rename affordances; data mode renders `<lyra-conversation-item>` rows through an internal `<lyra-virtual-list>`, slotted mode renders host-supplied items as-is |
| `<lyra-app-rail>` + `<lyra-app-rail-item>` | — (extra) | Responsive navigation rail: `full` ↔ `icon-only` ↔ `mobile` overlay, tracked off live viewport-width breakpoints; the item provides an accessible icon/label link or button |
| `<lyra-responsive-panel>` | — (extra) | The same slotted content docked inline in normal layout flow (desktop) or as a fullscreen/bottom-sheet overlay (mobile) |
| `<lyra-dock-panel>` | — (extra) | Single panel docked to one edge of its container, drag/keyboard-resizable and collapsible — the single-edge counterpart to `<lyra-split>`'s multi-sibling-panel case |
| `<lyra-model-select>` | — (extra) | Provider/model picker: closed dropdown over a fixed `catalog`, or a filterable free-text combobox when there isn't one (or `allow-custom` is set) |
| `<lyra-model-settings-panel>` | — (extra) | Fixed `<lyra-model-select>` + `<lyra-slider>` composition for picking a model and tuning its sampling temperature in one `lyra-change` |
| `<lyra-voice-picker>` | — (extra) | TTS voice selector over a host-supplied `catalog`, mirroring `lyra-model-select`'s closed-dropdown/free-text-combobox dual mode and form-association verbatim, extended with a standalone preview button that plays a `previewUrl` or defers to the host's own TTS |
| `<lyra-audio-visualizer>` | — (extra) | Presentational canvas-drawn voice-activity visualization (bars or waveform), the LiveKit-BarVisualizer counterpart — driven by a `MediaStream`, a numeric `level` (e.g. from `<lyra-push-to-talk>`'s `lyra-level`), or `state` alone for ambient animation |
| `<lyra-push-to-talk>` | — (extra) | Mic capture button owning the full `getUserMedia` + `MediaRecorder` lifecycle (permission, recording, optional chunked streaming, teardown) — native browser APIs only, no SDK; `mode="hold"` (press-and-hold) or `mode="toggle"` |
| `<lyra-transcript-feed>` | — (extra) | Live captions for an in-progress voice session — speaker-grouped entries, interim-vs-final styling with in-place `id`-keyed upgrades, and the same stick-to-bottom `follow`/`lyra-follow-change` contract `lyra-terminal` uses |
| `<lyra-slider>` | — (extra) | Numeric range control (e.g. an LLM "temperature" setting), form-associated, mirrors native `<input type="range">` semantics |
| `<lyra-context-meter>` | — (extra) | Segmented bar/ring occupancy meter for a token budget or context window, split across labeled categories |
| `<lyra-usage-badge>` | — (extra) | Compact, static resource strip for one message or run — tokens in/out, cost, latency, with a hover/focus tooltip breakdown; purely formatting, renders nothing at all when every segment is unset |
| `<lyra-dialog>` + `confirm()` | — (extra) | General-purpose modal/overlay (focus-trapped, Escape/backdrop-dismissible, scroll-locking, dialog stacking); `confirm()` is a promise-based `window.confirm()` replacement built on it |
| `<lyra-drawer>` | — (extra) | Modal panel anchored to the logical start/end edge or top/bottom, sharing dialog focus, dismissal, stacking, and scroll-lock behavior |
| `<lyra-carousel>` | `wa-carousel` | Accessible slotted-slide carousel with keyboard navigation, indicators, looping, and reduced-motion-aware autoplay |
| `<lyra-carousel-item>` | `wa-carousel-item` | Optional semantic slide wrapper for carousel content |
| `<lyra-button-group>` | `wa-button-group` | Responsive semantic grouping for related action controls |
| `<lyra-image-comparer>` | `wa-image-comparer` | Before/after slotted surfaces with a keyboard-accessible range divider |
| `<lyra-zoomable-frame>` | `wa-zoomable-frame` | Bounded zoom and scrollable panning for slotted content or an image source |
| `<lyra-tabs>` | — (extra) | Tab strip over direct light-DOM panels; WAI-ARIA APG automatic-activation keyboard pattern |
| `<lyra-checkbox>` | — (extra) | Boolean form control, `role="checkbox"` with a visual/`indeterminate` mixed state |
| `<lyra-switch>` | — (extra) | Boolean toggle-switch form control, `role="switch"` on/off semantics |
| `<lyra-menu>` + `<lyra-menu-item>` | — (extra) | Anchored dropdown menu around a consumer-supplied trigger; WAI-ARIA "menu button" pattern with real roving focus (not a listbox) |
| `<lyra-dropdown-item>` | `wa-dropdown-item` | Drop-in naming alias for `<lyra-menu-item>`, including checkbox items and roving focus |
| `<lyra-chip>` + `<lyra-chip-group>` | — (extra) | Content-agnostic label pill (tag/filter/scope indicator) and a flex-wrap group with a "+N" overflow indicator |
| `<lyra-kbd>` | — (extra) | Keyboard-shortcut chip; renders platform-appropriate glyphs (⌘ vs. Ctrl) from a single `"mod+k"`-style `keys` string |
| `<lyra-result-card>` + `<lyra-result-field>` | — (extra) | Small bordered card + label/value row shell, for giving custom `lyra-tool-result-view` renderers a consistent look with no bespoke box |
| `<lyra-document-preview>` | — (extra) | Format-dispatching document/attachment viewer (`text/*`/JSON inline, `image/*` inline, else a download fallback) plus a host-driven async-conversion status shell |
| `<lyra-document-viewer>` | — (extra) | Dialog-hosted, format-dispatching full document viewer with a pluggable renderer registry |
| `<lyra-svg-viewer>` | — (extra) | Optional-DOMPurify sanitized inline SVG document viewer |
| `<lyra-image-viewer>` | — (extra) | Full pan/zoom raster-image viewer with labeled region highlights and opt-in region annotation — the landing surface for `region`-anchored citations; distinct from `<lyra-svg-viewer>` (vector documents) and `<lyra-image-comparer>` (before/after) |
| `<lyra-highlight-layer>` | — (extra) | Presentational overlay that paints highlight rectangles (percent-of-box coordinates) over positioned content and owns their activation/flash styling and keyboard access — the shared overlay engine behind `<lyra-svg-viewer>`, `<lyra-image-viewer>`, and `<lyra-pdf-viewer>` |
| `<lyra-html-viewer>` | — (extra) | Optional-DOMPurify sanitized inline HTML document viewer |
| `<lyra-xml-viewer>` | — (extra) | Collapsible, copyable `DOMParser`-based tree view for XML documents, mirroring `<lyra-json-viewer>`'s UX (`collapsed-depth`, `copyable`, path-keyed expand state) for elements, attributes, comments, CDATA, and processing instructions; imperative `search()`/`searchNext()` like the other anchor-target viewers |
| `<lyra-dataset-viewer>` | — (extra) | Optional-PapaParse accessible TSV/PSV/delimited dataset table viewer |
| `<lyra-contact-viewer>` | — (extra) | vCard contact viewer with support for multiple contacts and common fields |
| `<lyra-pdf-viewer>` | — (extra) | Optional-PDF.js renderer with pagination, zoom, selectable text, and virtualized page canvases |
| `<lyra-page-rail>` | — (extra) | Virtualized vertical thumbnail rail for page-addressed documents with per-page highlight heat markers — **wired** mode tracks a live `PageThumbnailSource` (e.g. `lyra-pdf-viewer`) or **mediated** mode binds `page-count`/`page` directly |
| `<lyra-av-player>` | — (extra) | Audio/video player on a native `<audio>`/`<video>` element with a cue transcript synced to `currentTime`, `time-range` anchor/highlight support, an optional dependency-free waveform, and playback-rate control; virtualizes its transcript through `<lyra-virtual-list>` |
| `<lyra-notebook-viewer>` | — (extra) | Read-only Jupyter notebook (nbformat 4.x) renderer composing existing components per cell — Markdown cells through `<lyra-markdown>`, code cells through `<lyra-code-block>`, rich outputs preferring image/HTML/JSON/plain-text in order; optional-DOMPurify sanitizes raw HTML/SVG output |
| `<lyra-spreadsheet-viewer>` | — (extra) | Optional-SheetJS `.xlsx`/`.xls` workbook viewer with sheet tabs and virtualized rows |
| `<lyra-csv-viewer>` | — (extra) | Optional-PapaParse CSV viewer with quoted-field support and virtualized rows |
| `<lyra-geojson-view>` | — (extra) | Document-registry bridge that renders a fetched `.geojson`/`application/geo+json` file through `<lyra-map>`'s `dataLayers` (falls back to `<lyra-json-viewer>` without the optional `maplibre-gl` peer); registered by importing `geojson-view/geojson-view.js` directly — not part of the root barrel |
| `<lyra-docx-viewer>` | — (extra) | Optional-Mammoth DOCX viewer that renders sanitized semantic HTML |
| `<lyra-email-viewer>` | — (extra) | Optional-PostalMime `.eml` viewer with sanitized HTML and plain-text fallback |
| `<lyra-calendar-viewer>` | — (extra) | Optional-ical.js `.ics` viewer for event summaries and times |
| `<lyra-archive-viewer>` | — (extra) | Lists `.zip` entry names and sizes using the optional `jszip` peer; no content preview |
| `<lyra-ebook-viewer>` | — (extra) | Renders `.epub` ebooks with the optional `epubjs` peer |
| `<lyra-pptx-viewer>` | — (extra) | Best-effort client-side `.pptx` viewer with a persistent fidelity notice |
| `<lyra-file-icon>` | — (extra) | Tokenized, localized file-format badge with MIME and filename fallback metadata |
| `<lyra-media-card>` | — (extra) | Lightweight inline preview for one already-sent image/video/file attachment inside a rendered chat message |
| `<lyra-avatar>` | — (extra) | Small, fixed-size identity marker — image, or an initials fallback with `lyra-chip`-style tone recoloring |
| `<lyra-card>` | — (extra) | Generic bordered content container (`header`/`media`/`footer`/`actions` slots) — a direct `<lyra-*>` counterpart to `wa-card` |
| `<lyra-stepper>` | — (extra) | Ordered multi-step wizard navigation — label + index, current/completed/locked/error state, click-to-jump, data-driven and controlled |
| `<lyra-segmented>` | — (extra) | Single-select text/icon button row with the WAI-ARIA APG `radiogroup` contract built in (roving tabindex, automatic activation) |
| `<lyra-swatch-picker>` | — (extra) | Single-select picker over a fixed set of color swatches — `radiogroup` semantics (roving tabindex, automatic activation), themeable selection ring |
| `<lyra-diff-view>` | — (extra) | Real two-string line diff (LCS-aligned), rendered as interleaved unified-diff output |
| `<lyra-commit-card>` | — (extra) | Compact commit summary — subject, author/time, diffstat, per-file changes — that links file rows out to a diff view |
| `<lyra-poll-status>` | — (extra) | "Next scheduled refresh" countdown with a built-in pause control and live-region announcements |
| `<lyra-code-block-core>` | — (extra) | Build-lean `lyra-code-block` variant for a consumer whose `languages` map already covers every language it renders — never references shiki's full ~200-language table |
| `<lyra-code-editor>` | — (extra) | Dependency-free form-associated multiline code editor with line numbers and selection APIs |
| `<lyra-terminal>` | — (extra) | Read-only ANSI console for streamed agent/tool output; not a PTY — no stdin/keystroke handling, no cursor-addressed full-screen apps |
| `<lyra-stack-trace>` | — (extra) | Parses common V8/JS-TS, Firefox/Safari, and Python stack traces into a leading message plus activatable frames, folding `internalPatterns`-matching frames (`node_modules/`, `node:internal`, …) behind a count-labeled toggle; falls back to verbatim text when nothing parses |
| `<lyra-trace-tree>` | — (extra) | Collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith run-tree style) — kind icon, name, status, an inline duration bar on the shared trace time scale, optional tokens/cost columns; consumes the same `LyraSpan[]` as `<lyra-span-waterfall>` |
| `<lyra-span-waterfall>` | — (extra) | Horizontal-timeline projection of the same `LyraSpan[]` `<lyra-trace-tree>` consumes — a time axis, one row per span in start order, status-toned bars (Langfuse timeline / Temporal event-history style) |
| `<lyra-test-results>` | — (extra) | Pass/fail suite summary with per-status counts, status filter toggles, and per-test rows whose failures auto-expand by default and can host rich slotted detail (a diff or code block) alongside the plain failure message |
| `<lyra-env-list>` | — (extra) | Masked key/value list for environment variables and secrets, with per-row reveal and copy; masking is presentational only, not a security boundary |
| `<lyra-file-tree>` | — (extra) | File-explorer preset over `<lyra-tree>` + `<lyra-file-icon>` — path-keyed nodes with git-status/diff-count badges, lazy directory loading, and select/open events |
| `<lyra-browser-frame>` | — (extra) | Presentational "agent computer" viewport — a screenshot/frame stream (or slotted live media), read-only URL display, action-ping overlays, and take-over/stop affordances; no automation transport, take-over is an event |
| `<lyra-compare-panel>` | — (extra) | Side-by-side A/B output comparison with a winner vote (LMSYS-arena / LangSmith-pairwise style) — two slotted panes, a vote bar, synchronized reading |
| `<lyra-rubric-form>` | — (extra) | Configurable annotation rubric (LangSmith annotation-queue style) — score/category/comment keys with a submit-and-next flow; each key routes to an existing sibling control (`<lyra-segmented>`/`<lyra-slider>`, `<lyra-select>`/`<lyra-checkbox-group>`, `<lyra-textarea>`) |
| `<lyra-calendar>` | — (extra) | Responsive month calendar with event markers and agenda mode |
| `<lyra-details>` + `<lyra-accordion>` + `<lyra-accordion-item>` | `wa-details` / `wa-accordion` | Native disclosure and coordinated accordion panels |
| `<lyra-breadcrumb>` + `<lyra-breadcrumb-item>` | `wa-breadcrumb` | Responsive navigation trail |
| `<lyra-format-number>` + `<lyra-format-date>` + `<lyra-format-bytes>` + `<lyra-relative-time>` | `wa-format-*` / `wa-relative-time` | Locale-aware formatting primitives |

### Citation → document recipe

Wiring a `<lyra-citation-badge>` click to open a `<lyra-document-viewer>` at the cited passage, flashed:

```html
<p>…revenue grew 12%<lyra-citation-badge index="1" source-id="doc-1"></lyra-citation-badge>.</p>
<lyra-document-viewer id="dv"></lyra-document-viewer>
```

```js
const SOURCES = {
  'doc-1': {
    name: 'annual_report.pdf', mimeType: 'application/pdf', src: '/files/annual_report.pdf',
    highlight: { id: 'cite-1', tone: 'accent',
      anchor: { kind: 'text-quote', quote: 'revenue grew 12% year over year', prefix: 'Overall ', suffix: ', driven', page: 12 } },
  },
};
document.addEventListener('lyra-citation-activate', (e) => {
  const s = SOURCES[e.detail.sourceId];
  if (!s) return;
  const dv = document.getElementById('dv');
  Object.assign(dv, { name: s.name, mimeType: s.mimeType, src: s.src });
  dv.highlights = [s.highlight];
  dv.anchor = s.highlight.id; // scroll + activate + flash once the pdf loads
  dv.open = true;
});
document.getElementById('dv').addEventListener('lyra-anchor-result', (e) => {
  if (!e.detail.found) console.warn('citation passage not found');
});
```

The reverse direction ("select a passage → cite it") is the same wiring inverted: listen for
`lyra-text-select` on the viewer and hand `detail.anchor` to the host's citation store.

## Known limitations

A non-exhaustive list of gaps a new consumer should know about before adopting:

- `<lyra-map>`'s default `mapStyle` (used only when you don't set one) points at OpenStreetMap's
  shared demo tile server — convenient for local development, but its usage policy forbids
  bulk/production traffic and non-compliant clients are rate-limited or IP-blocked (see
  https://operations.osmfoundation.org/policies/tiles/). Always pass your own `mapStyle` in
  production (a hosted vector/raster style from a tile provider you have a plan with).
- `<lyra-file-input>` has no paste-from-clipboard support and doesn't specially detect a dragged
  folder (surfaces as a phantom zero-byte file rather than a clear rejection).
- The document viewers that fetch a remote resource (`<lyra-archive-viewer>`, `<lyra-calendar-viewer>`,
  `<lyra-contact-viewer>`, `<lyra-csv-viewer>`, `<lyra-dataset-viewer>`, `<lyra-docx-viewer>`,
  `<lyra-document-preview>`, `<lyra-ebook-viewer>`, `<lyra-email-viewer>`, `<lyra-html-viewer>`,
  `<lyra-pdf-viewer>`, `<lyra-pptx-viewer>`, `<lyra-spreadsheet-viewer>`, `<lyra-svg-viewer>`) cap
  what they will read: 25 MB per resource (enforced while streaming, so it holds even when the server
  omits `Content-Length`), and — for `<lyra-csv-viewer>`, `<lyra-dataset-viewer>` and
  `<lyra-spreadsheet-viewer>`, which parse tabular data — 10,000 rows and 1,000 columns. Exceeding a
  cap surfaces the localized `documentPreviewResourceTooLarge` message instead of the document. These
  caps are **not** currently overridable per component. One path is exempt because it never fetches the
  bytes itself: `<lyra-document-preview>` caps only its text/JSON fetch, leaving the `image` path
  (which hands `src` straight to an `<img>`) uncapped.

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
