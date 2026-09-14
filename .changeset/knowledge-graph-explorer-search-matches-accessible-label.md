---
"@aceshooting/lyra-ui": minor
---

Make `<lr-knowledge-graph-explorer>`'s search find a node by the name it displays for it.

The explorer already resolved a node's human name as `label`, then `accessibleLabel`, then the raw
`id` — in the search-result rows, the pinned chips, the neighbour rows and the details popover's
accessible name. Its search *filter* was the one place that never learned the third fallback: it
matched `id` and `label` only. A consumer whose node ids are machine keys, naming nodes through
`accessibleLabel` so a dense force layout does not have to draw a visible label on every node, could
therefore see "Marie Curie" in the results list, chips and popover, and get nothing at all by typing
`Marie` — the name the component itself had just shown them.

The filter now matches `id`, `label` and `accessibleLabel`, each folded with the active locale, so
every name a node can be known by is searchable. A node carrying both a `label` and an
`accessibleLabel` matches either: `accessibleLabel` is documented as the richer spoken form of the
same node, so matching it can only make that node findable, never surface an unrelated one.
Matching on `id` and `label` is unchanged, and an empty query still shows no result list and applies
no search dimming.
