---
"@aceshooting/lyra-ui": minor
---

`lyra-diff-view` gains `layout="split"` (two side-by-side columns derived from the same line-diff
alignment as the default unified view — unbalanced replace hunks pad the shorter side with empty
placeholder rows) and optional syntax highlighting via `language`/`languages` (same fine-grained
shiki-core-only shape as `lyra-code-block-core`, so the peer-free default stays truly peer-free).
Previously diff-view only rendered a single interleaved unified view with no highlighting option.
