---
"@aceshooting/lyra-ui": patch
---
`lr-trace-tree` builds its span hierarchy once per update (previously twice) and not at all per key press.
