---
'@aceshooting/lyra-ui': minor
---

`lr-multi-split` can fold any panel, not only the responsive edge pane, to a narrow rail at any container width. Assign `collapsedPanels` (panel ids) or call `collapsePanel()`, `expandPanel()` or `togglePanel()` from a host control. A folded panel clamps to `--lr-multi-split-collapsed-panel-size` and carries a `data-panel-collapsed` marker, so its own content can render the strip. Its share goes to the open panels within their `panelConstraints`, and dividers beside it keep resizing the nearest open panels. The methods announce `lr-multi-split-panel-collapse-change` and persist the folded set with the sizes under `storage-key`. Existing stored layouts still restore, and a split with nothing folded keeps writing the same stored format.
