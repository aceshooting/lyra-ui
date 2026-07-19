---
"@aceshooting/lyra-ui": patch
---

`<lr-trace-tree>` now syncs `focusedId` from `activeSpanId` in `willUpdate()` instead of `updated()`,
so the roving-tabindex target updates before render rather than one tick after it.
