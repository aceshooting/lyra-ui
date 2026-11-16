---
'@aceshooting/lyra-ui': minor
---

Add `columns[].cellPart(row)` to `lr-table`. When a column defines it, the resting cell content is wrapped in a block `[part~="cell-content"]` element that also carries the returned part names, so the page or the component that owns the table can style `cell()` output per row with `lr-table::part(...)`. Columns without `cellPart` render unchanged. The reference now states that `cell()` templates render inside the table's shadow root, where the owner's class rules do not apply, and that a `part` attribute inside a `cell()` template is also a table part.
