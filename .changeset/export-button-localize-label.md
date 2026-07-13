---
"@aceshooting/lyra-ui": minor
---

`lyra-export-button`'s trigger button text (default "Export", also reused for the format menu's
`aria-label`) now routes through `this.localize()` when `label` is left at its built-in default,
overridable via `.strings`/`registerLyraLocale()` — matching `lyra-attachment-chip`'s
`removeLabel`/`retryLabel` convention. Setting the `label` attribute/property explicitly still
overrides it directly. Default English output is unchanged when no override is set.
