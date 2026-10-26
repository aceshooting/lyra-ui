---
"@aceshooting/lyra-ui": patch
---

Preserve keyboard scroll intent through native smooth scrolling so Home, PageUp and upward arrow
navigation can release chat following. Clear obsolete intent after settlement, cancellation,
focus changes and explicit scroll commands, including virtual conversations. Prevented keys and
editing controls retain their native behavior.
