# @aceshooting/lyra-cdn

## 33.3.0

### Minor Changes

- 8da89aa: The single-script-tag build now bundles everything: every optional peer (Chart.js and its plugins, PDF.js, MapLibre, Shiki, KaTeX, marked, DOMPurify, SheetJS, mammoth, PapaParse, ical.js, postal-mime, epub.js, the PowerPoint renderer, d3, qrcode, the emoji data and `libphonenumber-js`), the 80 locale catalogs, and the `@aceshooting/lyra-gen`, `@aceshooting/lyra-docs`, `@aceshooting/lyra-map`, `@aceshooting/lyra-3d` and `@aceshooting/lyra-flags` companions. Every component works from one script tag with no import map, and a page still fetches only the chunks it renders. The PDF.js, lyra-map, MapLibre and lyra-3d workers ship beside their chunks and are configured automatically, including cross-origin. The catalog for the document's `lang` (or its base language) loads automatically, `<lr-gen-view>`, `<lr-gen-devtools>` and `<lr-docx-editor>` load on first sight, and `<lr-flag>` resolves flags without a separate registration. New modules beside the loader: `dist/lyra-gen.js`, `dist/lyra-docs.js` and `dist/phone-numbers.js`, plus `docx-editor.css`. Bundled peers are enabled by default; `data-lyra-optional-peers` now narrows them (`none` disables them all). `THIRD_PARTY_NOTICES.md` is generated from the bundle graph.

## 33.2.0

No changes in this release.

## 33.1.0

No changes in this release.

## 33.0.0

### Minor Changes

- 6dc25b2: Ship the opt-in `accent-roles.css` stylesheet (per-role `data-lr-accent-*` remapping) alongside the other CDN stylesheets, exported as `@aceshooting/lyra-cdn/accent-roles.css`.

## 32.1.0

### Minor Changes

- cd597ad: Add `@aceshooting/lyra-cdn`: a companion package with a pre-bundled build of `@aceshooting/lyra-ui`. One `<script type="module">` tag loads Lyra with lit, tslib and Floating UI inlined into code-split chunks, no import map or build step required. The loader starts the autoloader on `DOMContentLoaded`, honours `data-lyra-autoload="false"`, reveals `lr-cloak` content once the first scan settles (cap: `data-lyra-cloak-timeout`, default 2000 ms), and ships the theme, density, accents, native and utilities stylesheets beside it. Optional peers and translation catalogs stay unbundled and fail closed.
