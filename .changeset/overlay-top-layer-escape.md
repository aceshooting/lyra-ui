---
"@aceshooting/lyra-ui": minor
---

Dropdowns, menus, tooltips and other anchored overlays inside transformed or contained containers now open at full size outside them, in the browser top layer where the native Popover API is available. This includes containers that become transformed while an overlay is open. This covers `lr-thread-list` and every `lr-virtual-list` row, `lr-flow-canvas` nodes, `lr-selection-toolbar`, and any consumer `transform`/`filter`/`contain` ancestor, in left-to-right and right-to-left documents.

Behaviour change: such promoted `lr-popover`, `lr-dropdown` and `lr-tooltip` instances no longer stack at `--lr-overlay-stack-index`/`--lr-layer-popover` while open. Overlays that are not inside such a container keep their layering.

Behaviour change: overlays inside virtual-list rows and flow-canvas nodes now resolve the `fixed` strategy when none is set (their declared default is unchanged). An explicit `positioning-strategy` or an ancestor `--lr-positioning-strategy` still wins, and `::part(row)`/`::part(node) { --lr-positioning-strategy: absolute }` opts a list or canvas out.

A promoted overlay whose trigger scrolls out of view is hidden until the trigger returns. Where the Popover API is absent, a row holding an open `lr-dropdown` in `lr-virtual-list` (including `lr-thread-list`) temporarily stops transforming, so its menu is no longer clipped. Overlays inside `lr-pan-zoom` content now align with their trigger at any zoom, with either strategy. Scrolling the wheel over, or pressing on, an open `lr-flow-canvas` node menu no longer zooms the canvas or drags the node. Inside unsanitized `lr-markdown` content, Lyra overlays can now paint over the surrounding app while open. A dropdown or popover whose virtual-list row moves while it is open (for example after a re-sort) now stays open and follows its trigger.

`place()` now positions a popup that is already in the native top layer correctly. It now recognises `content-visibility`, `transform-style: preserve-3d`, a non-`none` `offset-path`, and `will-change: contain` or `offset-path` containing blocks, and it no longer mistakes `will-change: transform-origin` for one.
