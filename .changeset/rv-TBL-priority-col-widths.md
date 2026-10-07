---
"@aceshooting/lyra-ui": patch
---
lr-table: hiding a `priority` column now also drops its `<col>`, so the remaining columns keep their own declared widths and the table narrows, instead of every later column taking the hidden column's width and trailing columns collapsing.
