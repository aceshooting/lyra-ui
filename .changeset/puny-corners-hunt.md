---
"@aceshooting/lyra-ui": minor
---

`lyra-widget` gains two new named slots, `collapse-icon` and `fullscreen-icon`, overriding the
built-in chevron/expand-or-close glyphs on the collapse and fullscreen toggle buttons entirely
(platform slot-fallback-content mechanism: whatever is assigned wins, otherwise the default glyph
renders unchanged). `WidgetView`'s `label` is now optional and a new `ariaLabel` field lets a view
toggle be icon-only while still exposing an accessible name — previously a toggle with no `label`
had no accessible name at all.
