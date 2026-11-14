---
'@aceshooting/lyra-ui': patch
---

Prevent ResizeObserver loop errors when a virtual list's local viewport follows its content, including slotted transcripts in an agent workspace. Row and group measurements now apply together on the next frame in both local and external scrolling modes, preserving scroll-anchor corrections while avoiding size writes during observer delivery.
