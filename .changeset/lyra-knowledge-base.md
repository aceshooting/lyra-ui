---
"@aceshooting/lyra-ui": minor
---

New `<lr-knowledge-base>` component: a knowledge-base source list showing sync status, indexing
health, and permissions per source, plus an aggregate summary row. A controlled data view -- it
never syncs or indexes anything itself, only presents `sources: KnowledgeSource[]` and emits
request-only `lr-kb-create`/`lr-kb-sync`/`lr-kb-pause`/`lr-kb-delete` events for the host to act on
and reflect back into a new `sources` value, mirroring `lr-thread-list`'s `lr-thread-pin`/
`-archive`/`-delete` convention. Composes `lr-table` for the source list (its own interactive-cell
click guarding keeps the per-row `lr-menu` from misfiring row activation), `lr-badge` for the
sync-status/indexing-health/permission indicators, `lr-stat` for the aggregate summary, and
`lr-menu` for the per-row Sync now/Pause sync/Delete source actions.
