---
"@aceshooting/lyra-ui": minor
---

`lr-accordion-item` gains four independently tunable padding hooks, mirroring `lr-details`: `--lr-accordion-item-summary-padding-block`/`-inline` for the trigger button and `--lr-accordion-item-content-padding-block-end`/`-inline` for the panel content. Each falls through to the existing `--lr-accordion-item-spacing` (and its `--spacing` alias) when unset, so an un-set item renders unchanged; an asymmetric trigger row or a flush, zero-padded panel no longer requires a `::part()` override.
