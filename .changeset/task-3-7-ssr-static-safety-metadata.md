---
"@aceshooting/lyra-ui": minor
---

`LYRA_SSR_SUPPORT_MATRIX.declarativeShadowDom` (from `@aceshooting/lyra-ui/ssr-loader.js`) gains a
`staticSafety` record, and `getLyraSsrStaticSafety(tagName)` reads one tag's entry directly. Every
`render-and-hydrate` tag now classifies as `'static-safe'` (its declarative-shadow-DOM output stays
visually and functionally complete indefinitely, even if hydration JavaScript never runs at all —
no script bundle, JS blocked, or a crawler reading raw HTML) or `'hydration-required'` (correctness
is only ever promised once hydration executes). Previously the docs described only the moment
around hydration itself (server guess vs. corrected client state) and were silent on the
zero-JS-forever case, so a static-generation consumer had no documented way to tell which of the
264 `render-and-hydrate` components were safe to rely on without a script bundle; `LYRA_SSR_SUPPORT_MATRIX.capabilities`
existed but was a single global record with no per-tag link to it.

The classification is derived from a new evidence-backed per-tag `LYRA_SSR_TAG_CAPABILITIES`
record (which of `canvas`/`layoutMeasurement`/`mediaPlayback`/`observers`/`remoteContent` a tag's
own correctness depends on) plus an explicit `LYRA_SSR_AUDITED_STATIC_SAFE_TAGS` list for every
reviewed tag with none of those. `pnpm test:ssr` now fails closed on any `render-and-hydrate` tag
present in neither — an unreviewed tag can never pass by silently defaulting to `'static-safe'`.
`llms/shared.md`'s "SSR and declarative shadow DOM" section documents the guarantee together with a
worked static-safe example (`lr-details`, whose native `<details>` toggle keeps working with zero
JavaScript because the open state is server-reflected and the veto listener is never registered
without hydration) and a worked hydration-required example (a canvas-painted chart, empty until
script paints it).
