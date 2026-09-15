---
"@aceshooting/lyra-ui": patch
---

Fixes `<lr-table>` so a `sticky` column's own header cell now shows
`--lr-table-header-sorted-bg`/`--lr-table-header-sorted-color` while that column is sorted, instead
of always painting the plain surface color.

A sticky sortable column's `<th>` carries both the internal sticky-positioning marker and
`aria-sort` at once, and the sticky rule's opaque background declaration out-specified the sorted
rule regardless of source order, hiding the sorted-header tint on exactly the columns most likely
to use it (pinned identifier columns are also the ones a consumer sorts by). This pairs with the
earlier fix that let a sticky column's body cell show its row's stripe/hover/selected background
instead of a flat surface color -- the header half of that same defect is now closed too.
