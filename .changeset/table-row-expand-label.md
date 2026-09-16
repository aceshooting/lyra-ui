---
"@aceshooting/lyra-ui": minor
---

`<lr-table>` gains `rowExpandLabel?: (row, expanded) => string`, the accessible name for one row's
expand/collapse chevron. Every chevron was named from the same localized `expand`/`collapse` string,
so a long table exposed dozens of identically named Tab stops with no way to tell the rows apart —
the same shape as the inline editor's naming gap, on a different surface.

The default is unchanged, because this component has no row-header notion to derive row context from
(`rowKey` is an opaque identity, not a label), so a table that does not set the callback renders
byte-identically.
