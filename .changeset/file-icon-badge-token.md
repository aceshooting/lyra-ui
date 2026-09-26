---
'@aceshooting/lyra-ui': minor
---

`lr-file-icon` now shows a short, unlocalized format token (or a generic glyph when no token applies or the badge is too small) inside its icon badge. The full localized label remains in the accessible name and `mode="label"`, and the promised logical-start ellipsis now works. Custom metadata records can provide a trimmed `abbreviation` of up to eight code points; blank values fall back to extension matching. Because a consumer record owns its MIME mapping, its `label` remains verbatim and supplies the accessible name for that record. `fileType*` string overrides (`.strings`, `registerLyraLocale()`) now affect only the accessible name and `mode="label"`; set `abbreviation` on a registry record to control the badge text instead. Source-picker group rows no longer derive a badge token from folder labels.

**Baseline change.** The badge no longer exports its text's baseline. In every engine and in both the token and glyph states it now exports a synthesized baseline at the badge's bottom edge, like an image. A consumer row using `align-items: baseline` will see the icon shift down relative to sibling text; the default inline `vertical-align: middle` placement and centered rows are unaffected.
