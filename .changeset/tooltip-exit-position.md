---
'@aceshooting/lyra-ui': patch
---

Anchored surfaces (`lr-tooltip`, `lr-popover`, `lr-dropdown`, `lr-popup`, `lr-select`, `lr-combobox` and the other popup users) now take the resolved positioning strategy, such as `--lr-positioning-strategy: fixed`, the moment they open instead of after the first placement pass, so a tooltip that opens or closes quickly no longer lays out at an unresolved position or briefly widens an `overflow: auto` ancestor and makes the page horizontally scrollable.
