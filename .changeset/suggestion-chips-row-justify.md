---
"@aceshooting/lyra-ui": minor
---

Expose `lr-suggestion-chips`' chip row as the `row` CSS part and make its line packing themeable
through `--lr-suggestion-chips-justify` (default `flex-start`, so nothing changes when unset).
Centering the chips under centered empty-state text previously had no reachable hook: the row is
rendered in both the wrapping and the scrolling layout, carried only a class, and styling
`::part(base)` as a centered flex container centered the chips only while they fit a single line —
once they wrapped, the row filled the inline size and every line, the short final one included,
packed to the start edge.
