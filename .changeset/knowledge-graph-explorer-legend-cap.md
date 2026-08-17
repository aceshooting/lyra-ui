---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-knowledge-graph-explorer>`'s composed legend starving the graph pane when `nodeTypes` is long.

The explorer's flex column gives `[part='graph']` `flex: 1 1 auto; min-block-size: 0` so it's the
one part designed to shrink, but `[part='legend']` had no size cap — browser-default flex-item
sizing floors it at its full content height, so a `nodeTypes` list long enough to exceed the
host's allocated height pushed 100% of the shrinkage onto the graph pane instead, silently
ignoring the documented `height` property. `[part='legend']` now caps at `var(--lr-size-12rem)`
and scrolls internally past that, matching the existing `[part='search-results']` pattern in the
same stylesheet.
