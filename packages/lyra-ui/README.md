# Lyra UI

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/aceshooting/lyra-ui/branch/main/graph/badge.svg)](https://codecov.io/gh/aceshooting/lyra-ui)
[![CodeQL](https://github.com/aceshooting/lyra-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/aceshooting/lyra-ui/badge)](https://scorecard.dev/viewer/?uri=github.com/aceshooting/lyra-ui)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/13648/badge)](https://www.bestpractices.dev/projects/13648)
[![docs](https://img.shields.io/badge/docs-storybook-ff4785)](https://aceshooting.github.io/lyra-ui/)
[![website](https://img.shields.io/badge/website-lyra--ui.com-6366f1)](https://www.lyra-ui.com/)
[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![npm downloads](https://img.shields.io/npm/dm/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![npm weekly downloads](https://img.shields.io/npm/dw/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![Node.js](https://img.shields.io/node/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![Lit](https://img.shields.io/badge/Lit-3-324FFF?logo=lit)](https://lit.dev/)
[![Web Components](https://img.shields.io/badge/Web%20Components-native-29ABE2)](https://www.webcomponents.org/)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40aceshooting%2Flyra-ui)](https://bundlephobia.com/package/@aceshooting/lyra-ui)
[![types](https://img.shields.io/npm/types/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/npm/l/%40aceshooting%2Flyra-ui)](./LICENSE)

<p align="center">
  <a href="https://www.lyra-ui.com/">
    <img src="https://raw.githubusercontent.com/aceshooting/lyra-ui/main/.github/readme/lyra-mark.svg" width="112" height="112" alt="Lyra UI constellation logo" />
  </a>
</p>

**Lyra UI — the free, independent web-component alternative.** A MIT-licensed [Lit](https://lit.dev)
library for accessible forms, dashboards, charts, data visualization, and Conversation & Agent UI.
It is a practical open-source alternative to [Shoelace](https://shoelace.style/) and
[Web Awesome](https://webawesome.com/), with 249 custom elements, native custom-element APIs,
tree-shakeable imports, its own `--lr-*` design tokens, built-in localization and RTL support,
and no runtime dependency on either project.

> **Independent implementation.** Lyra is not affiliated with, endorsed by, or a fork or rebrand of
> Shoelace or Web Awesome. Selected Web Awesome-compatible components retain documented public names
> under the `lr-` prefix to make migration easier; component notes identify differences. Shoelace
> users get a separate `sl-*` migration map because the APIs are not identical. No competitor runtime,
> theme, token namespace, or source code is required by Lyra.

## Install

```bash
npm install @aceshooting/lyra-ui
# runtime dependencies: Lit and Floating UI are installed transitively with this package
# optional peer: @aceshooting/lyra-flags, only needed for <lr-flag>
# optional peer: libphonenumber-js, only when creating a <lr-phone-input>
#   adapter with loadLibphonenumberAdapter(); it is never imported by lyra-ui
#   and international E.164 input works without it
# optional peer: d3-force, d3-drag, d3-zoom, d3-selection, only needed for <lr-graph>
# optional peer: chart.js, chartjs-plugin-zoom, only needed for the <lr-*-chart>/<lr-histogram> family
# optional peer: @sgratzl/chartjs-chart-boxplot, only needed for <lr-box-plot>
# optional peers: mammoth and dompurify, only needed for <lr-docx-viewer>
#   — Mammoth converts DOCX files to semantic HTML instead of pixel-exact Word page layout.
# optional peer: jszip, only needed for <lr-archive-viewer>
# optional peer: maplibre-gl, only needed for <lr-map> — also import
#   `maplibre-gl/dist/maplibre-gl.css` yourself once, since lr-map only
#   ships its own legend/popup chrome CSS, not maplibre-gl's own stylesheet.
#   <lr-map> falls back to OpenStreetMap's demo tile server when you don't
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
<lr-combobox label="Fruit" with-clear>
  <lr-option value="a">Apple</lr-option>
  <lr-option value="b">Banana</lr-option>
</lr-combobox>
```

…or pull the whole library:

```js
import '@aceshooting/lyra-ui';
```

This registers every component **except** `<lr-chart>` and its typed subclasses,
`<lr-box-plot>`, `<lr-histogram>`, `<lr-map>`, and `<lr-graph>` — each of those
needs an optional peer dependency (see Install above), so they always require their
own explicit subpath import, even when pulling the rest of the library in bulk:

```js
import '@aceshooting/lyra-ui/components/chart/chart.js';
import '@aceshooting/lyra-ui/components/map/map.js';
import '@aceshooting/lyra-ui/components/graph/graph.js';
```

The root import registers `<lr-flag>` without pulling in the optional flag asset graph. If a
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
the same names under the `lr-` prefix. This makes many migrations a predictable import and tag-name
change, while the component notes remain authoritative for intentional differences. For example,
Lyra's combobox uses `with-clear`, while Web Awesome's equivalent uses `clearable`.

```
<wa-combobox value="x" multiple with-clear>  →  <lr-combobox value="x" multiple with-clear>
<wa-date-input value="2026-07-15">           →  <lr-date-input value="2026-07-15">
```

**Automating the rename.** This repo ships a small codemod that performs the mechanical part of
either migration: [`scripts/migrate-wa.mjs`](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/migrate-wa.mjs)
(run from a checkout of this repository — it isn't published as part of the npm package) rewrites
`wa-*`/`sl-*` tag usages and `@shoelace-style/shoelace`/`@awesome.me/webawesome` import specifiers
to their `lr-*`/`@aceshooting/lyra-ui` equivalents across a target directory, file, or glob,
reading the very tables on this page so the rename can't drift out of sync with them:

```bash
node packages/lyra-ui/scripts/migrate-wa.mjs --dry-run path/to/your/src   # preview only
node packages/lyra-ui/scripts/migrate-wa.mjs path/to/your/src             # apply
```

It only rewrites a tag or import that this page documents a `lr-*`/`@aceshooting/lyra-ui`
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
| `<sl-button>` | `<lr-button>` | Check `variant`, `appearance`, and loading behavior. |
| `<sl-input>` / `<sl-textarea>` | `<lr-input>` / `<lr-textarea>` | Preserve the native editing and form contract; review label/error markup. |
| `<sl-select>` / `<sl-option>` | `<lr-select>` / `<lr-option>` | Review option and value events. |
| `<sl-dialog>` / `<sl-drawer>` | `<lr-dialog>` / `<lr-drawer>` | Review close reasons, focus behavior, and slots. |
| `<sl-card>` / `<sl-badge>` / `<sl-callout>` | `<lr-card>` / `<lr-badge>` / `<lr-callout>` | Review appearance tokens and dismiss events. |
| `<sl-spinner>` / `<sl-progress-bar>` | `<lr-spinner>` / `<lr-progress-bar>` | Built-in status copy is localized through Lyra's runtime. |

For either migration, update the package import, replace the custom-element prefix, run the
component's accessibility story, and check its API notes for behavior that cannot be inferred from
the tag name alone. Lyra's own `--lr-theme-*` variables are the only theme inputs it reads. For a
staged Web Awesome migration, map existing values explicitly in application CSS; Lyra does not read
competitor token variables itself.

Everything else in the tables below — marked `— (extra)` — has no Web Awesome equivalent to
migrate *from* in the first place, so there's nothing to rename: install the package and import
what you need (see Usage above). That's most of this library, including every dashboard atom
(stat cards, gauges, empty/skeleton states), the whole chart family, the temporal/graph/tree
components, `<lr-map>`, and the entire **Conversation & Agent UI** family (chat messages,
streaming text, tool-call chips/dialogs, citations, model/settings pickers, and more) — Web
Awesome has no chat/agent UI component family at all.

## Theming, internationalization & RTL

Every component is built on the same three guarantees, verified across the whole library rather
than opt-in per component:

**Theming.** Components read independent `--lr-theme-*` variables and standalone defaults. Lyra
does not depend on another library's theme or token namespace. For a ready-made light/dark base
theme, import `@aceshooting/lyra-ui/theme.css` once and toggle `.lr-light`/`.lr-dark` (or the
matching `data-lr-theme` attribute) on an ancestor:

```css
@import '@aceshooting/lyra-ui/theme.css';
```

```html
<body class="lr-dark">
  <lr-button variant="brand">Save</lr-button>
</body>
```

Applications can override any `--lr-theme-*` input directly:

```css
:root {
  --lr-theme-color-surface-default: #101827;
  --lr-theme-color-text-normal: #f8fafc;
  --lr-theme-color-brand-fill-loud: #60a5fa;
  --lr-theme-font-size-m: 1rem;
  --lr-theme-border-radius-m: 0.5rem;
}
```

See `internal/tokens.styles.ts` for the complete shared token list. Component-specific `--lr-*`
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
<lr-toast .strings=${{ close: 'Fermer' }}></lr-toast>
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
resulting markup paints before any JS runs. A spot check rendering `<lr-button>` through
`@lit-labs/ssr`'s `render()` confirms this in practice — the output is a well-formed DSD template
containing the component's token CSS and internal `<button>` markup, and the constructor's
`ElementInternals`-based `attachInternals()` call (used for native form association) does not throw
under `@lit-labs/ssr-dom-shim`'s server DOM shim.

That said, **lyra-ui has not been systematically tested or tuned for SSR** across its full component catalog:
no CI job renders the library under `@lit-labs/ssr`, no component has been verified to hydrate
correctly on the client afterward, and components that reach for browser-only APIs early
(`ResizeObserver`/`IntersectionObserver`, Floating UI positioning in the popover/tooltip/dropdown
family, `matchMedia` listeners, canvas-based rendering in `<lr-heatmap>`/the chart family) have not
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
  component) that uses any `<lr-*>` tag so Angular stops trying to resolve it as an Angular
  component.
- **Custom events need the framework's DOM event-binding syntax, not its component-event
  shorthand.** A framework's usual event shorthand (Vue's `@event` on a *Vue component*, Angular's
  `(event)` output binding) is wired for that framework's own event system; a plain custom element's
  events are native `CustomEvent`s and need the same binding path used for native DOM events —
  `@lr-change="handler"` in Vue, `(lr-change)="handler()"` in Angular, `on:lr-change` in Svelte,
  or `element.addEventListener('lr-change', handler)` directly when a template binding isn't
  available. Lyra's own event names are consistently kebab-case (`lr-change`, `lr-cell-click`,
  `lr-selection-change`, …) rather than camelCase, specifically to stay friendly to this binding
  path — some other custom-element libraries use camelCase event names, which can silently fail to
  bind in an in-DOM (non-compiled) Vue template because HTML attribute/directive names are
  case-insensitive there; `addEventListener` works regardless of case either way.

## Editor autocomplete (VS Code, JetBrains)

TypeScript consumers already get tag/attribute completion for free from the generated
`HTMLElementTagNameMap`. Plain HTML, and in-DOM Vue or Angular templates, don't go through that type
graph, so this package also ships small editor data files generated from `custom-elements.json`:
`vscode-html-data.json` (tag names, attributes, and slots) and `vscode-css-data.json` (every
`--lr-*` custom property). Point VS Code's
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

The catalog below lists all 249 tags in the current Custom Elements Manifest, grouped by
capability. The manifest and live docs are the authoritative sources for the complete generated
API details.

**Form controls, toasts, sparkline, and flags**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-combobox>` + `<lr-option>` | `wa-combobox` | Filterable single/multi select, form-associated; `xs`–`xl` sizing; async rich rows and retained selection payloads via `source`/`selectedRows`; virtual scrolling with `max-render` |
| `<lr-select>` | `wa-select` | Closed-list single-select, button trigger (not a text input, no filtering); form-associated, shares `<lr-option>` with `lr-combobox` |
| `<lr-date-picker>` | `wa-date-picker` | Inline calendar, single + range |
| `<lr-date-input>` | `wa-date-input` | Date field + calendar popover, form-associated |
| `<lr-phone-input>` | — (extra) | Country-aware telephone field with canonical E.164 form values; numbering metadata is supplied through an optional adapter |
| `<lr-toast>` + `<lr-toast-item>` + `toast()` | `wa-toast` / `wa-toast-item` | Stacking notifications |
| `<lr-sparkline>` | `wa-sparkline` | Zero-dependency inline SVG |
| `<lr-textarea>` | `wa-textarea` | Form-associated multiline field with label/hint/error chrome, auto-resize, native editing passthrough, and caret APIs |
| `<lr-input>` | `wa-input` | Form-associated single-line field (`text`/`password`/`email`/`number`) with label/hint/error chrome and a built-in password-visibility toggle |
| `<lr-number-input>` + `<lr-time-input>` | `wa-number-input` / `wa-time-input` | Native number/time aliases retaining Lyra form and event contracts |
| `<lr-color-picker>` | `wa-color-picker` | Form-associated native color picker with label/hint chrome |
| `<lr-checkbox-group>` | — (extra) | Form-associated group of checkboxes with array values and group validation |
| `<lr-token-input>` | — (extra) | Editable, removable form-associated token list |
| `<lr-icon>` + `<lr-icon-button>` | — (extra) | Dependency-free SVG icons and accessible icon-only actions |
| `<lr-button>` | `wa-button` | Generic action-button primitive (`variant`/`appearance`/`size`/`loading`), owns `type="submit"`/`"reset"` via the closest ancestor `<form>` |
| `<lr-radio>` + `<lr-radio-group>` | `wa-radio` / `wa-radio-group` | Form-associated single-choice controls with roving arrow-key navigation and group validation |
| `<lr-spinner>` | `wa-spinner` | Localized indeterminate busy indicator with reduced-motion support |
| `<lr-progress-bar>` + `<lr-progress-ring>` | `wa-progress-bar` / `wa-progress-ring` | Determinate or indeterminate progress indicators |
| `<lr-flag>` | — (extra) | Country/language flags for i18n pickers — needs the optional peer `@aceshooting/lyra-flags` |

**Additional media and interaction primitives**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-animated-image>` | — (extra) | Animated image playback with a captured still frame and reduced-motion support |
| `<lr-animation>` | — (extra) | Web Animations API wrapper for declarative preset or custom animations |
| `<lr-avatar-group>` | — (extra) | Responsive avatar grouping with a localized overflow indicator |
| `<lr-include>` | — (extra) | Loads sanitized HTML or text content from a URL |
| `<lr-known-date>` | — (extra) | Form-associated date entry control with separate day, month, and year fields |
| `<lr-lightbox>` | — (extra) | Full-screen modal image viewer with navigation and pan/zoom |
| `<lr-qr-code>` | — (extra) | Canvas QR renderer; needs the optional peer `qrcode` |
| `<lr-random-content>` | — (extra) | Random, unique, or sequential slotted-content selection with autoplay |
| `<lr-timeline>` + `<lr-timeline-item>` | — (extra) | Vertical or horizontal chronological event layout |
| `<lr-tour>` | — (extra) | Anchored onboarding tour with spotlight, keyboard navigation, and focus management |

**Dashboard atoms**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-empty>` | — (extra) | Generic empty/no-data state |
| `<lr-skeleton>` | — (extra) | Loading placeholder (pulse/sheen) |
| `<lr-scroller>` | `wa-scroller` | Responsive overflow surface with optional navigation controls |
| `<lr-resize-observer>` | `wa-resize-observer` | Lifecycle-managed ResizeObserver for slotted elements |
| `<lr-intersection-observer>` | `wa-intersection-observer` | Lifecycle-managed IntersectionObserver for slotted elements |
| `<lr-mutation-observer>` | `wa-mutation-observer` | Lifecycle-managed MutationObserver for slotted elements |
| `<lr-stat>` | — (extra) | KPI/stat card with trend pill and an optional breakdown row list; either can carry an `exactValue` shown as a hover/focus tooltip alongside the rounded/formatted display value |
| `<lr-table>` | — (extra) | Sort/select-aware data table with optional controlled filtering, client/server-friendly pagination, loading state, consumer-owned inline editing, expandable rows, sticky columns, and responsive `priority` columns |
| `<lr-data-grid>` | — (extra) | Keyboard-navigable sortable grid with roving cell focus and responsive overflow |
| `<lr-pagination>` | — (extra) | Controlled previous/next and validated page-jump navigation with a localized range summary, loading/empty states, RTL icons, and container-responsive stacking |
| `<lr-gauge>` | — (extra) | Radial, full-circle ring, or linear meter with a per-instance fill token |
| `<lr-export-button>` | — (extra) | Injection-safe CSV/JSON downloads plus event-handled custom format descriptors and controlled busy state |
| `<lr-copy-button>` | — (extra) | Standalone icon-only copy-to-clipboard button for a plain text value, no positioning opinion |
| `<lr-split>` | — (extra) | Resizable panel layout; one pane can opt into responsive `collapse` (`"start"`/`"end"`) to a fixed-width rail, then a floating overlay card, as the split's container narrows |
| `<lr-widget>` | — (extra) | Card shell with collapsible header, fullscreen, and customizable chrome |
| `<lr-word-cloud>` | — (extra) | Zero-dependency SVG word/tag cloud, spiral-placed by weight |
| `<lr-badge>` + `<lr-tag>` | `wa-badge` / `wa-tag` | Compact semantic status labels |
| `<lr-callout>` | `wa-callout` | Dismissible inline status, warning, and error message surface |
| `<lr-divider>` | `wa-divider` | Horizontal or vertical semantic separator |
| `<lr-rating>` | `wa-rating` | Keyboard-accessible star rating slider |

**Temporal & graph**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-time-range>` | — (extra) | Two-handle brush/scrubber over a numeric domain |
| `<lr-playback>` | — (extra) | Play/pause index stepper on a fixed interval |
| `<lr-heatmap>` | — (extra) | DPR-aware Canvas heatmap with matrix and calendar (`mode="calendar"`) layouts, `fit-to-width` responsive scaling |
| `<lr-sequence-strip>` | — (extra) | Compact, one-thin-cell-per-item strip visualizing a sequence of categorical states with an optional secondary per-cell marker — pure CSS/flex, no chart.js/SVG/canvas; a glanceable aggregate (`role="img"`) sized/named consistently with the sparkline/heatmap family, not a `role="list"` of separately-operable cells |
| `<lr-graph>` | — (extra) | Force-directed node-link diagram with pan/zoom/drag, directed/styled relationship links, and rich accessible metadata — needs the optional peer deps `d3-force`, `d3-drag`, `d3-zoom`, `d3-selection` |
| `<lr-tree>` + `<lr-tree-node>` | — (extra) | Expand/collapse hierarchy with structured icon/label/description/badge rows, optional richer accessible labels, and APG tree keyboard navigation |

**Flow canvas — workflow & DAG diagramming**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-flow-canvas>` | — (extra) | Pannable/zoomable DAG workflow canvas — positions node cards, draws SVG edges, and runs a shared layered auto-layout for unpositioned nodes; readonly (viewer) by default, opt into editor gestures individually via `nodes-draggable`/`connectable`/`droppable`; a controlled component, never mutates `nodes`/`edges` itself |
| `<lr-flow-node>` | — (extra) | The default workflow node card — header/body/toolbar chrome, tool-lifecycle `status` tones, and named connection-handle elements edges anchor to; purely presentational, used as `lr-flow-canvas`'s default card, a slotted override, or standalone |
| `<lr-flow-minimap>` | — (extra) | Corner overview map of a `lr-flow-canvas` — scaled node rectangles plus a draggable viewport rectangle; resolves its target canvas via `for` (or the nearest ancestor) and reads geometry only from the canvas's `registerCompanion()` snapshots, never `nodes` directly |
| `<lr-flow-controls>` | — (extra) | The canvas's zoom-in/zoom-out, fit, and interaction-lock button cluster; drives only view state on a resolved `for` canvas, never touches `nodes`/`edges` |
| `<lr-node-palette>` | — (extra) | Searchable, categorized node library for workflow editors — drag an item onto a canvas or place it by keyboard, emitting `lr-palette-place`/`lr-select`; never creates nodes or touches a canvas's data itself |
| `<lr-flow-run-overlay>` | — (extra) | Execution-state overlay for a `lr-flow-canvas` — pushes a `FlowRunDecorations` map into the resolved canvas and renders a compact "{done} of {total} steps complete" run-summary strip; pure pushed state, never executes or polls anything |

**Knowledge graph & RAG exploration**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-graph-legend>` | — (extra) | Node-type legend for a paired `lr-graph` — one swatch/label/count row per node type, doubling as visibility filters via `lr-visibility-change`; never reads or writes a graph directly |
| `<lr-entity-card>` | — (extra) | Knowledge-graph entity dossier card — type badge, description, key/value property rows, degree, community chip, and a built-in "focus in graph" action (`lr-entity-activate`); never fetches or focuses a graph itself |
| `<lr-entity-chip>` | — (extra) | Inline `@entity` mention for agent prose — flow content, keyboard-focusable, with a hover/focus preview popover; the knowledge-graph sibling of `lr-citation-badge`, carrying ids through events only |
| `<lr-neighbor-list>` | — (extra) | One entity's relationship rows — relation, direction, neighbor — with per-row navigate and expand-in-graph affordances; never computes neighbors itself or mutates a graph |
| `<lr-path-strip>` | — (extra) | Compact, horizontally scrollable node → relation → node chain rendering "why A connects to B" (GraphRAG local-search reasoning paths); one-dimensional and presentational, no path finding |
| `<lr-community-card>` | — (extra) | GraphRAG community/cluster summary card — label, LLM summary excerpt, member count, member chips with overflow, and a drill-in action (`lr-drill`); doesn't own community rendering or membership fetching |
| `<lr-chunk-inspector>` | — (extra) | Ranked retrieved-chunks list — relevance score bars with tier tones, expandable chunk text, and a `lr-chunk-open` deep-link event that lands a chunk in `lr-document-viewer`; never fetches, ranks, or dedupes |
| `<lr-source-picker>` | — (extra) | Checkbox tree/list scoping which sources ground the next answer — tri-state folders, select-all, type icons, search; deliberately not form-associated, an immediate app-state scoping panel wired through `lr-sources-change` |
| `<lr-provenance-panel>` | — (extra) | Sectioned grounding-breakdown disclosure panel for one answer (Entities / Relationships / Communities / Text chunks), composing `lr-entity-chip`/`lr-path-strip`/`lr-community-card`/`lr-chunk-inspector`; pure projection and event conduit, no fetching |
| `<lr-mind-map>` | — (extra) | Radial expandable topic tree (NotebookLM-style mind map) — zero-dependency SVG with a closed-form radial layout; hierarchy only, no cross-links, force simulation, communities, or edge labels (that's `lr-graph`) |
| `<lr-knowledge-graph-explorer>` | — (extra) | Orchestration-level surface for exploring a knowledge graph — the `lr-graph` canvas plus entity search, type filters, neighborhood expansion, pinned nodes, path finding between pins, and a details overlay; composes `lr-graph`, `lr-graph-legend`, `lr-entity-card`, `lr-neighbor-list`, `lr-path-strip`, and `lr-popover.showAt()` rather than re-implementing graph rendering itself |
| `<lr-graph-query-builder>` | — (extra) | Editor for a single typed relationship/path filter (`GraphQuery`) over a knowledge graph — start/end entity anchors, relationship-type and node-type pickers with a removable active-filter chip display, a traversal direction, a min/max hop range, validation, and a host-persisted saved-query list; a serializable query model for GraphRAG workflows |
| `<lr-entity-dossier>` | — (extra) | Full entity detail surface — a persistent header (`lr-entity-card` plus a confidence `lr-stat`) above an `lr-tabs` strip for Relationships (`lr-neighbor-list`), Supporting chunks (`lr-chunk-inspector`), and Provenance (`lr-provenance-panel`); pure layout, never fetches or mutates graph/document state |

**Retrieval & grounding**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-retrieval-search>` | — (extra) | Query bar for a retrieval/RAG surface — query text, an active-filter/scope chip row, a vector/keyword/hybrid mode selector, and loading/error/empty status feedback; fully controlled, emits `lr-search` only and never performs retrieval itself |
| `<lr-retrieval-results>` | — (extra) | Orchestration-level ranked-chunk-list surface — deduplication, optional grouping by source, multi-selection, pagination/infinite loading, and a compact/expanded presentation switch; composes an `lr-chunk-inspector` per row and an internal `lr-virtual-list` for large result sets |
| `<lr-retrieval-trace>` | — (extra) | Retrieval pipeline's stage timeline (query rewriting, embedding, retrieval, reranking, filtering) rendered through `lr-span-waterfall`, plus a disclosure list exposing each stage's evidence (chunks via `lr-chunk-inspector`, free-form text, and/or metadata); never fetches or computes retrieval results itself |
| `<lr-grounding-summary>` | — (extra) | Claim-level scorecard for one generated answer — supported/unsupported claim counts, citation coverage, an optional confidence score, warnings, and (when supplied) a list of evidence citations; composes `lr-stat` and `lr-citation-badge`, pure projection and event conduit |
| `<lr-context-inspector>` | — (extra) | Inspection view of the exact context assembled for a model call — per-segment token estimates via `lr-context-meter`, source attribution via `lr-citation-badge`, copy/export affordances, and truncation-boundary/redaction-marker rendering; pure projection, never fetches, estimates, or redacts itself |

**Knowledge base & document management**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-knowledge-base>` | — (extra) | Source list for a retrieval knowledge base — sync status, indexing health, permissions, and per-row create/sync/pause/delete affordances; a controlled data view that never syncs or indexes anything itself, only presents `sources` and emits request-only events |
| `<lr-ingestion-queue>` | — (extra) | Controlled list of documents moving through an ingestion pipeline (upload → text extraction → chunking → embedding → indexing), each row showing its stage, progress, chunk/embedding counts, and a retry or cancel affordance; presentation only, virtualizes at or above `virtualizeThreshold` items |
| `<lr-document-library>` | — (extra) | Searchable, filterable inventory of documents with versions, tags, owners, freshness, and bulk selection; composes `lr-table` for the grid and `lr-input`/`lr-combobox` for search and tag-facet filtering — a controlled data view, no upload/sync/mutation of its own |
| `<lr-document-compare>` | — (extra) | Side-by-side or inline comparison of two document versions, composed from `lr-diff-view` (`view="diff"`, the default) and `lr-document-preview` (`view="side-by-side"`), with proportional scroll sync and matching-highlight activation keeping the two independent preview panes aligned |

**Agent runs & observability**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-agent-run>` | — (extra) | Top-level shell for one `AgentRun` — lifecycle-status badge, elapsed time, current step, model/cost summary, and built-in Cancel/Retry controls in a header, plus `tasks`/`tools`/`reasoning`/`output` composition slots; a shell only, every piece of per-step rendering routes through an existing primitive |
| `<lr-agent-workspace>` | — (extra) | Responsive controlled AI workspace composing the transcript, composer, agent run, tool timeline, retrieval results, grounding summary, and context inspector, with replaceable message/details/composer slots |
| `<lr-agent-trace>` | — (extra) | Provider-neutral agent/LLM trace view — a span-kind filter row, a handoff quick-jump list, and the full trace hierarchy, all rendered through `lr-trace-tree` over one shared `LyraSpan[]` array |
| `<lr-tool-timeline>` | — (extra) | Chronological list of an agent run's tool/function calls, each rendered through `lr-tool-call-chip` (name/status/duration) and `lr-tool-result-view` (args/result), with per-entry retry counts, sensitive-field redaction, and a shared `lr-tool-approval-dialog` for entries gated behind human approval |
| `<lr-memory-panel>` | — (extra) | Agent working-memory surface — short-term context and long-term memories, each item's confidence and optional grounding provenance via `lr-provenance-panel`, with add/remove/forget actions gated behind an `lr-confirm-bar` confirmation step |
| `<lr-policy-summary>` | — (extra) | Read-only list of guardrail, permission, privacy, and tool-policy decisions (`allow`/`deny`/`needs-review`), each with an always-visible, accessible explanation never conveyed by color alone; composes `lr-badge` and `lr-callout`, with `lr-details` for optional richer detail |

**Dashboards & orchestration**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-dashboard-grid>` | — (extra) | Responsive, keyboard-accessible widget grid — positions `layout` entries on a CSS Grid, composing `lr-widget` + `lr-widget-renderer` for each cell's default content, with drag/resize/collision handled as controlled events; readonly (viewer) by default, opt into editor gestures via `cells-draggable`/`cells-resizable` |
| `<lr-filter-bar>` | — (extra) | Row of dashboard filters declared by the host (`filters`) rather than invented by this component — each composes an existing Lyra input (`lr-select`/`lr-combobox`/`lr-date-input`), plus a removable `lr-chip-group` summary and a reset button; controlled, emits a single `lr-input` carrying the full resulting value |
| `<lr-query-builder>` | — (extra) | Composable structured-query builder for tabular/dashboard data — a flat list of field/operator/value condition rows combined with one AND/OR combinator; fully controlled, distinct from `lr-graph-query-builder`'s typed graph/path queries |
| `<lr-drilldown-panel>` | — (extra) | Controlled navigation from a chart/table datum to its related evidence, documents, entities, or agent runs — a breadcrumb trail (`lr-breadcrumb`) over `path` plus, per category the current node has content for, the matching existing primitive (`lr-source-card`, `lr-document-preview`, `lr-entity-card`), wrapped in `lr-tabs` only when more than one category applies |

**Evaluation**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-eval-dataset>` | — (extra) | Dataset management for an evaluation suite — a filterable/taggable list of `EvalExample` rows via `lr-data-grid`, an `lr-chip`/`lr-chip-group` tag-based browse filter, and add/remove/import/export affordances; fully controlled, never mutates `examples` or performs I/O itself |
| `<lr-evaluation-run>` | — (extra) | Evaluation batch's live progress — an overall `lr-progress-bar` counting terminal (done/error/cancelled) examples against the batch total, plus one `lr-details` disclosure per example showing input/output, an optional `lr-grounding-summary`, and an optional `lr-tool-timeline` |
| `<lr-eval-result>` | — (extra) | Rubric scoring, human review, and comparison across a single evaluation example's runs — composes `lr-data-grid` for the runs comparison table, `lr-rubric-form` for the selected run's human-review scoring, and `lr-diff-view` to compare a run's output against a baseline run |

**Overlays**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-popover>` + `<lr-tooltip>` + `<lr-dropdown>` | `wa-popover` / `wa-tooltip` / `wa-dropdown` | Floating UI-positioned, RTL-aware overlay primitives with light dismiss and trigger ARIA wiring |

**Charts**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-chart>` | `wa-chart` | Core Chart.js wrapper (`Series`-based, plus raw `config` passthrough) — needs the optional peer deps `chart.js`, `chartjs-plugin-zoom` |
| `<lr-bar-chart>`, `<lr-line-chart>`, `<lr-pie-chart>`, `<lr-doughnut-chart>`, `<lr-scatter-chart>`, `<lr-bubble-chart>`, `<lr-radar-chart>`, `<lr-polar-area-chart>` | `wa-chart` | Typed `<lr-chart>` subclasses with `type` locked — same optional peer deps as `<lr-chart>` |
| `<lr-box-plot>` | — (extra) | Box-and-whisker chart from precomputed five-number summaries — needs `chart.js`, `chartjs-plugin-zoom`, and `@sgratzl/chartjs-chart-boxplot` |
| `<lr-histogram>` | — (extra) | Bins raw values (`binValues()`) and renders a bar chart — same optional peer deps as `<lr-chart>` |
| `<lr-lite-chart>` | — (extra) | Dependency-free bar/line chart (plain SVG/DOM) — **no optional peer deps**, for projects that forbid a charting dependency outright |

**Map & file-input**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-map>` | — (extra) | maplibre-gl wrapper with declarative legend, choropleth GeoJSON layer, and point markers (via `markers` property), plus a raw `map` escape hatch — needs the optional peer `maplibre-gl` (see Install above). Defaults to OpenStreetMap's demo tiles when `mapStyle` is unset — **production apps must supply their own `mapStyle`** (see Install above / Known limitations) |
| `<lr-file-input>` | — (extra) | Drag-drop + click-to-browse file dropzone, emits raw `File[]` (no CSV/XLSX parsing — that's host-specific) |

**Conversation & Agent UI — chat/agent product building blocks**

Web Awesome has no chat/agent UI component family at all, so every component in this table is
original to lyra-ui (`— (extra)`) — there's nothing to migrate from. See
[`llms-full.txt`](./llms-full.txt) for the full API (properties, events, parts, tokens) behind
each one-liner below.

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lr-chat-message>` | — (extra) | Role-based (`user`/`assistant`/`system`) message bubble shell; avatar/badges header, status-aware footer (built-in retry on `status="failed"`), attachments strip — renders no message content itself, just the chrome around a slotted body |
| `<lr-chat-viewport>` | — (extra) | Transcript scroll container: stick-to-bottom while an answer streams, a "jump to latest" pill, and an unread divider; auto-detects slotted `<lr-chat-message>` children vs. a single nested `<lr-virtual-list>` (virtual mode) and defers scrolling to it |
| `<lr-message-actions>` | — (extra) | Per-message action toolbar for `<lr-chat-message>`'s `actions` slot — opt-in copy/regenerate/edit/feedback built-ins plus a default slot for custom controls (e.g. a slotted `<lr-branch-picker>`); `role="toolbar"` with APG roving-tabindex across every stop |
| `<lr-message-feedback>` | — (extra) | Thumbs up/down for one assistant message with an optional inline reason-chips + free-text comment disclosure; emits, never persists — the host reflects a prior rating back via `value` |
| `<lr-branch-picker>` | — (extra) | The "‹ 2 / 5 ›" navigator across regenerated/edited message variants; pure controlled (`lr-branch-change`, never mutates its own `index`) — same contract `<lr-pagination>` establishes for `page`; renders nothing while `count < 2` |
| `<lr-typing-indicator>` | — (extra) | Purely presentational "assistant is responding" cue; `dots`/`pulse`/`cursor` variants |
| `<lr-streaming-text>` | — (extra) | Token-coalescing incremental text renderer for streamed output; auto-detects Markdown (or force via `markdown`), optional blinking cursor |
| `<lr-thinking-panel>` | — (extra) | Collapsible panel for an agent's intermediate reasoning transcript; `live` mode auto-scrolls (stick-to-bottom) while streaming, `post-hoc` doesn't |
| `<lr-activity-feed>` | — (extra) | Append-only streaming log of granular agent actions ("Searching the web…"), collapsing to a localized "Completed N steps" summary once the run ends; virtualizes past `virtualizeThreshold` entries, shares the `follow`/`lr-follow-change` stick-to-bottom contract |
| `<lr-task-list>` | — (extra) | Live, collapsible tracker for an agent's plan — ordered steps with per-step lifecycle status and one level of nested sub-steps; controlled `items`, mirrors `<lr-stepper>`'s `steps` contract but read-only (several steps can be `running` at once, no selection) |
| `<lr-generation-status>` | — (extra) | Ticking elapsed-time / token-count / throughput readout for an in-progress response, plus a built-in Stop button |
| `<lr-stream-status>` | — (extra) | Compact transport-health indicator (`idle`/`connecting`/`streaming`/`stalled`) with heartbeat-aware stall detection via `recordActivity()` |
| `<lr-checkpoint>` | — (extra) | Inline conversation restore-point marker between messages; its Restore affordance confirms inline, then hands the host a `lr-restore` event — persists and restores nothing itself |
| `<lr-handoff-divider>` | — (extra) | Labeled separator marking control transfer between agents in a transcript ("Transferred to Research Agent"), with an optional agent avatar; purely presentational, announced once via an internal `<lr-live-region>` on connect |
| `<lr-markdown>` | — (extra) | Sanitized Markdown → HTML (GFM tables, fenced code, links); lazy-loads the optional peers `marked` + `dompurify` |
| `<lr-code-block>` | — (extra) | Fenced code display with a copy button, optional line numbers, lazy-loaded `shiki` grammars, and built-in GreyCat/GCL highlighting |
| `<lr-artifact-panel>` | — (extra) | Shell around one agent-generated artifact — title/kind header, preview↔code toggle, version navigation with restore, a streaming indicator, and built-in copy/download actions; renders none of the artifact itself, content is slotted |
| `<lr-live-region>` | — (extra) | Throttled/coalesced ARIA live-region announcer for streaming UIs, built on the reusable internal `Announcer` engine |
| `<lr-chat-composer>` | — (extra) | Auto-resizing message `<textarea>` + built-in send/stop button; form-associated, Enter-to-send with Shift+Enter/IME handling |
| `<lr-suggestion-chips>` | — (extra) | Starter prompts (empty thread) or follow-up suggestions (after a response) as a horizontally scrollable chip row; activation hands the prompt to the host — never composes or sends anything itself |
| `<lr-emoji-picker>` | — (extra) | Searchable, keyboard-navigable, form-associated emoji picker; ships no emoji data of its own (`groups` is consumer-suppliable) with an optional convenience auto-loader for a default set |
| `<lr-attachment-chip>` | — (extra) | Pre-send or sent file chip with thumbnail/size/upload-progress/retry; derives metadata from a real `File` or from persisted server metadata |
| `<lr-attachment-trigger>` | — (extra) | Attach-file affordance for a composer's leading slot; a single icon button, or a `<lr-menu>` when more than one capability (`files`/`image`/`camera`) is configured |
| `<lr-mention-popover>` | — (extra) | Caret-anchored `@`-mention/`/`-command autocomplete popover for a host-owned `<textarea>`/`<input>`; never takes DOM focus itself |
| `<lr-tool-call-chip>` | — (extra) | Compact inline pill for one tool/function call mid-conversation; status-aware glyph/color, optional hover/focus detail tooltip |
| `<lr-tool-result-view>` + `registerToolRenderer()` | — (extra) | Dispatches a tool call's result to a host-registered renderer (by tool name or shape `matches()`), falling back to `<lr-json-viewer>` |
| `<lr-tool-result-dialog>` | — (extra) | Full tool-call detail overlay: status/duration header plus a consumer-assembled `body` slot (typically a `<lr-tabs>` of Input/Preview/JSON/Raw) |
| `<lr-tool-approval-dialog>` | — (extra) | Human-in-the-loop approve/deny gate for one proposed tool call, with an optional inline JSON argument editor before approving |
| `<lr-confirm-bar>` | — (extra) | Inline, non-modal approve/deny block for one proposed action — the in-flow sibling of `<lr-tool-approval-dialog>` for confirmations that shouldn't hijack focus; same `lr-approve`/`lr-deny` event shapes and localization keys as the dialog |
| `<lr-tool-param-form>` | — (extra) | Renders one form control per property of a flat JSON Schema object, for ad hoc tool invocation or approval-time argument editing |
| `<lr-tool-select-dialog>` | — (extra) | Category-grouped, filterable, searchable dialog for picking which agent tools are enabled in a conversation |
| `<lr-command-palette>` | — (extra) | Searchable command menu with groups, keyboard navigation, async-friendly registration, and `mod+k` opening |
| `<lr-widget-renderer>` | — (extra) | Renders an agent-streamed declarative JSON widget tree through an allowlisted `type -> lyra tag` registry (`registerWidgetType()`); mapped nodes are real elements with props assigned as JS properties (never `innerHTML`), reused by key across a re-resolve |
| `<lr-json-viewer>` | — (extra) | Collapsible, copyable tree view for an arbitrary JSON value; path-keyed expand state survives a streamed in-place `data` patch |
| `<lr-citation-badge>` | — (extra) | Inline `[n]` citation marker with a hover/focus preview popover and confidence/verification-status coloring |
| `<lr-source-list>` + `<lr-source-card>` | — (extra) | Collapsible "Sources" panel for one chat message, grouping per-source cards with an excerpt + "Show more" full-text toggle |
| `<lr-conversation-item>` | — (extra) | Selectable chat-history row with inline rename; usable standalone or as `<lr-virtual-list>`'s `renderItem()` payload |
| `<lr-virtual-list>` | — (extra) | Generic windowed/virtualized list host — renders only the viewport's rows as real DOM, for a multi-thousand-row history sidebar |
| `<lr-thread-list>` | — (extra) | Conversation sidebar — grouped, searchable chat-session list with pin/archive/delete/rename affordances; data mode renders `<lr-conversation-item>` rows through an internal `<lr-virtual-list>`, slotted mode renders host-supplied items as-is |
| `<lr-app-rail>` + `<lr-app-rail-item>` | — (extra) | Responsive navigation rail: `full` ↔ `icon-only` ↔ `mobile` overlay, tracked off live viewport-width breakpoints; the item provides an accessible icon/label link or button |
| `<lr-responsive-panel>` | — (extra) | The same slotted content docked inline in normal layout flow (desktop) or as a fullscreen/bottom-sheet overlay (mobile) |
| `<lr-dock-panel>` | — (extra) | Single panel docked to one edge of its container, drag/keyboard-resizable and collapsible — the single-edge counterpart to `<lr-split>`'s multi-sibling-panel case |
| `<lr-model-select>` | — (extra) | Provider/model picker: closed dropdown over a fixed `catalog`, or a filterable free-text combobox when there isn't one (or `allow-custom` is set) |
| `<lr-model-settings-panel>` | — (extra) | Fixed `<lr-model-select>` + `<lr-slider>` composition for picking a model and tuning its sampling temperature in one `lr-change` |
| `<lr-voice-picker>` | — (extra) | TTS voice selector over a host-supplied `catalog`, mirroring `lr-model-select`'s closed-dropdown/free-text-combobox dual mode and form-association verbatim, extended with a standalone preview button that plays a `previewUrl` or defers to the host's own TTS |
| `<lr-audio-visualizer>` | — (extra) | Presentational canvas-drawn voice-activity visualization (bars or waveform), the LiveKit-BarVisualizer counterpart — driven by a `MediaStream`, a numeric `level` (e.g. from `<lr-push-to-talk>`'s `lr-level`), or `state` alone for ambient animation |
| `<lr-push-to-talk>` | — (extra) | Mic capture button owning the full `getUserMedia` + `MediaRecorder` lifecycle (permission, recording, optional chunked streaming, teardown) — native browser APIs only, no SDK; `mode="hold"` (press-and-hold) or `mode="toggle"` |
| `<lr-transcript-feed>` | — (extra) | Live captions for an in-progress voice session — speaker-grouped entries, interim-vs-final styling with in-place `id`-keyed upgrades, and the same stick-to-bottom `follow`/`lr-follow-change` contract `lr-terminal` uses |
| `<lr-slider>` | — (extra) | Numeric range control (e.g. an LLM "temperature" setting), form-associated, mirrors native `<input type="range">` semantics |
| `<lr-context-meter>` | — (extra) | Segmented bar/ring occupancy meter for a token budget or context window, split across labeled categories |
| `<lr-usage-badge>` | — (extra) | Compact, static resource strip for one message or run — tokens in/out, cost, latency, with a hover/focus tooltip breakdown; purely formatting, renders nothing at all when every segment is unset |
| `<lr-dialog>` + `confirm()` | — (extra) | General-purpose modal/overlay (focus-trapped, Escape/backdrop-dismissible, scroll-locking, dialog stacking); `confirm()` is a promise-based `window.confirm()` replacement built on it |
| `<lr-drawer>` | — (extra) | Modal panel anchored to the logical start/end edge or top/bottom, sharing dialog focus, dismissal, stacking, and scroll-lock behavior |
| `<lr-carousel>` | `wa-carousel` | Accessible slotted-slide carousel with keyboard navigation, indicators, looping, and reduced-motion-aware autoplay |
| `<lr-carousel-item>` | `wa-carousel-item` | Optional semantic slide wrapper for carousel content |
| `<lr-button-group>` | `wa-button-group` | Responsive semantic grouping for related action controls |
| `<lr-control-group>` | — (extra) | Responsive layout wrapper for a row of mixed form controls and action buttons, centered rather than stretched (unlike `<lr-button-group>`) |
| `<lr-image-comparer>` | `wa-image-comparer` | Before/after slotted surfaces with a keyboard-accessible range divider |
| `<lr-zoomable-frame>` | `wa-zoomable-frame` | Bounded zoom and scrollable panning for slotted content or an image source |
| `<lr-tabs>` | — (extra) | Tab strip over direct light-DOM panels; WAI-ARIA APG automatic-activation keyboard pattern |
| `<lr-checkbox>` | — (extra) | Boolean form control, `role="checkbox"` with a visual/`indeterminate` mixed state |
| `<lr-switch>` | — (extra) | Boolean toggle-switch form control, `role="switch"` on/off semantics |
| `<lr-menu>` + `<lr-menu-item>` | — (extra) | Anchored dropdown menu around a consumer-supplied trigger; WAI-ARIA "menu button" pattern with real roving focus (not a listbox) |
| `<lr-dropdown-item>` | `wa-dropdown-item` | Drop-in naming alias for `<lr-menu-item>`, including checkbox items and roving focus |
| `<lr-chip>` + `<lr-chip-group>` | — (extra) | Content-agnostic label pill (tag/filter/scope indicator) and a flex-wrap group with a "+N" overflow indicator |
| `<lr-kbd>` | — (extra) | Keyboard-shortcut chip; renders platform-appropriate glyphs (⌘ vs. Ctrl) from a single `"mod+k"`-style `keys` string |
| `<lr-result-card>` + `<lr-result-field>` | — (extra) | Small bordered card + label/value row shell, for giving custom `lr-tool-result-view` renderers a consistent look with no bespoke box |
| `<lr-document-preview>` | — (extra) | Format-dispatching document/attachment viewer (`text/*`/JSON inline, `image/*` inline, else a download fallback) plus a host-driven async-conversion status shell |
| `<lr-document-viewer>` | — (extra) | Dialog-hosted, format-dispatching full document viewer with a pluggable renderer registry |
| `<lr-svg-viewer>` | — (extra) | Optional-DOMPurify sanitized inline SVG document viewer |
| `<lr-image-viewer>` | — (extra) | Full pan/zoom raster-image viewer with labeled region highlights and opt-in region annotation — the landing surface for `region`-anchored citations; distinct from `<lr-svg-viewer>` (vector documents) and `<lr-image-comparer>` (before/after) |
| `<lr-highlight-layer>` | — (extra) | Presentational overlay that paints highlight rectangles (percent-of-box coordinates) over positioned content and owns their activation/flash styling and keyboard access — the shared overlay engine behind `<lr-svg-viewer>`, `<lr-image-viewer>`, and `<lr-pdf-viewer>` |
| `<lr-html-viewer>` | — (extra) | Optional-DOMPurify sanitized inline HTML document viewer |
| `<lr-xml-viewer>` | — (extra) | Collapsible, copyable `DOMParser`-based tree view for XML documents, mirroring `<lr-json-viewer>`'s UX (`collapsed-depth`, `copyable`, path-keyed expand state) for elements, attributes, comments, CDATA, and processing instructions; imperative `search()`/`searchNext()` like the other anchor-target viewers |
| `<lr-dataset-viewer>` | — (extra) | Optional-PapaParse accessible TSV/PSV/delimited dataset table viewer |
| `<lr-contact-viewer>` | — (extra) | vCard contact viewer with support for multiple contacts and common fields |
| `<lr-pdf-viewer>` | — (extra) | Optional-PDF.js renderer with pagination, zoom, selectable text, and virtualized page canvases |
| `<lr-page-rail>` | — (extra) | Virtualized vertical thumbnail rail for page-addressed documents with per-page highlight heat markers — **wired** mode tracks a live `PageThumbnailSource` (e.g. `lr-pdf-viewer`) or **mediated** mode binds `page-count`/`page` directly |
| `<lr-av-player>` | — (extra) | Audio/video player on a native `<audio>`/`<video>` element with a cue transcript synced to `currentTime`, `time-range` anchor/highlight support, an optional dependency-free waveform, and playback-rate control; virtualizes its transcript through `<lr-virtual-list>` |
| `<lr-notebook-viewer>` | — (extra) | Read-only Jupyter notebook (nbformat 4.x) renderer composing existing components per cell — Markdown cells through `<lr-markdown>`, code cells through `<lr-code-block>`, rich outputs preferring image/HTML/JSON/plain-text in order; optional-DOMPurify sanitizes raw HTML/SVG output |
| `<lr-spreadsheet-viewer>` | — (extra) | Optional-SheetJS `.xlsx`/`.xls` workbook viewer with sheet tabs and virtualized rows |
| `<lr-csv-viewer>` | — (extra) | Optional-PapaParse CSV viewer with quoted-field support and virtualized rows |
| `<lr-geojson-view>` | — (extra) | Document-registry bridge that renders a fetched `.geojson`/`application/geo+json` file through `<lr-map>`'s `dataLayers` (falls back to `<lr-json-viewer>` without the optional `maplibre-gl` peer); registered by importing `geojson-view/geojson-view.js` directly — not part of the root barrel |
| `<lr-docx-viewer>` | — (extra) | Optional-Mammoth DOCX viewer that renders sanitized semantic HTML |
| `<lr-email-viewer>` | — (extra) | Optional-PostalMime `.eml` viewer with sanitized HTML and plain-text fallback |
| `<lr-calendar-viewer>` | — (extra) | Optional-ical.js `.ics` viewer for event summaries and times |
| `<lr-archive-viewer>` | — (extra) | Lists `.zip` entry names and sizes using the optional `jszip` peer; no content preview |
| `<lr-ebook-viewer>` | — (extra) | Renders `.epub` ebooks with the optional `epubjs` peer |
| `<lr-pptx-viewer>` | — (extra) | Best-effort client-side `.pptx` viewer with a persistent fidelity notice |
| `<lr-file-icon>` | — (extra) | Tokenized, localized file-format badge with MIME and filename fallback metadata |
| `<lr-media-card>` | — (extra) | Lightweight inline preview for one already-sent image/video/file attachment inside a rendered chat message |
| `<lr-avatar>` | — (extra) | Small, fixed-size identity marker — image, or an initials fallback with `lr-chip`-style tone recoloring |
| `<lr-card>` | — (extra) | Generic bordered content container (`header`/`media`/`footer`/`actions` slots) — a direct `<lr-*>` counterpart to `wa-card` |
| `<lr-stepper>` | — (extra) | Ordered multi-step wizard navigation — label + index, current/completed/locked/error state, click-to-jump, data-driven and controlled |
| `<lr-segmented>` | — (extra) | Single-select text/icon button row with the WAI-ARIA APG `radiogroup` contract built in (roving tabindex, automatic activation) |
| `<lr-swatch-picker>` | — (extra) | Single-select picker over a fixed set of color swatches — `radiogroup` semantics (roving tabindex, automatic activation), themeable selection ring |
| `<lr-diff-view>` | — (extra) | Real two-string line diff (LCS-aligned), rendered as interleaved unified-diff output |
| `<lr-commit-card>` | — (extra) | Compact commit summary — subject, author/time, diffstat, per-file changes — that links file rows out to a diff view |
| `<lr-poll-status>` | — (extra) | "Next scheduled refresh" countdown with a built-in pause control and live-region announcements |
| `<lr-code-block-core>` | — (extra) | Build-lean `lr-code-block` variant for a consumer whose `languages` map already covers every language it renders — never references shiki's full ~200-language table |
| `<lr-code-editor>` | — (extra) | Dependency-free form-associated multiline code editor with line numbers and selection APIs |
| `<lr-terminal>` | — (extra) | Read-only ANSI console for streamed agent/tool output; not a PTY — no stdin/keystroke handling, no cursor-addressed full-screen apps |
| `<lr-stack-trace>` | — (extra) | Parses common V8/JS-TS, Firefox/Safari, and Python stack traces into a leading message plus activatable frames, folding `internalPatterns`-matching frames (`node_modules/`, `node:internal`, …) behind a count-labeled toggle; falls back to verbatim text when nothing parses |
| `<lr-trace-tree>` | — (extra) | Collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith run-tree style) — kind icon, name, status, an inline duration bar on the shared trace time scale, optional tokens/cost columns; consumes the same `LyraSpan[]` as `<lr-span-waterfall>` |
| `<lr-span-waterfall>` | — (extra) | Horizontal-timeline projection of the same `LyraSpan[]` `<lr-trace-tree>` consumes — a time axis, one row per span in start order, status-toned bars (Langfuse timeline / Temporal event-history style) |
| `<lr-test-results>` | — (extra) | Pass/fail suite summary with per-status counts, status filter toggles, and per-test rows whose failures auto-expand by default and can host rich slotted detail (a diff or code block) alongside the plain failure message |
| `<lr-env-list>` | — (extra) | Masked key/value list for environment variables and secrets, with per-row reveal and copy; masking is presentational only, not a security boundary |
| `<lr-file-tree>` | — (extra) | File-explorer preset over `<lr-tree>` + `<lr-file-icon>` — path-keyed nodes with git-status/diff-count badges, lazy directory loading, and select/open events |
| `<lr-browser-frame>` | — (extra) | Presentational "agent computer" viewport — a screenshot/frame stream (or slotted live media), read-only URL display, action-ping overlays, and take-over/stop affordances; no automation transport, take-over is an event |
| `<lr-compare-panel>` | — (extra) | Side-by-side A/B output comparison with a winner vote (LMSYS-arena / LangSmith-pairwise style) — two slotted panes, a vote bar, synchronized reading |
| `<lr-rubric-form>` | — (extra) | Configurable annotation rubric (LangSmith annotation-queue style) — score/category/comment keys with a submit-and-next flow; each key routes to an existing sibling control (`<lr-segmented>`/`<lr-slider>`, `<lr-select>`/`<lr-checkbox-group>`, `<lr-textarea>`) |
| `<lr-calendar>` | — (extra) | Responsive month calendar with event markers and agenda mode |
| `<lr-details>` + `<lr-accordion>` + `<lr-accordion-item>` | `wa-details` / `wa-accordion` | Native disclosure and coordinated accordion panels |
| `<lr-breadcrumb>` + `<lr-breadcrumb-item>` | `wa-breadcrumb` | Responsive navigation trail |
| `<lr-format-number>` + `<lr-format-date>` + `<lr-format-bytes>` + `<lr-relative-time>` | `wa-format-*` / `wa-relative-time` | Locale-aware formatting primitives |
| `<lr-markdown-core>` | — (extra) | Build-lean `lr-markdown` variant for a consumer whose `languages` map already covers every language it renders — never references shiki's full ~200-language table |

### Citation → document recipe

Wiring a `<lr-citation-badge>` click to open a `<lr-document-viewer>` at the cited passage, flashed:

```html
<p>…revenue grew 12%<lr-citation-badge index="1" source-id="doc-1"></lr-citation-badge>.</p>
<lr-document-viewer id="dv"></lr-document-viewer>
```

```js
const SOURCES = {
  'doc-1': {
    name: 'annual_report.pdf', mimeType: 'application/pdf', src: '/files/annual_report.pdf',
    highlight: { id: 'cite-1', tone: 'accent',
      anchor: { kind: 'text-quote', quote: 'revenue grew 12% year over year', prefix: 'Overall ', suffix: ', driven', page: 12 } },
  },
};
document.addEventListener('lr-citation-activate', (e) => {
  const s = SOURCES[e.detail.sourceId];
  if (!s) return;
  const dv = document.getElementById('dv');
  Object.assign(dv, { name: s.name, mimeType: s.mimeType, src: s.src });
  dv.highlights = [s.highlight];
  dv.anchor = s.highlight.id; // scroll + activate + flash once the pdf loads
  dv.open = true;
});
document.getElementById('dv').addEventListener('lr-anchor-result', (e) => {
  if (!e.detail.found) console.warn('citation passage not found');
});
```

The reverse direction ("select a passage → cite it") is the same wiring inverted: listen for
`lr-text-select` on the viewer and hand `detail.anchor` to the host's citation store.

## Known limitations

A non-exhaustive list of gaps a new consumer should know about before adopting:

- `<lr-map>`'s default `mapStyle` (used only when you don't set one) points at OpenStreetMap's
  shared demo tile server — convenient for local development, but its usage policy forbids
  bulk/production traffic and non-compliant clients are rate-limited or IP-blocked (see
  https://operations.osmfoundation.org/policies/tiles/). Always pass your own `mapStyle` in
  production (a hosted vector/raster style from a tile provider you have a plan with).
- `<lr-file-input>` has no paste-from-clipboard support and doesn't specially detect a dragged
  folder (surfaces as a phantom zero-byte file rather than a clear rejection).
- The document viewers that fetch a remote resource (`<lr-archive-viewer>`, `<lr-calendar-viewer>`,
  `<lr-contact-viewer>`, `<lr-csv-viewer>`, `<lr-dataset-viewer>`, `<lr-docx-viewer>`,
  `<lr-document-preview>`, `<lr-ebook-viewer>`, `<lr-email-viewer>`, `<lr-html-viewer>`,
  `<lr-pdf-viewer>`, `<lr-pptx-viewer>`, `<lr-spreadsheet-viewer>`, `<lr-svg-viewer>`) cap
  what they will read: 25 MB per resource (enforced while streaming, so it holds even when the server
  omits `Content-Length`), and — for `<lr-csv-viewer>`, `<lr-dataset-viewer>` and
  `<lr-spreadsheet-viewer>`, which parse tabular data — 10,000 rows and 1,000 columns. Exceeding a
  cap surfaces the localized `documentPreviewResourceTooLarge` message instead of the document. These
  caps are **not** currently overridable per component. One path is exempt because it never fetches the
  bytes itself: `<lr-document-preview>` caps only its text/JSON fetch, leaving the `image` path
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
