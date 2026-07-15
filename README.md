# Lyra UI (monorepo)

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/npm/l/%40aceshooting%2Flyra-ui)](./LICENSE)

A pnpm workspace hosting `lyra-ui` and its optional companion packages.

**[Browse the live docs site →](https://aceshooting.github.io/lyra-ui/)** — every component with
a live example, source code, and API reference.

**Lyra UI is a free, independent alternative to Shoelace and Web Awesome.** It is a MIT-licensed,
framework-agnostic Lit web-component library for production interfaces: accessible form controls,
navigation, overlays, dashboards, data visualization, file workflows, and a complete conversation
and agent UI toolkit for chat products. It runs on native custom elements, has no runtime dependency
on Shoelace or Web Awesome, and ships with its own design tokens, localization runtime, RTL support,
reduced-motion behavior, and form-associated controls.

Lyra also makes migration practical. Selected components expose a documented Web Awesome-compatible
surface under the `lyra-` prefix, so many `wa-*` integrations can move through a mechanical tag-name
and import change, with intentional differences documented per component. Shoelace users get a
clear `sl-*` → `lyra-*` component map and migration notes; Lyra is an independent implementation,
not a fork, rebrand, official product, or affiliated project. No Web Awesome Pro source code was
available to or used by the maintainers.

The result is one open library for everyday UI, dashboards and charts, and AI chat/agent interfaces —
with the broad component coverage of a general-purpose design system and original building blocks
for data-heavy and streaming applications.

| Package | Description |
|---|---|
| [`packages/lyra-ui`](./packages/lyra-ui) | Free, independent Lit web components — an alternative to Shoelace and Web Awesome. |
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

133 custom elements across five component families. Every tag has a live, interactive example on the
[docs site](https://aceshooting.github.io/lyra-ui/); for the full per-tag reference (Web Awesome
mirror, props, events, slots, parts) see
[`packages/lyra-ui/README.md#components`](./packages/lyra-ui/README.md#components).

| Family | Highlights |
|---|---|
| Form controls and input workflows | combobox, select, date picker/input, textarea, input, button, phone input, file input, color/radio/checkbox/switch/slider controls, toast, and sparkline |
| Dashboard and data visualization | stat card, sortable table, pagination, gauge, export/copy actions, split panes, widgets, word cloud, time range, playback, heatmap, tree, graph, and Chart.js or dependency-free charts |
| Layout, navigation, and overlays | tabs, menus, breadcrumbs, details/accordion, dialog, drawer, carousel, popover, tooltip, dropdown, scroller, resize/observer utilities, and responsive panels |
| Conversation and Agent UI | chat messages and composer, streaming text, citations, sources, tool-call/result/approval flows, model selection, document/media previews, and more |
| Display and utility primitives | badges, tags, callouts, cards, avatars, skeletons, progress, spinners, rating, formatting, markdown, code, JSON, and live-region helpers |

## Theming, internationalization & RTL

Every one of the 133 tags is built on the same three guarantees — not opt-in per component:

- **Theming** through `--lyra-*` design tokens — retheme by overriding a custom property,
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

`@aceshooting/lyra-ui` is published at `3.0.0`; `@aceshooting/lyra-flags` at `1.3.0` — see each
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
