---
"@aceshooting/lyra-ui": minor
---

Fix `lr-retrieval-results`' row, selection and metadata styling never applying while virtualized,
and make every row-level part reachable from a consumer stylesheet.

Rows are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
element's **own** shadow root — one boundary below this component's. A bare `[part='row-body']`
selector in this component's stylesheet cannot cross that boundary, so the checkbox offset, the
row-body layout, the selected-row indicator and the whole metadata list were silently inert
whenever the list virtualized. `grouping="source"` always virtualizes, so every grouped consumer
saw an unstyled result set, and the documented `--lr-retrieval-results-selected-border` custom
property had nothing to recolor there. Each of those rules now pairs its original selector with an
`lr-virtual-list::part(…)` arm, so both rendering paths present identically — the flat path below
`virtualize-at` still renders these parts into this component's own shadow root, where the bare
selector is the one that matches.

`::part()` cannot be followed by an attribute selector, nor by a descendant combinator, so two
kinds of rule needed new part names:

- **New:** `row-body-selected` — added alongside `row-body` as a part list (`::part()` carries
  `part~=` semantics, so both names match the same element) on the selected row. The `data-selected`
  attribute is unchanged and still describes the row's state.
- **New:** `metadata-term` and `metadata-value` — the `<dt>`/`<dd>` inside a `metadata-entry`,
  previously styled through a descendant selector that `::part()` cannot express. The trailing colon
  after a metadata key is now `::part(metadata-term)::after`.

The group header in grouped mode also gains a separator matching the one this component's rows use;
`lr-virtual-list` supplies the rest of its appearance.

`exportparts` now forwards `select`, `row-body`, `row-body-selected`, `metadata`, `metadata-entry`,
`metadata-term` and `metadata-value` alongside the existing `row`/`group-header`, and forwards each
per-row `lr-chunk-inspector`'s own parts onward under a `chunk-` prefix (`chunk`, `chunk-current`,
`chunk-score`, `chunk-score-current`, `chunk-score-bar`, `chunk-score-fill`,
`chunk-score-fill-success`/`-warning`/`-danger`, `chunk-open-button`, `chunk-title`, `chunk-text`,
`chunk-text-clamped`, `chunk-toggle`) — those live two shadow hops deep and were unreachable from
outside the component entirely.
