---
"@aceshooting/lyra-ui": minor
---

`lyra-pdf-viewer` gains an imperative in-document search API (`search()`, `searchNext()`,
`searchPrevious()`, `clearSearch()`, event `lyra-search-change`), a public `goToPage(page):
Promise<boolean>` method, and `getOutline(): Promise<PdfOutlineItem[]>` for reading a PDF's table of
contents. Search matches paint as `<mark part="search-match">` (`search-match-active` for the
current one) without touching any highlight state. The `application/pdf` document-viewer
registration now declares `search: true` in its capabilities. Previously there was no way to search
inside a rendered PDF, jump to a page programmatically, or read its outline.
