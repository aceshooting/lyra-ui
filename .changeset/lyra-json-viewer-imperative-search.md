---
"@aceshooting/lyra-ui": minor
---

`lyra-json-viewer` gains an imperative search API (`runSearch()`, `searchNext()`,
`searchPrevious()`, `clearSearch()`, event `lyra-search-change`) as a thin layer over its existing
declarative `search` property -- the property, its highlighting, and its force-expand behavior are
unchanged; the new methods add match-count resolution and a navigable cursor (`data-active` on the
current match) on top. The count-resolving entry point is named `runSearch()` rather than `search()`
(unlike this same quartet on other viewers) because `search` is already this component's own public
string property -- a method can't share its name. Previously there was no way to count matches or
step between them programmatically.
