---
"@aceshooting/lyra-ui": minor
---

Fixes several component presentation defects: emoji-picker rows now fill the grid and its search
field shows a visible placeholder from the new localized `emojiPickerSearchPlaceholder` string
(falling back to the search label when blank), overridable per instance with the new
`searchPlaceholder` property (`search-placeholder` attribute); file-input keeps its localized drop instruction
separate from the optional form label; file-icon truncates long labels with an ellipsis; closed
mobile app-rail panels no longer paint a shadow; floating collapsed multi-split panes hide their
adjacent divider; and checked switches use their checked fill even when an unchecked fill is set.

Markdown task lists now use the checkbox in place of the bullet, tables scroll horizontally with
word-aware cell wrapping, code remains left-to-right inside RTL documents, and the streaming plain
text fallback no longer displays template indentation. Markdown also gains opt-in progressive
streaming with `streaming-render="progressive"` and localized language labels plus source-copy
buttons for fenced code via `code-block-header` (`code-block-chrome` is an equivalent alias).
Both keep their previous defaults.
