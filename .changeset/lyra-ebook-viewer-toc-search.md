---
"@aceshooting/lyra-ui": minor
---

`lyra-ebook-viewer` gains `getToc()` (a flat, nested table of contents from the EPUB's own
navigation document), a `location` property (get/set the current CFI or spine href, with
`lyra-location-change` on user navigation), an imperative in-book search API (`search()`,
`searchNext()`, `searchPrevious()`, `clearSearch()`, event `lyra-search-change`), and `cfi`/
`text-quote` anchor-target support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, events
`lyra-highlight-activate`/`lyra-text-select`). Previously there was no way to read an EPUB's table
of contents, deep-link into a specific location, or search inside a rendered book.
