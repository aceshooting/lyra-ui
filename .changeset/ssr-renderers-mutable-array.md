---
'@aceshooting/lyra-ui': patch
---

`lyraSsrElementRenderers()` now returns a fresh mutable array type instead of a readonly tuple, so the documented `render(template, { elementRenderers: lyraSsrElementRenderers(LitElementRenderer) })` call compiles under strict TypeScript against `@lit-labs/ssr`'s `RenderInfo` (it previously failed with TS4104). Each call returns a new array, so a caller that mutates it affects nobody else.
