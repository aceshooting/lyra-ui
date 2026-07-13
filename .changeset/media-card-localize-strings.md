---
"@aceshooting/lyra-ui": minor
---

`lyra-media-card`'s hardcoded English fallback strings — the file-chip "Untitled file" name, the
`image`/`video` alt-text fallbacks ("Image attachment"/"Video attachment"), and the accessible
"Open …" label (both the named and generic-kind forms) — now route through `this.localize()`,
overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
override is set.
