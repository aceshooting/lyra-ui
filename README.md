# Lyra UI (monorepo)

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/npm/l/%40aceshooting%2Flyra-ui)](./LICENSE)

A pnpm workspace hosting `lyra-ui` and its optional companion packages.

**[Browse the live docs site →](https://aceshooting.github.io/lyra-ui/)** — every component with
a live example, source code, and API reference.

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

83 tags across six component families — see the [live docs site](https://aceshooting.github.io/lyra-ui/)
for every example, or [`packages/lyra-ui/README.md`](./packages/lyra-ui/README.md#components) for
the full per-tag reference table.

- **v1 — form controls, toasts, sparkline:** combobox, select, date picker/input, toast, sparkline, flag
- **Dashboard atoms:** empty, skeleton, stat, table, gauge, export button, split, widget, word cloud
- **Temporal & graph:** time range, playback, heatmap, force-directed graph, tree
- **Charts:** line/bar/pie/doughnut/radar/polar-area/scatter/bubble chart, histogram, box plot
- **Map & file input:** maplibre-gl map with legend/choropleth, drag-drop file dropzone
- **Conversation & Agent UI:** dialog, tabs, checkbox, switch, JSON viewer, live region, markdown,
  chat message, typing indicator, tool call chip, tool result view, tool result dialog, chat
  composer, attachment chip, stream status, virtual list, conversation item, model select, slider,
  tool select dialog, citation badge, source list/card, app rail, responsive panel, mention popover,
  streaming text, thinking panel, generation status, code block, tool approval dialog, tool param
  form, menu/menu item, chip/chip group, model settings panel, context meter, dock panel, document
  preview, media card, attachment trigger, kbd, result card/field

## Documentation

- **Humans:** the [live docs site](https://aceshooting.github.io/lyra-ui/) (Storybook — every
  component's canvas, source, and props/events/slots reference).
- **AI agents integrating this library:** [`packages/lyra-ui/llms.txt`](./packages/lyra-ui/llms.txt)
  (short index) and [`llms-full.txt`](./packages/lyra-ui/llms-full.txt) (full API reference).
- **Contributors working on this repo itself:** [`AGENTS.md`](./AGENTS.md) (AI agents) and
  [`CONTRIBUTING.md`](./CONTRIBUTING.md) (humans).

## Status

Pre-1.0 and under active development. All packages build and pass their test suites; the
public API may still change before a 1.0 release.

## License

[MIT](./LICENSE) for the code. `packages/lyra-flags` ships third-party flag artwork vendored
from Google's Noto Emoji project (Public Domain / copyright-exempt) — see
[its README](./packages/lyra-flags/README.md#asset-provenance--license) for the sourcing
details and upstream license text.
