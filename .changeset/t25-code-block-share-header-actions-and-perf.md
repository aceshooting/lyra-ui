---
'@aceshooting/lyra-ui': patch
---

`lr-code-block` and `lr-code-block-core` now share a single header-actions slot-detection
implementation, preventing that logic from silently drifting between the two variants in the
future. `lr-ebook-viewer` and `lr-graph-legend` resolve their theme-token colors once per repaint
instead of once per highlight/legend entry, and `lr-retrieval-compare` computes each comparison
set's ranked chunk list once per render instead of redundantly recomputing it for every overlap
pair and render usage. `lr-retrieval-compare`'s comparison-set row no longer exposes a
sub-pixel-rounding phantom vertical scrollbar.
