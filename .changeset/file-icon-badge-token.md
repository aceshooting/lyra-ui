---
'@aceshooting/lyra-ui': minor
---

`lr-file-icon` now shows a short, unlocalized format token (or a generic glyph when no token applies or the badge is too small) inside its icon badge. The full localized label remains in the accessible name and `mode="label"`, and the promised logical-start ellipsis now works. Custom metadata records can provide a trimmed `abbreviation` of up to eight code points; blank values fall back to extension matching. Because a consumer record owns its MIME mapping, its `label` remains verbatim and supplies the accessible name for that record. Source-picker group rows no longer derive a badge token from folder labels.
