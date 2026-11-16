---
'@aceshooting/lyra-ui': minor
---

Add `layout` to `lr-json-viewer` (`'auto' | 'inline' | 'stacked'`, default `'auto'`). Below a 30rem allocation the default now stacks each scalar value under its key and tightens leaf rows, through a container query on the viewer's own width, so a viewer inside a phone-width `lr-tool-call-block` no longer squeezes key and value side by side. Leaf rows drop the icon-button-sized floor of their hidden toggle spacer, while real expand/collapse toggles keep their full hit area. `layout="stacked"` forces this layout at any width and `layout="inline"` restores the side-by-side row at every width. Keys now break after `_`, `-`, `.`, `/`, `:` and `@` and at camelCase humps instead of mid-word. The `LyraJsonViewerLayout` type is exported.
