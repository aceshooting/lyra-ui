# @aceshooting/lyra-cdn

The single-script-tag build of [`@aceshooting/lyra-ui`](https://www.npmjs.com/package/@aceshooting/lyra-ui).
Everything is bundled into relative, code-split chunks: Lit, tslib, Floating UI, every optional peer
(Chart.js, PDF.js, MapLibre, Shiki, KaTeX, SheetJS, mammoth, DOMPurify and the rest), the locale
catalogs, and the `@aceshooting/lyra-gen`, `@aceshooting/lyra-docs`, `@aceshooting/lyra-map`,
`@aceshooting/lyra-3d` and `@aceshooting/lyra-flags` companions. One tag is the whole install: no
build step and no import map. Only the chunks of the components the page renders are fetched.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn@VERSION/dist/theme.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn@VERSION/dist/lyra-ui.loader.js"></script>

<lr-button variant="primary">Save</lr-button>
<lr-chart type="bar" label="Sales"></lr-chart>
<lr-pdf-viewer src="/report.pdf"></lr-pdf-viewer>
```

Pin an exact `VERSION` in production; this package versions together with `@aceshooting/lyra-ui`.
`https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn` alone resolves to the loader.

## What works without setup

- **Every component**, including the ones that need an optional peer when installed from npm.
- **Workers.** PDF.js, lyra-map, MapLibre and lyra-3d workers ship beside the chunks and are configured
  automatically, also from a cross-origin CDN. lyra-3d's layout and model workers run on the main
  thread when a module worker cannot start, which is the case cross-origin.
- **Locales.** The catalog for the document's `lang` loads automatically, and again when it changes:
  the exact tag when one ships, otherwise its base language (`fr-FR` uses `fr`).
- **Companion elements.** `<lr-gen-view>`, `<lr-gen-devtools>` and `<lr-docx-editor>` load when they
  first appear; `<lr-flag>` resolves country and language flags.

## Modules beside the loader

| File | Exports |
| --- | --- |
| `dist/lyra-ui.loader.js` | `start`, `stop`, `discover`, `loadLyraLocale` |
| `dist/lyra-gen.js` | the `@aceshooting/lyra-gen` root, with `<lr-gen-view>` and `<lr-gen-devtools>` registered |
| `dist/lyra-docs.js` | the `@aceshooting/lyra-docs/docx` contracts, with `<lr-docx-editor>` registered |
| `dist/phone-numbers.js` | `loadPhoneNumberAdapter()`: `el.adapter = await loadPhoneNumberAdapter()` for `<lr-phone-input>` |

They share the loader's chunks, so a page still has one Lit and one element registry:

```html
<script type="module">
  import { initialCatalog, subsetCatalog, validateView } from 'https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn@VERSION/dist/lyra-gen.js';
</script>
```

## Script attributes

- `data-lyra-optional-peers="dompurify,marked"`: enable only these peers' components (`none` disables
  them all). The default is every bundled peer.
- `data-lyra-autoload-events`: emit the autoloader's lifecycle events.
- `data-lyra-autoload="false"` (alias `data-lyra-no-autoload`): load the module without starting it;
  it re-exports `start`, `stop` and `discover` for manual control.
- `data-lyra-cloak-timeout="2000"`: the most a `lr-cloak` element stays hidden while the first scan runs.

The loader starts on `DOMContentLoaded`, injects no styles or inline script, and reveals elements
carrying class or attribute `lr-cloak` once the first scan settles.

## Also published

`dist/` carries `theme.css`, `theme-core.css`, `density.css`, `accents.css`, `accent-roles.css`,
`design-tokens.css`, `native.css`, `utilities.css` and `docx-editor.css` (link it on pages that render
`<lr-docx-editor>`).

## Limits

The archive is large because it carries every peer, but no page downloads it whole: a CDN serves files
individually and the loader fetches only what the page renders. Bundler users should install
`@aceshooting/lyra-ui` and the peers they use instead. No source maps are shipped.

MIT. Bundled third-party licenses: [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md), plus the
companions' own notices under `dist/licenses/`.
