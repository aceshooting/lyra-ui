---
'@aceshooting/lyra-ui': major
---

Item-identity collections now ignore an assignment of the array they already hold. Assign a new array to update; mutating an array or one of its items and assigning the same array again no longer re-renders.

This applies to `lr-activity-feed` `entries`, `lr-agent-trace`, `lr-span-waterfall` and `lr-trace-tree` `spans`, `lr-calendar` `events`, `lr-claim-evidence` `claims` and `citations`, `lr-command-palette` `commands`, `lr-date-picker` `presets`, `lr-eval-dataset` and `lr-eval-run` `examples`, `lr-grounding-summary` `citations`, `lr-ingestion-queue`, `lr-node-palette`, `lr-prompt-queue`, `lr-task-list`, `lr-virtual-list`, `lr-mention-popover` and `lr-swatch-picker` `items`, `lr-map` `markers` and `dataLayers`, `lr-memory-panel` `shortTerm` and `longTerm`, `lr-retrieval-results` `chunks`, `lr-test-results` `suites`, `lr-thread-list` `threads` (unchanged) and `lr-tool-timeline` `entries`. Write `el.items = [...el.items, item]` instead of `el.items.push(item); el.items = el.items`. Opaque provider sources (`lr-virtual-list` `source`, `treeSource`, `dataSource`) keep refreshing when the same object is assigned again or `requestUpdate()` is called.

The protected static `immutableSourceCollectionProperties` on `LyraElement` is removed; the rule is the default for every identity collection. `lyra-ui-migrate --rule=immutable-collections` reports in-place array changes and same-array reassignments on these properties with the `IMMUTABLE_COLLECTION_REVIEW` code (reports only, acknowledged with `lyra-migrate-reviewed: IMMUTABLE_COLLECTION_REVIEW:<property>`). See `llms/shared/v29-to-v30-migration.md`.
