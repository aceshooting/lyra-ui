---
'@aceshooting/lyra-ui': patch
---

`lr-dock-panel` keeps focus on the panel itself when content collapses a panel that has no collapse toggle, instead of dropping it to `<body>`. `lr-accordion` skips the availability re-check for ancestor inline-style writes that touch no visibility declaration.
