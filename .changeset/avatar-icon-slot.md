---
"@aceshooting/lyra-ui": minor
---

`lyra-avatar` now accepts default-slotted icon/glyph content (e.g. an inline SVG), shown in place of
the image/initials and taking priority over both `src` and `initials` — useful for a chat UI
distinguishing an "AI" avatar from a "user" avatar by role glyph rather than a photo or initials. Set
`alt` alongside the icon for an accessible name, since the glyph itself is treated as decorative.
