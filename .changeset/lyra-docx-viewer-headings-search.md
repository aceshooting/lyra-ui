---
"@aceshooting/lyra-ui": minor
---

`lyra-docx-viewer` gains `getHeadingTree()` (a document-ordered heading outline stamped with
GitHub-slugger-style ids, using the same slugging algorithm as `lyra-markdown`), `fragment`/
`text-quote` anchor-target support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, events
`lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result`), and an imperative in-document
search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`, event
`lyra-search-change`). Previously there was no way to deep-link into a section, highlight a quoted
passage, or search inside a rendered Word document.
