---
"@aceshooting/lyra-ui": minor
---

`@aceshooting/lyra-ui/theme-bootstrap.js` -- the static, external no-flash theme script for a
strict Content-Security-Policy -- now reads `data-lr-theme-storage-key` and
`data-lr-theme-attributes` (space-separated) from its own `<script>` tag via
`document.currentScript` at parse time, so an application with its own pre-existing `localStorage`
key can use the shared static asset instead of inlining a per-app copy generated from
`createLyraThemeBootstrap({ storageKey })`. Both attributes are optional and validated, failing
closed to today's baked-in defaults (`'lyra-theme'` and `data-lr-theme`/`data-theme`) on an absent,
empty, oversized, or malformed value -- including an attribute-name list entry that is not a safe
`data-*`-shaped token (rejecting `on*` handler names, `style`/`class`/`id`, and anything containing
whitespace, a quote, `=`, or a control character), a list longer than eight entries or with a
duplicated entry, an oversized storage key, or a `null` `document.currentScript` (module/async
misuse). A `<script>` tag carrying neither attribute -- every existing deployment, and every inline
use of `lyraThemeBootstrap`/`createLyraThemeBootstrap()` -- behaves exactly as before.
