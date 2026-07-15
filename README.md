# Lyra UI (monorepo)

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/npm/l/%40aceshooting%2Flyra-ui)](./LICENSE)

A pnpm workspace hosting `lyra-ui` and its optional companion packages.

**[Browse the live docs site →](https://aceshooting.github.io/lyra-ui/)** — every component with
a live example, source code, and API reference.

**Lyra UI isn't just another component library.** It's a free, open-source, clean-room extension of
[Web Awesome](https://webawesome.com) — an independent companion project, not an official Web
Awesome product, fork, or rebrand, and not affiliated with, endorsed by, or partnered with Web
Awesome in any way. No Web Awesome Pro source code was ever available to, or used by, the
maintainers; every component here was implemented from scratch, referencing only Web Awesome's
public docs for the surface to mirror. For the components Web Awesome sells only in its **Pro**
tier — the v1 form controls (combobox, select, date picker/input, toast, sparkline) and the core
charting family (line/bar/pie/doughnut/radar/polar-area/scatter/bubble chart) — lyra-ui gives you
free, open-source components wherever Web Awesome Pro normally charges, with the documented
compatible attributes, slots, events, parts, and `--wa-*` token names under a `lyra-` prefix
instead of `wa-`; component-specific notes call out any intentional differences.

That free-Pro-equivalent group is 18 of lyra-ui's 97 tags. The other 79 have no Web Awesome
equivalent at all, free or paid — Web Awesome doesn't sell them in any tier: dashboard atoms (stat
tiles, tables, gauges, empty/skeleton states, split panes, widgets), temporal & graph widgets (time
range, playback scrubber, heatmap, force-directed graph, tree), chart extras Web Awesome doesn't
offer (histogram, box plot, and a dependency-free `lyra-lite-chart`), MapLibre GL maps with
choropleth layers, a drag-drop file dropzone, and — the largest single family by far — a
53-component conversation/agent UI kit (chat composer, tool-call/result/approval dialogs, streaming
text, citations, model selection, and more) for building LLM chat and agent interfaces from
scratch. As far as we've been able to tell, no established project combines those three things —
Web Awesome-compatible foundations, dashboard/visualization components, and agent-chat UI — in one
open, framework-agnostic web-component library.

| Package | Description |
|---|---|
| [`packages/lyra-ui`](./packages/lyra-ui) | Free, clean-room Lit web components — a companion to Web Awesome. |
| [`packages/lyra-flags`](./packages/lyra-flags) | Optional waving flag SVGs for `<lyra-flag>`, kept out of `lyra-ui`'s install by default. |

See each package's own README for install/usage. For local development:

```bash
pnpm install
pnpm build        # builds every package
pnpm test         # tests every package
pnpm lint         # typechecks every package
pnpm docs         # Storybook docs site demoing every component
```

Contributors and AI coding agents working on this repo: see [AGENTS.md](./AGENTS.md).

## Components

97 tags across six component families. Every tag has a live, interactive example on the
[docs site](https://aceshooting.github.io/lyra-ui/); for the full per-tag reference (Web Awesome
mirror, props, events, slots, parts) see
[`packages/lyra-ui/README.md#components`](./packages/lyra-ui/README.md#components).

| Family | Tags | Highlights |
|---|---:|---|
| Form controls, toasts, sparkline | 13 | combobox, select, date picker/input, textarea, input, button, country-aware phone input, toast, sparkline — plus `<lyra-flag>` for i18n pickers |
| Dashboard atoms | 11 | stat card, sortable table, pagination, gauge, extensible export button, standalone copy button, resizable split, widget shell, word cloud |
| Temporal & graph | 6 | two-handle time-range brush, playback scrubber, canvas heatmap, force-directed graph, tree |
| Charts | 12 | line/bar/pie/doughnut/radar/polar-area/scatter/bubble via Chart.js, plus histogram, box plot, and a dependency-free `lyra-lite-chart` |
| Map & file input | 2 | MapLibre GL map with legend/choropleth layers, drag-drop file dropzone |
| Conversation & Agent UI | 53 | chat composer/message, tool-call/result/approval dialogs, streaming text, citations, model select, avatar/card/stepper/segmented, and more — the library's largest family |

## Theming, internationalization & RTL

Every one of the 97 tags is built on the same three guarantees — not opt-in per component:

- **Theming** through `--wa-*`/`--lyra-*` design tokens — retheme by overriding a custom property,
  no per-component theming API to learn.
- **Internationalization** via a small runtime (`registerLyraLocale`/`setLyraLocale`, or a
  per-instance `.strings` override) — every built-in string (labels, announcements, aria-labels)
  is translatable without a rebuild or a per-locale bundle.
- **RTL** with zero per-component opt-in — set `dir="rtl"` (or an RTL `lang`) anywhere up the tree
  and every component mirrors its layout and keyboard navigation to match.

See [`packages/lyra-ui/README.md#theming-internationalization--rtl`](./packages/lyra-ui/README.md#theming-internationalization--rtl)
for the full usage details.

## Documentation

- **Humans:** the [live docs site](https://aceshooting.github.io/lyra-ui/) (Storybook — every
  component's canvas, source, and props/events/slots reference).
- **AI agents integrating this library:** [`packages/lyra-ui/llms.txt`](./packages/lyra-ui/llms.txt)
  (short index) and [`llms-full.txt`](./packages/lyra-ui/llms-full.txt) (full API reference).
- **Contributors working on this repo itself:** [`AGENTS.md`](./AGENTS.md) (AI agents) and
  [`CONTRIBUTING.md`](./CONTRIBUTING.md) (humans).

## Status

`@aceshooting/lyra-ui` is published at `2.12.0`; `@aceshooting/lyra-flags` at `1.3.0` — see each
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
