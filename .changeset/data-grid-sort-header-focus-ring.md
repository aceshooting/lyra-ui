---
"@aceshooting/lyra-ui": patch
---

Fix `lr-data-grid`'s sort-header focus ring targeting `<th>`, which can never itself receive
keyboard focus (only its nested sort button can) -- tabbing to a sortable column header now shows
the library's focus ring instead of the browser's raw default, and the sort button gains a
matching hover state.
