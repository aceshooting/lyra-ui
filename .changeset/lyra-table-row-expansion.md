---
'@aceshooting/lyra-ui': minor
---

`lyra-table` gains expandable rows: a table-level `expandedContent?: (row) => unknown` renders a
full-width panel beneath any row whose key is in the new consumer-owned `expandedKeys: Set<string |
number>` property, toggled via a built-in leading chevron cell and the new `lyra-row-expand-toggle`
event (`detail: { row, key }`). An optional `canExpand?: (row) => boolean` gates which rows get an
interactive toggle at all. All three properties are additive and default to a no-op, so existing
tables are unaffected.
