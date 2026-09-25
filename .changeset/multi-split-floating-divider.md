---
'@aceshooting/lyra-ui': patch
---

`lr-multi-split`: when the collapsing pane is floating (drawer open or closed), the divider beside it no longer takes a gutter or paints a line, so the remaining panes fill the split as documented. The rail state keeps its divider. Focus moved out of a collapsing pane now prefers a divider that stays enabled; with three or more panels and `collapse="start"` it previously landed on the divider being disabled.
