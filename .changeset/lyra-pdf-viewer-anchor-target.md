---
"@aceshooting/lyra-ui": minor
---

`lyra-pdf-viewer` becomes the reference `DocumentAnchorTarget` implementation: resolves `page`,
`text-quote`, and `region` anchors (`scrollToAnchor()`), paints highlights per page via
`lyra-highlight-layer`, exposes `getPageText(page)` and `renderPageThumbnail(page, canvas, options?)`
for rail/search/chunking consumers, and emits `lyra-load { pageCount }`,
`lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result`. The `application/pdf` document-
viewer registration now declares its anchor/text-select capabilities and forwards `anchor`/
`highlights`. All additive — existing `src`/`page`/`zoom`/`nextPage()`/`previousPage()`/`zoomIn()`/
`zoomOut()` and their events are unchanged.
