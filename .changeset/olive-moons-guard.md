---
"@aceshooting/lyra-ui": patch
---

Reject non-integer index segments in anchor resolution. A range-only guard (`i < 0 || i >= len`)
does not reject `NaN` (both comparisons are false) or a fractional index, so `<lr-xml-viewer>`
reported `lr-anchor-result { found: true }` and announced "Jumped to…" for a `node-path` that
matched nothing, and a non-trailing bad segment threw — rejecting `scrollToAnchor()` so
`lr-anchor-result` never fired at all, and surfacing as an unhandled rejection on the declarative
`anchor` path. `<lr-notebook-viewer>` had the same false-positive shape, and
`<lr-virtual-list>.scrollToIndex(NaN)` silently scrolled the list to the top.

`DocumentAnchorTarget` now also degrades a throwing `applyAnchor()` to "not resolved" instead of
letting it reject, so the mixin keeps its documented promise of always reporting a definite result.
