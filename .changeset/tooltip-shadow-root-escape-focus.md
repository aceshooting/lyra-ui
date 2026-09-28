---
'@aceshooting/lyra-ui': patch
---

`lr-tooltip`: pressing Escape from actionable tooltip content now returns focus to the trigger when the tooltip lives inside an open shadow root, instead of letting focus fall to the document body. `lr-popover`: focus inside the popup content now keeps a hover or focus popover open inside an open shadow root, instead of closing it when the pointer leaves.
