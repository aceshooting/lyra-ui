---
'@aceshooting/lyra-ui': minor
---

`lr-diff-view` gains the viewer-family search/highlight surface shared with `lr-csv-viewer` and `lr-xml-viewer`: `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`, `scrollToAnchor()`, a `highlights` property, and the matching `lr-search-change`/`lr-highlight-activate`/`lr-anchor-result` events, so a diff can be searched or deep-linked to from outside the component just like every other document viewer. Both navigation paths automatically reveal a `contextLines` fold hiding their target instead of leaving it stranded behind a static marker.
