---
"@aceshooting/lyra-ui": patch
---
lr-table: focus and hover re-renders no longer recompute the heat-tint domain over every row, re-validate unchanged cell styles with `CSS.supports()`, rebuild the footer row list per footer cell, resolve the themed resize minimum once per resizable column, or force a layout to find the focused header.
