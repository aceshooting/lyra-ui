---
"@aceshooting/lyra-ui": patch
---

`lr-table`: an anchored overlay (`lr-dropdown`, `lr-popover`, `lr-select`, `lr-combobox`) inside a `sticky` column cell, such as a per-row actions menu, is no longer covered by the next row's sticky cell. The cell holding an open overlay is raised to the popover layer and a cell with focus inside is raised one step above content, so the open panel stays visible and its items stay clickable over the following rows. `lr-virtual-list` shares the same raise rule and now also covers an open `lr-popover`, `lr-select` or `lr-combobox` in a row. The sticky docs describe how overlays behave in sticky cells and when `top-layer` is still the right opt-in.
