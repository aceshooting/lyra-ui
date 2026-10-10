---
"@aceshooting/lyra-ui": minor
---

`<lr-pagination format="compact">` no longer renders the page input touching its "/ N" page count: `[part="page-field"]` now has a small default gap (`var(--lr-space-2xs)`), themeable through the new `--lr-pagination-page-field-gap`, alongside `--lr-pagination-controls-gap` and `--lr-pagination-pages-gap`.
