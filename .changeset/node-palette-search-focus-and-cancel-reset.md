---
"@aceshooting/lyra-ui": patch
---

Fix `lr-node-palette`'s search field being the only `type="search"` field in its family with zero
focus-ring styling (its siblings `lr-thread-list`/`lr-emoji-picker` already wire this), and reset the
native search-cancel glyph to match.
