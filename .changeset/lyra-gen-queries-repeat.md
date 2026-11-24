---
"@aceshooting/lyra-gen": minor
---

Catalogs can declare host data `queries`, and generated nodes name one through `dataQuery` with literal `params` and `paramReads` from owned state (filters, selection, time range); `lr-gen-view.queryProvider` runs it once per distinct argument set, aborts superseded runs, keeps the last result with the `query-pending`/`query-failed` parts, and the node's `liveReads` read the result. A node's `repeat` renders its single template child once per keyed item of a live-data, query or state array, with `itemReads` relative to each item and stable element identity across reorders.
