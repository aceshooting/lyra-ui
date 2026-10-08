# Lyra UI: UI, made light 🪶 ✨

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
[![Node.js](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.npmjs.org%2F%40aceshooting%2Flyra-ui%2Flatest&query=%24.engines.node&label=node&color=339933&logo=nodedotjs&logoColor=white)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![Lit](https://img.shields.io/badge/Lit-3-324FFF?logo=lit)](https://lit.dev/)
[![Web Components](https://img.shields.io/badge/Web%20Components-native-29ABE2)](https://www.webcomponents.org/)
[![avg per component](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.avgComponentGzipKb&label=avg%20per%20component&suffix=%20KB%20gzip&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json)
[![total gzip](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.barrelGzipKb&label=total%20gzip&suffix=%20KB&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json)
[![types](https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/github/license/aceshooting/lyra-ui)](./LICENSE)

Tested on every modern engine — see [Browser & Node support](#browser--node-support) for what CI
actually proves for each:

[![Chrome](https://img.shields.io/badge/Chrome-tested-4285F4?logo=googlechrome&logoColor=white)](https://github.com/aceshooting/lyra-ui/actions/workflows/test-all-browsers.yml)
[![Firefox](https://img.shields.io/badge/Firefox-tested-FF7139?logo=firefoxbrowser&logoColor=white)](https://github.com/aceshooting/lyra-ui/actions/workflows/full-engine.yml)
[![Safari](https://img.shields.io/badge/Safari-tested-000000?logo=safari&logoColor=white)](https://github.com/aceshooting/lyra-ui/actions/workflows/full-engine.yml)
[![Edge](https://img.shields.io/badge/Edge-tested-0078D7?logo=microsoftedge&logoColor=white)](https://github.com/aceshooting/lyra-ui/actions/workflows/test-all-browsers.yml)
[![Chromium](https://img.shields.io/badge/Chromium-tested-4285F4?logo=chromium&logoColor=white)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)

<p align="center">
  <a href="https://www.lyra-ui.com/">
    <img src=".github/readme/lyra-mark.svg" width="112" height="112" alt="Lyra UI constellation logo" />
  </a>
</p>

Free, independent web components for accessible forms, dashboards, charts, and AI chat/agent
interfaces. Built with Lit; works with Lit, React, Vue, Angular, Svelte, and plain JavaScript.

**[Browse the live docs site →](https://aceshooting.github.io/lyra-ui/)** — every component with
a live example, source code, and API reference.

<p align="center">
  <a href="https://aceshooting.github.io/lyra-ui/"><img src=".github/readme/preview-chat.png" width="32%" alt="Lyra UI Conversation & Agent UI example: a chat message thread" /></a>
  <a href="https://aceshooting.github.io/lyra-ui/"><img src=".github/readme/preview-table.png" width="32%" alt="Lyra UI sortable table example" /></a>
  <a href="https://aceshooting.github.io/lyra-ui/"><img src=".github/readme/preview-chart.png" width="32%" alt="Lyra UI line chart example" /></a>
</p>
<p align="center"><sub>A few of 308 custom elements — <a href="https://aceshooting.github.io/lyra-ui/">browse them all live →</a></sub></p>

## Table of Contents

- [Quick Start](#quick-start)
- [Highlights](#highlights)
- [Principles & Guidelines](#principles--guidelines)
- [Components](#components)
- [Theming, internationalization & RTL](#theming-internationalization--rtl)
- [Framework integration](#framework-integration-react-vue-angular-svelte)
- [SSR & Declarative Shadow DOM](#ssr--declarative-shadow-dom)
- [Browser & Node support](#browser--node-support)
- [Built with](#built-with)
- [Documentation](#documentation)
- [Codex and Claude Code plugin](#codex-and-claude-code-plugin)
- [Status](#status)
- [License](#license)

**Lyra UI is a free, independent alternative to Shoelace and Web Awesome.** It is an MIT-licensed,
framework-agnostic web-component library built with Lit, for use with Lit, React, Vue, Angular, Svelte,
and plain JavaScript. It covers production interfaces: accessible form controls,
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
| [`packages/lyra-ui`](./packages/lyra-ui) | Free, independent web components for Lit, React, Vue, Angular, Svelte, and plain JavaScript. | [![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui) | [![avg per component](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.avgComponentGzipKb&label=avg%20per%20component&suffix=%20KB%20gzip&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json) [![total gzip](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.barrelGzipKb&label=total%20gzip&suffix=%20KB&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json) |
| [`packages/lyra-flags`](./packages/lyra-flags) | Optional waving flag SVGs for `<lr-flag>`, kept out of `lyra-ui`'s install by default. | [![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-flags)](https://www.npmjs.com/package/@aceshooting/lyra-flags) | *n/a — SVG assets, not a JS bundle* |
| [`packages/lyra-docs`](./packages/lyra-docs) | Experimental DOCX editor companion with an optional document engine; document viewers stay in `lyra-ui`. | [![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-docs)](https://www.npmjs.com/package/@aceshooting/lyra-docs) | See the [package README](./packages/lyra-docs/README.md) |
| [`packages/lyra-ide`](./packages/lyra-ide) | Editor data (Custom Elements Manifest, JetBrains web-types, VS Code HTML/CSS custom data), versioned with `lyra-ui`. | [![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ide)](https://www.npmjs.com/package/@aceshooting/lyra-ide) | *n/a — JSON data* |
| [`packages/lyra-translations`](./packages/lyra-translations) | The 66 built-in locale catalogs, versioned with `lyra-ui`. | [![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-translations)](https://www.npmjs.com/package/@aceshooting/lyra-translations) | *n/a — opt-in locale modules* |

See each package's own README for full install/usage details.

## Quick Start

### Use with AI coding agents

Run `npx lyra-ui init-agents` in your project (add `--agent <name>` if not auto-detected, `--json` for machine-readable
output) to install the bundled `lyra-ui` and `compose-lyra-interfaces` skills for Claude Code, Codex, OpenCode, Cursor,
Gemini CLI, GitHub Copilot, Amp and Windsurf; re-running is safe. Options and the marketplace route:
[package README](./packages/lyra-ui/README.md#quick-start) and [Codex and Claude Code plugin](#codex-and-claude-code-plugin).

### Manual setup

```bash
npm install @aceshooting/lyra-ui
```

```js
import '@aceshooting/lyra-ui/components/lr-combobox.js';
import '@aceshooting/lyra-ui/components/lr-option.js';
```

```html
<lr-combobox label="Fruit" clearable>
  <lr-option value="a">Apple</lr-option>
  <lr-option value="b">Banana</lr-option>
</lr-combobox>
```

Per-component optional peers and the tree-shakeable import patterns:
[`packages/lyra-ui/README.md#install`](./packages/lyra-ui/README.md#install).
For new apps, start from the [Lyra signature starter](./packages/lyra-ui/llms/shared/styles-and-tokens.md#lyra-signature-starter);
for arbitrary server/CMS markup, use the guarded
[autoloader](./packages/lyra-ui/README.md#optional-autoloader-and-cdn-entry).

🔗 **[Open in StackBlitz](https://stackblitz.com/github/aceshooting/lyra-ui)** — try it in-browser, no local install.

For local development of this monorepo:

```bash
pnpm install
pnpm build        # builds every package
pnpm test         # tests every package
pnpm lint         # contract-policy, source checks, TypeScript, and type-surface tests
pnpm docs         # Storybook docs site demoing every component
pnpm run migrate-wa --help  # print migration tool usage
pnpm run test:migrate-wa     # run migration fixture/tests
```

Contributors and AI coding agents working on this repo: see [AGENTS.md](./AGENTS.md).

<a id="v21-highlights"></a>

## Highlights

- **Six composable looks** (Lyra, shadcn, Material, data, terminal, high contrast) with independent solid/glass
  surfaces, density, mode and accent, plus a documentation theme builder for validated presets.
- **Conversation UI:** progressive Markdown, code headers with copy controls, scrollable GFM tables, task lists and
  expandable tool-call blocks.
- **Navigation and overlays:** context menus, menubars, navigation menus, toggles, app-rail and multi-split, with
  opt-in browser top-layer popups.
- **Localization:** 66 optional translation catalogs plus built-in English.

The [feature guide](./packages/lyra-ui/README.md#highlights) has APIs and examples; the [roadmap](./docs/roadmap.md)
records shipped releases and open work, including [native document editing](./docs/roadmap/document-editing.md).
Version history and older upgrades: [package changelog](./packages/lyra-ui/CHANGELOG.md). Upgrading to
[v23](./packages/lyra-ui/README.md#upgrading-to-v23), [v24](./packages/lyra-ui/llms/shared/v23-to-v24-migration.md) or
[v27](./packages/lyra-ui/README.md#upgrading-to-v27)? Editor data moved to [`@aceshooting/lyra-ide`](./packages/lyra-ide)
and locale catalogs to [`@aceshooting/lyra-translations`](./packages/lyra-translations).

## Principles & Guidelines

| Principle | Description |
|---|---|
| 🆓 Free & Open Source | MIT-licensed and free — nothing hidden inside |
| Framework Agnostic | Works with Lit, React, Vue, Angular, Svelte, and plain JavaScript — no framework wrappers required |
| 🪶 Lightweight & Tree-Shakeable | Stable per-component entry points; optional peer integrations remain optional |
| ⚡ Performance-First | Native custom elements with no virtual DOM or framework wrappers |
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

308 custom elements across eleven component families. Every tag has a live, interactive example on the
[docs site](https://aceshooting.github.io/lyra-ui/); for the full per-tag reference (Web Awesome
mirror, props, events, slots, parts) see
[`packages/lyra-ui/README.md#components`](./packages/lyra-ui/README.md#components).

Use the stable tag alias `@aceshooting/lyra-ui/components/lr-<name>.js` to register one element;
the alias stays valid if the component's internal family changes. Import
`@aceshooting/lyra-ui/components/<family>` to register a whole family at once.

| Family | Highlights |
|---|---|
| `forms` | button, input, textarea, select, combobox, date picker, phone/token input, color and swatch pickers, emoji picker, locale/currency pickers, code editor, checkbox/radio/switch/slider, toggle and toggle group, time range, rubric form |
| `layout` | page, tabs, menu, menubar, navigation menu, command palette, breadcrumb, details, card, widget, split, stepper, carousel, scroller, app rail, dock panel, dashboard grid, drilldown panel, filter bar, segmented, virtual list, responsive panel |
| `overlays` | dialog, drawer, overlay, context menu, toast, callout, badge, chip, kbd, rating, progress, spinner, skeleton, empty |
| `data` | table, data grid, tree, timeline, calendar, gauge, heatmap, sparkline, word cloud, stat, pagination, query builder, flow canvas and nodes, sequence strip, file tree, env list, context meter |
| `charts` | Chart.js-backed `lr-chart` (optional peer) |
| `conversation` | chat message, composer and viewport, structured message parts, prompt input and queue, streaming text, markdown, code block, model select, realtime session, selection toolbar, branch picker, checkpoint, message actions and feedback, push-to-talk, audio visualizer, thread list |
| `agent-tools` | agent run and trace, thinking panel, subagent panel, MCP app, prompt studio, schema viewer, tool call chip, tool approval dialog and approval queue, task list, terminal, span waterfall, stack trace, test results, activity feed, context inspector, artifact panel, commit card, eval dataset/run/result, evaluation dashboard, policy summary |
| `retrieval` | retrieval search and results, retrieval comparison, grounded RAG answer, claim evidence, grounding summary, RAG evaluation dashboard, citation badge, chunk inspector, knowledge base and admin, ingestion queue, knowledge-graph explorer, graph, mind map, embedding explorer, entity card/chip/dossier, provenance panel, memory panel, neighbor list, path strip |
| `viewers` | document, PDF, DOCX, PPTX, spreadsheet, CSV, notebook, ebook, email, calendar, contact, archive, XML, SVG, HTML and GeoJSON viewers, document compare and preview, dataset viewer, highlight layer, page rail |
| `media` | video and video playlist, image viewer and comparer, lightbox, sandboxed zoomable frame, pan/zoom, AV player, playback, animated image, avatar and avatar group, file icon, file input, attachment chip, map, QR code, flag |
| `utility` | icon, format, copy and export buttons, diff view, JSON viewer, divider, live region, mention popover, tour, poll status, known date, resize/intersection/mutation observers |

## Theming, internationalization & RTL

All 308 tags share three guarantees, not opt-in per component: **theming** through `--lr-*` design tokens (a light/dark
base in `theme.css`, optional looks, and an independent style API for look, surface, density, mode and accent;
[styling guide](./packages/lyra-ui/llms/shared/styles-and-tokens.md#composing-looks-surfaces-and-density)),
**internationalization** through one runtime (`registerLyraLocale`/`setLyraLocale` or a per-instance `.strings`
override, no rebuild), and **RTL** with zero opt-in (`dir="rtl"` anywhere up the tree mirrors layout and keyboard
navigation; `lang` never changes direction). Usage details:
[`packages/lyra-ui/README.md#theming-internationalization--rtl`](./packages/lyra-ui/README.md#theming-internationalization--rtl).

## Framework integration (React, Vue, Angular, Svelte)

Lyra ships plain custom elements — no framework-specific wrapper package needed.

```tsx
// React 19+
import '@aceshooting/lyra-ui/components/lr-combobox.js';
import '@aceshooting/lyra-ui/components/lr-option.js';
import type {} from '@aceshooting/lyra-ui/custom-elements-jsx';

<lr-combobox label="Fruit" clearable>
  <lr-option value="a">Apple</lr-option>
</lr-combobox>
```

Vue uses `@lr-change="onChange"`, Angular `(lr-change)="onChange($event)"` plus `schemas: [CUSTOM_ELEMENTS_SCHEMA]`,
and Svelte 5 `onlr-change={onChange}`.

React/JSX, Vue, and Svelte each have an opt-in, type-only declaration entry (no runtime wrapper, no tag
registration). Property-vs-attribute binding and event-name casing notes:
[`packages/lyra-ui/README.md#framework-integration-react-vue-angular-svelte`](./packages/lyra-ui/README.md#framework-integration-react-vue-angular-svelte).
Complete React 19, Vue, and Svelte Vite applications live in
[`examples/frameworks/`](./examples/frameworks/); each is typechecked and production-built against
the packed package.

## SSR & Declarative Shadow DOM

Root and granular component imports are server-safe. A tested `@lit-labs/ssr` support matrix emits Declarative Shadow
DOM and hydrates in place for compatible components; the rest use an explicit host-and-light-DOM fallback. Use the
helpers from `@aceshooting/lyra-ui/ssr.js` on the server and import `@aceshooting/lyra-ui/hydration.js` before any other
Lit import in the browser. Renderer setup, diagnostics and limits:
[`packages/lyra-ui/README.md#ssr--declarative-shadow-dom`](./packages/lyra-ui/README.md#ssr--declarative-shadow-dom).

## Browser & Node support

- **Node** ≥ 22 to build/test this repo and to run the supported SSR imports (`engines.node`);
  browser-only capabilities start after hydration.
- **Browsers** — any evergreen browser with Custom Elements v1 + Shadow DOM support (Chrome, Edge,
  Firefox, Safari). Every push runs the complete suite against Chromium plus a platform-contract
  suite (a curated fast subset) across Chromium, Chrome, Edge, Firefox, and Safari (WebKit) on
  Node 22. Supported browsers start at Chrome/Edge 120, Firefox 125, and Safari 17. The two engines that only
  get the fast subset per-push (Firefox, Safari/WebKit) get the
  *complete* suite weekly and before every release via
  [`full-engine.yml`](https://github.com/aceshooting/lyra-ui/actions/workflows/full-engine.yml).
  [`test-all-browsers.yml`](https://github.com/aceshooting/lyra-ui/actions/workflows/test-all-browsers.yml)
  runs the complete suite on demand against Chromium, Chrome, and Edge by default (Firefox and
  Safari when selected through its `browsers` input) — the tool of record for "does everything
  actually pass everywhere right now."
- Not tested against Internet Explorer or other browsers without native custom-element support.
- **Exact version floors** (Chromium 120+, Gecko 121+, WebKit 16.4+), how they were derived, the CI
  matrix behind them, assistive-technology status, and the policy for engines outside the window:
  [`docs/support-policy.md`](./docs/support-policy.md).

Per-commit and release evidence lives in the workflow badges above and the
[Actions history](https://github.com/aceshooting/lyra-ui/actions); [`docs/component-quality.md`](./docs/component-quality.md)
records per-tag results.

## Built with

- [Lit 3](https://lit.dev) — the web-component base every Lyra element extends
- [Floating UI](https://floating-ui.com) — positioning engine for popovers, tooltips, dropdowns, and the combobox menu
- [Chart.js](https://www.chartjs.org) & [D3](https://d3js.org) — optional peers powering the Chart.js chart family and `<lr-graph>`
- [Storybook](https://storybook.js.org) — the live docs site and component workshop
- [Noto Emoji](https://github.com/googlefonts/noto-emoji) flag artwork — vendored into `@aceshooting/lyra-flags` (Public Domain)

## Documentation

- **Humans:** the [live docs site](https://aceshooting.github.io/lyra-ui/) (Storybook — every
  component's canvas, source, and props/events/slots reference).
- **Release history:** [package changelog](./packages/lyra-ui/CHANGELOG.md); older majors in the
  [archive](./docs/changelog/).
- **Release scope:** the [roadmap](./docs/roadmap.md).
- **AI agents integrating this library:** [`packages/lyra-ui/llms.txt`](./packages/lyra-ui/llms.txt)
  indexes per-component references and focused guides, so an integration task can load only the
  relevant API details.
- **Contributors working on this repo itself:** [`AGENTS.md`](./AGENTS.md) (AI agents) and
  [`CONTRIBUTING.md`](./CONTRIBUTING.md) (humans).
- **Accessibility:** [`docs/accessibility.md`](./docs/accessibility.md) — which guarantees a gate
  enforces on every commit, which are conventions, and which are not verified at all (no screen
  reader has been run against this library).
- **Component qualification:** [`docs/component-quality.md`](./docs/component-quality.md) —
  per-tag automated evidence, explicit exemptions, human-review status, and known limitations.
- **Component integration:** [`docs/component-integration.md`](./docs/component-integration.md) —
  stable/class imports, optional peers, component dependencies, and measured or pending gzip data.
- **Support window:** [`docs/support-policy.md`](./docs/support-policy.md) — supported browser and
  Node versions, what CI actually proves for each, assistive-technology status, and the policy for
  engines outside the window.
- **Getting help:** [`SUPPORT.md`](./SUPPORT.md) — issue routes, required reproduction details, and
  the boundary between community support and private vulnerability reporting.
- **Governance and substantial changes:** [`GOVERNANCE.md`](./GOVERNANCE.md) and the
  [`docs/rfcs/`](./docs/rfcs/process.md) process — decision authority, RFC scope, lifecycle, and
  proposal template.

## Codex and Claude Code plugin

The npm package already bundles both skills and the command playbooks under `skills/`;
`npx lyra-ui init-agents` installs them into a project (see [Use with AI coding agents](#use-with-ai-coding-agents)).
The repository is also a shared [Codex](https://learn.chatgpt.com/docs/plugins) and
[Claude Code](https://claude.com/claude-code) plugin marketplace, generated from the same source in
`plugins/lyra-ui`, for users who prefer a marketplace install: coding agents get the exact component API
(not a guess from training data), plus
workflows for migrating off Web Awesome/Shoelace and auditing lyra-ui usage.

```bash
# Via Codex CLI's plugin marketplace
codex plugin marketplace add aceshooting/lyra-ui
codex plugin add lyra-ui@aceshooting
```

```bash
# Via Claude Code's plugin marketplace
/plugin marketplace add aceshooting/lyra-ui
/plugin install lyra-ui@aceshooting
```

See [`plugins/lyra-ui`](./plugins/lyra-ui) for the plugin source, or
[`packages/lyra-ui/llms.txt`](./packages/lyra-ui/llms.txt) for the same component reference
without a plugin install. The plugin also includes `$compose-lyra-interfaces`, a focused workflow
for turning product intent into responsive, accessible Lyra component compositions while the
main `$lyra-ui` skill remains the exact API reference.

## Status

`@aceshooting/lyra-ui` source is versioned at `26.0.0`; `@aceshooting/lyra-flags` source at `2.3.0`
— see each package's own `CHANGELOG.md` for release history. Published npm versions can lag these
source versions while a release is being qualified. The two are versioned independently (not
always lockstep) with [Changesets](https://github.com/changesets/changesets) and follow semver.

Every component also carries machine-readable `stable` or `experimental` status plus its first
published `since` version. Both statuses receive normal semver protection once published;
experimental means the design is still under review, not that breaking changes can ship in a minor
release. A deprecation names its replacement, rationale, deprecation version, and earliest removal
version, and remains available for the entire following major release line. The full policy is in
[`packages/lyra-ui/llms/shared.md#component-status-versioning-and-deprecation`](./packages/lyra-ui/llms/shared.md#component-status-versioning-and-deprecation).
Every release passes the same CI gate as every PR, and both packages are under active development.

## License

[MIT](./LICENSE) for the code. `packages/lyra-flags` ships third-party flag artwork vendored
from Google's Noto Emoji project (Public Domain / copyright-exempt) — see
[its README](./packages/lyra-flags/README.md#asset-provenance--license) for the sourcing
details and upstream license text.

---

<p align="center">A UI library built with ❤️ by AI, for AI.</p>
