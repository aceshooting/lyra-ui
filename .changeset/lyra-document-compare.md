---
"@aceshooting/lyra-ui": minor
---

New `<lr-document-compare>` component: side-by-side or inline comparison of two document versions,
composed entirely from existing primitives -- `<lr-diff-view>` (the real two-string line diff,
`view="diff"`, the default) and `<lr-document-preview>` (each version's own actual rendered
content, `view="side-by-side"`). The side-by-side panes are independently scrollable, so this
component adds two minimal, purpose-built coordination mechanisms scoped narrowly to that: a
proportional scroll-position sync (`syncScroll`, default `true`, mirroring `<lr-compare-panel>`'s
own proven algorithm) and highlight-anchor sync (activating a region highlight shared by `id`
across both versions' `highlights` scrolls the other pane to its own matching highlight). A shared
`anchor` property (matching `<lr-document-viewer>`'s own) drives both panes to the same target at
once. New `DocumentCompareVersion` type extends the shared `DocumentRef` (from `@aceshooting/lyra-ui/ai/types`)
with `text` (diffed directly, no fetch) and per-version `highlights`.
