---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-knowledge-graph-explorer>`'s `[part="search-empty"]` "no matches" message rendering as a
direct child of the `role="list"` `[part="search-results"]` container without `role="listitem"` --
invalid ARIA, since every child of a list role must itself be `listitem` (or one of a small allowed
set), unlike the real `[part="search-result"]` match rows which already carry it. It now carries
`role="listitem"` too.
