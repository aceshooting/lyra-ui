# Lyra UI

Free, clean-room [Lit](https://lit.dev) web components — a companion to
[Web Awesome](https://webawesome.com) that provides open-source equivalents of several
Web Awesome **Pro** components, plus a few extras. Token-compatible with Web Awesome, so
the components look native inside a WA app, and fully usable standalone.

> **Independent project.** Not affiliated with or endorsed by Web Awesome. Component APIs
> intentionally mirror Web Awesome's public API (attributes, slots, events, CSS parts) so
> migration is a prefix rename — but every implementation here is original (clean-room).

## Install

```bash
npm install lyra-ui
# peer: Lit is bundled; Floating UI ships with the positioned components
```

## Usage

Import just what you use (tree-shakeable, granular entry points):

```js
import 'lyra-ui/components/combobox/combobox.js';
import 'lyra-ui/components/combobox/option.js';
```

```html
<lyra-combobox label="Fruit" with-clear>
  <lyra-option value="a">Apple</lyra-option>
  <lyra-option value="b">Banana</lyra-option>
</lyra-combobox>
```

…or pull the whole library:

```js
import 'lyra-ui';
```

Imperative toast (a drop-in for `react-hot-toast`):

```js
import { toast } from 'lyra-ui';
toast({ message: 'Saved', variant: 'success' });
```

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

**v1 (this release)**

| Component | Mirrors | Notes |
|-----------|---------|-------|
| `<lyra-combobox>` + `<lyra-option>` | `wa-combobox` | Filterable single/multi select, form-associated |
| `<lyra-date-picker>` | `wa-date-picker` | Inline calendar, single + range |
| `<lyra-date-input>` | `wa-date-input` | Date field + calendar popover, form-associated |
| `<lyra-toast>` + `<lyra-toast-item>` + `toast()` | `wa-toast` / `wa-toast-item` | Stacking notifications |
| `<lyra-sparkline>` | `wa-sparkline` | Zero-dependency inline SVG |
| `<lyra-flag>` | — (extra) | Country/language flags for i18n pickers |

**Roadmap** (survey-driven, see `docs/superpowers/specs/`)

- **Dashboard atoms:** `lyra-table`, `lyra-stat`, `lyra-empty`, `lyra-skeleton`, `lyra-gauge`, `lyra-export-button`, `lyra-split`
- **Temporal + graph:** `lyra-time-range` + `lyra-playback`, `lyra-heatmap`, `lyra-graph`, `lyra-tree`
- **Charts** (mirror `wa-chart` family + box-plot/histogram; `chart.js` optional peer dep)
- **Bigger tracks:** `lyra-map` (maplibre), `lyra-file-input`

## Development

```bash
pnpm install
pnpm test        # @web/test-runner + Playwright (Chromium) + axe a11y
pnpm lint        # tsc --noEmit
pnpm build       # tsc → dist/ (ESM + .d.ts) + copies flag assets
pnpm manifest    # custom-elements.json
pnpm docs        # Vite playground
```

## License

[MIT](./LICENSE) © 2026 Aceshooting
