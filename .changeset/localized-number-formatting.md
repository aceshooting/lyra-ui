---
"@aceshooting/lyra-ui": patch
---

`<lr-artifact-panel>`, `<lr-commit-card>`, `<lr-heatmap>`, `<lr-query-builder>`, `<lr-tree>`, and
`<lr-word-cloud>` now format the numbers they interpolate into localized strings with the effective
locale. `localize()` substitutes values with a bare `String(value)` and does no number formatting,
so these rendered Western digits inside otherwise fully-translated sentences — under a locale using
its own numbering system (`ar-u-nu-arab`, `hi-u-nu-deva`, …) a single announcement mixed two digit
sets.

`<lr-attachment-chip>` also no longer falls back to an empty `src` on its thumbnail `<img>`; an
empty `src` is a valid URL that resolves against the document, so it would make the browser
re-request the page as an image.
