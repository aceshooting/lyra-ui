---
"@aceshooting/lyra-ui": minor
---

Expose `lr-provenance-panel`'s entity-chip row as the `entity-row` CSS part and make its line
packing themeable through `--lr-provenance-panel-entity-justify` (default `flex-start`, so nothing
changes when unset). The row wraps N entity chips but carried only a class, and it fills
`::part(body)`'s inline size, so justifying the body could not move the wrapped lines — the same
unreachable-packing gap fixed for `lr-suggestion-chips` in this release.
