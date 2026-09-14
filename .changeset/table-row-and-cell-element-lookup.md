---
"@aceshooting/lyra-ui": minor
---

`<lr-table>` gains public row, cell and expansion-panel element lookups, and its row/column data
attributes become documented API.

`rowElement(rowKey)` returns the rendered `<tr>` for one row key, `cellElement(rowKey, columnKey)`
returns the `<td>` at a row/column pair, and `expandedContentElement(rowKey)` returns the
`[part='expanded-cell']` holding that row's `expandedContent(row)` output — each `null` when that
row, column or panel is not in the current render output (filtered out, paged away, column removed,
row collapsed). They exist for code that has to reach content a consumer's own `cell(row)` or
`expandedContent(row)` callback rendered into the table's shadow root: measuring it, scrolling it
into view, or applying something `::part()` cannot express, since only pseudo-classes may follow a
part selector.

There is one method per callback because the expansion panel is a **sibling** `<tr>` of the data row
rather than a descendant of it: `rowElement`/`cellElement` reach `cell(row)` output only, and
`expandedContentElement` is the route to `expandedContent(row)` output.

All three read the DOM as it stands, so `await table.updateComplete` before calling them after
changing any input.

The `data-row-key`, `data-col-key` and `data-expanded-row-key` attributes those elements carry are
now documented stable API rather than an implementation detail. `data-col-key` is the column's own
`key`; `data-row-key` (on the data row) and `data-expanded-row-key` (on the panel row) are a
type-tagged encoding of the row key (`string:a` vs `number:1`) that keeps a numeric key distinct from
the string that stringifies the same way. The panel deliberately does not repeat `data-row-key`, so
every `[data-row-key]` query still resolves exactly one element per row. Prefer the methods over
building a selector from any of them: a consumer-supplied key is not safe to interpolate into CSS
unescaped, which is exactly what the methods avoid.
