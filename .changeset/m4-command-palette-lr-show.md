---
'@aceshooting/lyra-ui': major
---

`lr-command-palette` now fires `lr-show` (not `lr-open`) as its cancelable pre-open event, matching the `lr-show`/`lr-hide` overlay-lifecycle vocabulary used by `lr-dialog`, `lr-lightbox`, and the rest of the library — `lr-open` collided in name with the unrelated "item activated" `lr-open` fired by `lr-document-library`/`lr-source-card`. `lr-close` is unchanged. `lr-open` keeps firing as a deprecated alias (identical `detail: null`, cancelability, and timing, dispatched at the same call site; either event can veto the open) through the 20.x line and is removed no earlier than 21.0.0.

MIGRATION: `el.addEventListener('lr-open', handler)` -> `el.addEventListener('lr-show', handler)` (same handler signature, same cancelability and timing). No action needed for `lr-close` listeners, and no action needed at all until the `lr-open` alias is removed in 21.0.0.
