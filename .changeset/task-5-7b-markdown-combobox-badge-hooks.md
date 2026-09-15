---
"@aceshooting/lyra-ui": minor
---

Completes the brand-quiet inline-surface hooks for the two remaining components. Same
shape as that sweep's other fifteen hooks — an inline `var()` fallback at the point of use, so
default rendering stays byte-identical when unset.

- **New:** `<lr-markdown>` (and `<lr-markdown-core>`, which shares its stylesheet)'s
  `--lr-markdown-table-header-bg` (default `var(--lr-color-brand-quiet)`) retints every rendered
  `[part='table']` header cell, independent of the already-hooked `--lr-markdown-code-bg`/
  `-highlight-*-bg` tokens in the same file.
- **New:** `<lr-combobox>`'s `--lr-combobox-option-badge-bg` (default `var(--lr-color-brand-quiet)`)
  retints the `[part='option-badge']` trailing metadata badge on an async row, and the "not in
  catalog" badge `show-unknown-option` renders on a synthetic unmatched-value row, matching
  `<lr-select>`'s already-shipped `--lr-select-option-badge-bg`.
