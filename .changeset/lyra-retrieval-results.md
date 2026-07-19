---
"@aceshooting/lyra-ui": minor
---

New `<lr-retrieval-results>` component: the orchestration-level ranked-chunk-list surface for
retrieval/grounding workflows, consuming `RetrievalChunk[]` from `@aceshooting/lyra-ui/ai/types`.
Composes an internal `<lr-chunk-inspector>` per row (reusing its score bar, tier coloring, title/
page rendering, expandable text, and `compact` mode verbatim -- no hand-rolled chunk-card markup)
and an internal `<lr-virtual-list>` for windowing once the result count is large or `grouping` is
active. Adds deduplication by `id` (keeping the higher-scoring duplicate), optional grouping by
`source.id` (bucketed, best-scoring group first, same convention `<lr-thread-list>`'s date grouping
already uses), multi-selection via a per-row `<lr-checkbox>` (`selectedIds` controlled, `lr-select`
emits the updated ids and matching chunks), pagination/infinite loading (`has-more`/`loading`
forwarded to the internal `<lr-virtual-list>` while virtualized, or a `[part="load-more"]` button
otherwise -- both paths emit `lr-load-more`), and a `compact`/`expanded` `presentation` switch.
`metadata` (arbitrary `Record<string, unknown>`, not rendered by any existing primitive) shows as a
plain key/value list in `expanded` presentation. A row's `lr-chunk-open` is forwarded verbatim for
routing into `<lr-document-viewer>`.
