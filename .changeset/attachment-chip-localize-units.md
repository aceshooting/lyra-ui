---
"@aceshooting/lyra-ui": minor
---

`lyra-attachment-chip`'s file-size unit abbreviations ("B"/"KB"/"MB"/"GB"/"TB") now route through
`this.localize()` when rendered, overridable via `.strings`/`registerLyraLocale()`. The exported
`formatFileSize()` pure function gains an optional `unitLabel` resolver parameter, defaulting to the
plain English abbreviation — every existing single-argument call is unaffected.
