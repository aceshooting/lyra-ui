---
"@aceshooting/lyra-ui": minor
---

Completed a full-library i18n/RTL/styling standardization pass across the remaining component
families not yet covered by earlier rounds — `chart` (and `box-plot`/`histogram`/`lite-chart`),
`avatar`, `code-block`, `combobox`, `date-picker`, `dialog`, `document-preview`, `export-button`,
`file-input`, `graph`, `heatmap`, `map`, `time-range`, `tool-call-chip`, `tool-param-form`,
`tool-result-dialog`, `tree`, `widget`, and several smaller components. Highlights:

- Routed remaining hardcoded English strings (accessible descriptions, aria-labels, empty-state
  text) through `this.localize()`.
- Fixed RTL gaps: `date-picker`'s previous/next chevrons now mirror under `dir="rtl"` (rotating
  the wrapping `part`, not the icon), matching the grid's own arrow-key swap.
- `lyra-avatar`: fixed a dangling `--lyra-color-surface-alt` token reference, corrected its `size`
  JSDoc, and extended the accessible-name role/`aria-label` to the initials-fallback path (not
  just the icon-slot path) whenever `alt` is set.
- `lyra-export-button` now fires `lyra-show`/`lyra-hide` on its format menu, matching the same
  convention already used by `lyra-menu`/`lyra-select`/`lyra-combobox`.
- Fixed a `this.localize(key, literalFallback)` pattern that unconditionally short-circuited
  `registerLyraLocale()` lookups for the affected keys (the fallback is now omitted wherever
  `DEFAULT_STRINGS` already carries the same default).

AGENTS.md gained a new "Internationalization (i18n), RTL, and theming" section documenting the
resulting standard, and both READMEs now summarize it for consumers.
