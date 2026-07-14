---
"@aceshooting/lyra-ui": minor
---

`lyra-table`'s `TableColumn` gains a `headerCell` render hook (mirroring `cell`/`footer`) and `width`/`minWidth` fields. Any column defining `width` switches the table to `table-layout: fixed` so widths are authoritative.
