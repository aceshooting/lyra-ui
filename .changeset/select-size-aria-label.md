---
"@aceshooting/lyra-ui": minor
---

`<lyra-select>`: added a `size` property (`xs`/`s`/`m`/`l`/`xl`, default `m`, same scale as
`lyra-toast-item`'s `size`) for compact toolbar placements that don't fit the default trigger height.
Also, the trigger's accessible name now checks a host-level `aria-label` attribute before falling back
to `label`/`placeholder`/`"Select"` — previously a plain `aria-label` on `<lyra-select>` was silently
ignored.
