# @aceshooting/lyra-cdn

The single-script-tag build of [`@aceshooting/lyra-ui`](https://www.npmjs.com/package/@aceshooting/lyra-ui).
Lit, tslib and Floating UI are bundled into relative, code-split chunks, so one tag is the whole
install: no build step and no import map. Only the components the page renders are fetched.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn@VERSION/dist/theme.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn@VERSION/dist/lyra-ui.loader.js"></script>

<lr-button variant="primary">Save</lr-button>
```

Pin an exact `VERSION` in production; this package versions together with `@aceshooting/lyra-ui`.
`https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn` alone resolves to the loader.

## Script attributes

- `data-lyra-optional-peers="dompurify,postal-mime"` (or `all`): enable optional-peer components.
- `data-lyra-autoload-events`: emit the autoloader's lifecycle events.
- `data-lyra-autoload="false"` (alias `data-lyra-no-autoload`): load the module without starting it;
  it re-exports `start`, `stop` and `discover` for manual control.
- `data-lyra-cloak-timeout="2000"`: the most a `lr-cloak` element stays hidden while the first scan runs.

The loader starts on `DOMContentLoaded`, injects no styles or inline script, and reveals elements
carrying class or attribute `lr-cloak` once the first scan settles.

## Also published

`dist/` carries `theme.css`, `theme-core.css`, `density.css`, `accents.css`, `design-tokens.css`,
`native.css` and `utilities.css`.

## Limits

Optional peers (charts, maps, document viewers, ...) and the non-English catalogs of
`@aceshooting/lyra-translations` are not bundled; a component that needs one takes its localized
fallback until the dependency resolves, for example through an import map to a CDN URL. Bundler
users should install `@aceshooting/lyra-ui` instead. No source maps are shipped.

MIT. Bundled third-party licences: [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
