---
'@aceshooting/lyra-ui': major
---

`lr-chart`, `lr-box-plot`, `lr-graph-legend`, and `lr-graph-query-builder`'s seven `lr-before-*` cancelable veto events are renamed to the library's dominant `*-request` convention, matching the ~17 other components that already use it. Every settled event name, detail shape, and cancelability is unchanged, and each old `lr-before-*` name keeps firing (deprecated, removal not before 21.0.0) with the same detail immediately alongside its new counterpart, so either name may veto the action.

MIGRATION:
- `lr-before-legend-visibility-change` (`lr-chart`, `lr-box-plot`) -> `lr-legend-visibility-change-request`
- `lr-before-datum-visibility-change` (`lr-chart`) -> `lr-datum-visibility-change-request`
- `lr-before-visibility-change` (`lr-graph-legend`) -> `lr-visibility-change-request`
- `lr-before-query-run` (`lr-graph-query-builder`) -> `lr-query-run-request`
- `lr-before-query-save` (`lr-graph-query-builder`) -> `lr-query-save-request`
- `lr-before-query-load` (`lr-graph-query-builder`) -> `lr-query-load-request`
- `lr-before-query-delete` (`lr-graph-query-builder`) -> `lr-query-delete-request`

Existing listeners on the old names keep working unchanged until the alias is removed; rename at your convenience to adopt the canonical spelling.
