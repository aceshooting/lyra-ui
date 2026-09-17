---
"@aceshooting/lyra-ui": patch
---

`<lr-table>`'s `editType: 'select'` cell editor now shows a themed disclosure chevron instead of
looking like a plain text field. `appearance: none` on `select[part='cell-editor']` removed the
native arrow with no replacement; the glyph is repainted on the enclosing `[part='cell']` (a bare
`<select>` cannot host a decorative child, and a `mask` can't apply to the select itself without
clipping its own text), using the same mask + `background: currentColor` technique already shipped
for the map attribution-toggle glyph, positioned at the logical inline-end edge so it mirrors
correctly under `dir="rtl"` and survives `forced-colors: active`. The `text`/`number` cell editors
are unaffected.
