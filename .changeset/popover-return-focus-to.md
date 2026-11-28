---
"@aceshooting/lyra-ui": minor
---
`lr-popover` gains `show({ returnFocusTo })` and a `returnFocusTo` property, so a popover opened by code next to an element returns focus there on Escape, light dismiss and `hide()` without writing any ARIA on that element.
