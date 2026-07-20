# Lyra UI (monorepo)

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
[![avg per component](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.avgComponentGzipKb&label=avg%20per%20component&suffix=%20KB%20gzip&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json)
[![total gzip](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.barrelGzipKb&label=total%20gzip&suffix=%20KB&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json)
[![types](https://img.shields.io/npm/types/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/npm/l/%40aceshooting%2Flyra-ui)](./LICENSE)

<p align="center">
  <a href="https://www.lyra-ui.com/">
    <img src=".github/readme/lyra-mark.svg" width="112" height="112" alt="Lyra UI constellation logo" />
  </a>
</p>

A pnpm workspace hosting `lyra-ui` and its optional companion packages.

**[Browse the live docs site →](https://aceshooting.github.io/lyra-ui/)** — every component with
a live example, source code, and API reference.

<p align="center">
  <a href="https://aceshooting.github.io/lyra-ui/"><img src=".github/readme/preview-chat.png" width="32%" alt="Lyra UI Conversation & Agent UI example: a chat message thread" /></a>
  <a href="https://aceshooting.github.io/lyra-ui/"><img src=".github/readme/preview-table.png" width="32%" alt="Lyra UI sortable table example" /></a>
  <a href="https://aceshooting.github.io/lyra-ui/"><img src=".github/readme/preview-chart.png" width="32%" alt="Lyra UI line chart example" /></a>
</p>
<p align="center"><sub>A few of 249 custom elements — <a href="https://aceshooting.github.io/lyra-ui/">browse them all live →</a></sub></p>

## Table of Contents

- [Quick Start](#quick-start)
- [Principles & Guidelines](#principles--guidelines)
- [Components](#components)
- [Theming, internationalization & RTL](#theming-internationalization--rtl)
- [Framework integration](#framework-integration-react-vue-angular-svelte)
- [SSR & Declarative Shadow DOM](#ssr--declarative-shadow-dom)
- [Browser & Node support](#browser--node-support)
- [Built with](#built-with)
- [Documentation](#documentation)
- [Claude Code plugin](#claude-code-plugin)
- [Status](#status)
- [License](#license)

**Lyra UI is a free, independent alternative to Shoelace and Web Awesome.** It is a MIT-licensed,
framework-agnostic Lit web-component library for production interfaces: accessible form controls,
navigation, overlays, dashboards, data visualization, file workflows, and a complete conversation
and agent UI toolkit for chat products. It runs on native custom elements, has no runtime dependency
on Shoelace or Web Awesome, and ships with its own design tokens, localization runtime, RTL support,
reduced-motion behavior, and form-associated controls.

Lyra also makes migration practical. Selected components expose a documented Web Awesome-compatible
surface under the `lr-` prefix, so many `wa-*` integrations can move through a mechanical tag-name
and import change, with intentional differences documented per component. Shoelace users get a
clear `sl-*` → `lr-*` component map and migration notes; Lyra is an independent implementation,
not a fork, rebrand, official product, or affiliated project. No Web Awesome Pro source code was
available to or used by the maintainers.

The result is one open library for everyday UI, dashboards and charts, and AI chat/agent interfaces —
with the broad component coverage of a general-purpose design system and original building blocks
for data-heavy and streaming applications.

| Package | Description | Version | Size |
|---|---|---|---|
| [`packages/lyra-ui`](./packages/lyra-ui) | Free, independent Lit web components — an alternative to Shoelace and Web Awesome. | [![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui) | [![avg per component](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.avgComponentGzipKb&label=avg%20per%20component&suffix=%20KB%20gzip&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json) [![total gzip](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.barrelGzipKb&label=total%20gzip&suffix=%20KB&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json) |
| [`packages/lyra-flags`](./packages/lyra-flags) | Optional waving flag SVGs for `<lr-flag>`, kept out of `lyra-ui`'s install by default. | [![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-flags)](https://www.npmjs.com/package/@aceshooting/lyra-flags) | *n/a — SVG assets, not a JS bundle* |

See each package's own README for full install/usage details.

## Quick Start

```bash
npm install @aceshooting/lyra-ui
```

```js
import '@aceshooting/lyra-ui/components/forms/combobox/combobox.js';
import '@aceshooting/lyra-ui/components/forms/combobox/option.js';
```

```html
<lr-combobox label="Fruit" with-clear>
  <lr-option value="a">Apple</lr-option>
  <lr-option value="b">Banana</lr-option>
</lr-combobox>
```

Per-component optional peers and the tree-shakeable import patterns:
[`packages/lyra-ui/README.md#install`](./packages/lyra-ui/README.md#install).

🔗 **[Open in StackBlitz](https://stackblitz.com/github/aceshooting/lyra-ui)** — try it in-browser, no local install.

For local development of this monorepo:

```bash
pnpm install
pnpm build        # builds every package
pnpm test         # tests every package
pnpm lint         # typechecks every package
pnpm docs         # Storybook docs site demoing every component
```

Contributors and AI coding agents working on this repo: see [AGENTS.md](./AGENTS.md).

## Principles & Guidelines

| Principle | Description |
|---|---|
| 🆓 Free & Open Source | MIT-licensed and free — nothing hidden inside |
| 🪶 Lightweight & Tree-Shakeable | Import only what you use — no dead weight |
| ⚡ Performance-First | Native custom elements, no virtual DOM, minimal deps |
| 🤖 AI & Agentic-AI Ready | Machine-readable docs and manifests AI agents use correctly |
| 🧩 Consistent Architecture | One shared base — learn one component, know them all |
| 🎨 Design Tokens Only | Every value is a `--lr-*` token — restyle from one place |
| 🌍 i18n & RTL by Default | Every string translatable, every layout mirrors RTL |
| ♿ Accessibility First | Correct ARIA in shadow DOM, automated a11y checks |
| 📐 Responsive by Allocation | Adapts to its container, not just the viewport |
| 🎬 Motion-Aware | Themeable timing, honors `prefers-reduced-motion` |
| 🔗 Synchronized Public API | Docs, tests, and manifest always match the code |
| 🔒 Responsible Disclosure | Private reporting, 90-day coordinated disclosure |

## Components

249 custom elements across eleven component families. Every tag has a live, interactive example on the
[docs site](https://aceshooting.github.io/lyra-ui/); for the full per-tag reference (Web Awesome
mirror, props, events, slots, parts) see
[`packages/lyra-ui/README.md#components`](./packages/lyra-ui/README.md#components).

The family name is also the import path — `@aceshooting/lyra-ui/components/<family>/<name>`.

| Family | Highlights |
|---|---|
| `forms` | button, input, textarea, select, combobox, date picker, calendar, phone/token/file input, color and swatch pickers, emoji picker, code editor, checkbox/radio/switch/slider, time range, rubric form |
| `layout` | tabs, menu, command palette, breadcrumb, details, card, widget, split, stepper, carousel, scroller, app rail, dock panel, dashboard grid, drilldown panel, filter bar, segmented, virtual list, responsive panel |
| `overlays` | dialog, drawer, overlay, toast, callout, badge, chip, kbd, rating, progress, spinner, skeleton, empty |
| `data` | table, data grid, tree, timeline, calendar, gauge, heatmap, sparkline, word cloud, stat, pagination, query builder, flow canvas and nodes, sequence strip, file tree, env list, context meter |
| `charts` | Chart.js-backed `lr-chart` (optional peer) |
| `conversation` | chat message, composer and viewport, streaming text, markdown, code block, model select, thinking panel, branch picker, checkpoint, message actions and feedback, push-to-talk, audio visualizer, thread list |
| `agent-tools` | agent run and trace, tool call chip, tool approval dialog, task list, terminal, span waterfall, stack trace, test results, activity feed, context inspector, artifact panel, commit card, eval dataset/run/result, policy summary |
| `retrieval` | retrieval search and results, grounding summary, citation badge, chunk inspector, knowledge base, ingestion queue, knowledge-graph explorer, graph, mind map, entity card/chip/dossier, provenance panel, memory panel, neighbor list, path strip |
| `viewers` | document, PDF, DOCX, PPTX, spreadsheet, CSV, notebook, ebook, email, calendar, contact, archive, XML, SVG, HTML and GeoJSON viewers, document compare and preview, dataset viewer, highlight layer, page rail |
| `media` | image viewer and comparer, lightbox, zoomable frame, AV player, playback, animated image, avatar and avatar group, file icon, file input, attachment chip, map, QR code, flag |
| `utility` | icon, format, copy and export buttons, diff view, JSON viewer, divider, live region, mention popover, tour, poll status, known date, resize/intersection/mutation observers |

## Theming, internationalization & RTL

Every one of the 249 tags is built on the same three guarantees — not opt-in per component:

- **Theming** through `--lr-*` design tokens — retheme by overriding a custom property,
  no per-component theming API to learn.
- **Internationalization** via a small runtime (`registerLyraLocale`/`setLyraLocale`, or a
  per-instance `.strings` override) — every built-in string (labels, announcements, aria-labels)
  is translatable without a rebuild or a per-locale bundle.
- **RTL** with zero per-component opt-in — set `dir="rtl"` (or an RTL `lang`) anywhere up the tree
  and every component mirrors its layout and keyboard navigation to match.

See [`packages/lyra-ui/README.md#theming-internationalization--rtl`](./packages/lyra-ui/README.md#theming-internationalization--rtl)
for the full usage details.

## Framework integration (React, Vue, Angular, Svelte)

Lyra ships plain custom elements — no framework-specific wrapper package needed.

```jsx
// React 19+
import '@aceshooting/lyra-ui/components/forms/combobox/combobox.js';

<lr-combobox label="Fruit" with-clear>
  <lr-option value="a">Apple</lr-option>
</lr-combobox>
```

```vue
<!-- Vue -->
<lr-combobox label="Fruit" @lr-change="onChange" />
```

```html
<!-- Angular — module/component needs schemas: [CUSTOM_ELEMENTS_SCHEMA] -->
<lr-combobox label="Fruit" (lr-change)="onChange($event)"></lr-combobox>
```

```svelte
<!-- Svelte -->
<lr-combobox label="Fruit" on:lr-change={onChange} />
```

Property-vs-attribute binding, Angular's `CUSTOM_ELEMENTS_SCHEMA`, and event-name casing notes:
[`packages/lyra-ui/README.md#framework-integration-vue-angular-svelte`](./packages/lyra-ui/README.md#framework-integration-vue-angular-svelte).

## SSR & Declarative Shadow DOM

Lyra components are standard Lit 3 custom elements: they render through `@lit-labs/ssr` into
Declarative Shadow DOM in principle, and a spot check of `<lr-button>` confirms basic
server-rendering works — but the library has not been systematically tested or tuned for SSR at
scale. See
[`packages/lyra-ui/README.md#ssr--declarative-shadow-dom`](./packages/lyra-ui/README.md#ssr--declarative-shadow-dom)
for details.

## Browser & Node support

- **Node** ≥ 20 to build/test this repo (`engines.node`); the published packages have no Node
  runtime dependency — they run in the browser.
- **Browsers** — any evergreen browser with Custom Elements v1 + Shadow DOM support (Chrome, Edge,
  Firefox, Safari). CI runs the full test suite against Chromium plus a separate platform-contract
  suite against Firefox and WebKit, on Node 20 and 22.
- Not tested against Internet Explorer or other browsers without native custom-element support.

## Built with

- [Lit 3](https://lit.dev) — the web-component base every Lyra element extends
- [Floating UI](https://floating-ui.com) — positioning engine for popovers, tooltips, dropdowns, and the combobox menu
- [Chart.js](https://www.chartjs.org) & [D3](https://d3js.org) — optional peers powering the Chart.js chart family and `<lr-graph>`
- [Storybook](https://storybook.js.org) — the live docs site and component workshop
- [Noto Emoji](https://github.com/googlefonts/noto-emoji) flag artwork — vendored into `@aceshooting/lyra-flags` (Public Domain)

## Documentation

- **Humans:** the [live docs site](https://aceshooting.github.io/lyra-ui/) (Storybook — every
  component's canvas, source, and props/events/slots reference).
- **AI agents integrating this library:** [`packages/lyra-ui/llms.txt`](./packages/lyra-ui/llms.txt)
  (short index) and [`llms-full.txt`](./packages/lyra-ui/llms-full.txt) (full API reference).
- **Contributors working on this repo itself:** [`AGENTS.md`](./AGENTS.md) (AI agents) and
  [`CONTRIBUTING.md`](./CONTRIBUTING.md) (humans).

## Claude Code plugin

`@aceshooting/lyra-ui` ships a [Claude Code](https://claude.com/claude-code) plugin so Claude gets
the exact component API (not a guess from training data) while working in a project that depends
on this library, plus commands for migrating off Web Awesome/Shoelace and auditing lyra-ui usage.

```bash
# Via Claude Code's plugin marketplace
/plugin marketplace add aceshooting/lyra-ui
/plugin install lyra-ui@aceshooting
```

Prefer a standalone download (e.g. for claude.ai Skills, outside Claude Code's plugin system)?
Grab [`skills/lyra-ui.skill`](./skills/lyra-ui.skill) directly from this repo.

See [`plugins/lyra-ui`](./plugins/lyra-ui) for the plugin source, or
[`packages/lyra-ui/llms.txt`](./packages/lyra-ui/llms.txt) for the same component reference
without Claude Code.

## Status

`@aceshooting/lyra-ui` is published at `5.1.0`; `@aceshooting/lyra-flags` at `2.0.0` — see each
package's own `CHANGELOG.md` for release history. The two are versioned independently (not always
lockstep) with [Changesets](https://github.com/changesets/changesets) and follow semver: a major
bump signals a breaking change, everything else is additive or a fix. Every release passes the same
CI gate as every PR (install, lint, test, build, manifest — see the badge above), and both packages
are under active development, with new components and fixes shipping regularly.

## License

[MIT](./LICENSE) for the code. `packages/lyra-flags` ships third-party flag artwork vendored
from Google's Noto Emoji project (Public Domain / copyright-exempt) — see
[its README](./packages/lyra-flags/README.md#asset-provenance--license) for the sourcing
details and upstream license text.

---

<p align="center">A UI library built with ❤️ by AI, for AI.</p>
