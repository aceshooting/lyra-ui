---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-thread-list>`'s exported `row-start`/`row-actions` parts sitting on the row's inline text
baseline (adding descender strut height above and below) instead of vertically centering their
`renderStart`/`renderActions` adornment content. Both parts are plain `<span>`s and default to
`display: inline`; they are now `display: inline-flex; align-items: center`, matching every other
adornment slot in the library. `row-content`/`row-meta`, which hold real text, are unaffected.
