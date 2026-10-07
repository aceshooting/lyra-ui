---
"@aceshooting/lyra-ui": major
---
lr-pagination: a gap that would hide exactly one page now shows that page, and the summary's item noun comes only from the plural `items` message (no separate `item` lookup), which also drops unused strings from the bundle. Migration: an app that overrode only `item` must override `items` (`{ one: 'entry', other: 'entries' }`).
