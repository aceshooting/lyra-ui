---
"@aceshooting/lyra-ui": patch
---

`<lr-table>`'s `TableColumn.cellStyle` hook now sanitizes every property/value pair before it
reaches `styleMap()`: the property name must match a safe CSS-identifier shape, the value must
contain no `;`/`{`/`}` structural characters or a `url(...)` function, and the browser must accept
the property/value pair via `CSS.supports()` (falling back to a permissive regex where
`CSS.supports` is unavailable). A custom property (`--foo`) is exempted from the `CSS.supports`
check, since arbitrary custom-property values are always valid CSS.
