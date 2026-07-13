---
"@aceshooting/lyra-ui": minor
---

`lyra-chart`'s data-table "Category" column header, per-row "Point N" fallback label, and "Reset
zoom" button text now route through `this.localize()`, overridable via `.strings`/
`registerLyraLocale()`. Default English text is unchanged.
