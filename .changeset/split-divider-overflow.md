---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-split`'s fixed-percent panels not reserving space for the auto-inserted divider between
them, causing a deterministic `(panelCount - 1) * dividerWidth` container overflow in the default
(uncollapsed) state. Panels now get a nonzero `flex-shrink` so they absorb the dividers' own width
instead of the row overflowing.
