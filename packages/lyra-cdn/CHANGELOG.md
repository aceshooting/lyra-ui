# @aceshooting/lyra-cdn

## 33.1.0

No changes in this release.

## 33.0.0

### Minor Changes

- 6dc25b2: Ship the opt-in `accent-roles.css` stylesheet (per-role `data-lr-accent-*` remapping) alongside the other CDN stylesheets, exported as `@aceshooting/lyra-cdn/accent-roles.css`.

## 32.1.0

### Minor Changes

- cd597ad: Add `@aceshooting/lyra-cdn`: a companion package with a pre-bundled build of `@aceshooting/lyra-ui`. One `<script type="module">` tag loads Lyra with lit, tslib and Floating UI inlined into code-split chunks, no import map or build step required. The loader starts the autoloader on `DOMContentLoaded`, honours `data-lyra-autoload="false"`, reveals `lr-cloak` content once the first scan settles (cap: `data-lyra-cloak-timeout`, default 2000 ms), and ships the theme, density, accents, native and utilities stylesheets beside it. Optional peers and translation catalogs stay unbundled and fail closed.
