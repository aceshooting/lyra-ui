---
"@aceshooting/lyra-ui": minor
---

`<lr-pagination>` gains an indeterminate mode for a server API that never returns a total item
count — limit/offset and cursor/keyset APIs typically don't. Set `total="-1"` and use the new
`hasNext` property to report whether one more page exists; the component then renders previous and
next only, with a page-number field and no numbered page list, item-range summary, or `/
totalPages` readout, regardless of `format`, `withSummary`, or `withEdges`. Previous is disabled at
page 1 exactly as in the known-total path; events, focus management, and the applied-page
announcement all use the same contract, minus the total-pages figure in the announcement text. Any
other negative `total` still renders the ordinary empty state.

`<lr-table>`'s server pagination mode forwards this through two new properties, `unknownTotal` and
`hasNext`, so a table backed by a total-less server API gets the same built-in loading state,
localized labels, focus handling, and `lr-page-change` event it already has for a known total —
no more hand-rolled previous/next buttons around a bare page readout.
