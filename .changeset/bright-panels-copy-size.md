---
'@aceshooting/lyra-ui': minor
---

Add the shared optional size ladder to copy buttons. Keep viewport modals above ancestor stacking contexts and preserve their visual order across reconnects. Avoid redundant layout measurements and stale navigation-menu resize callbacks, and correct tooltip, sizing, and theme-contrast documentation.

Shared modal ordering and exit handling, allocation-preserving drawers, and copy-button sizing add runtime code; their required guides and generated editor data increase archive sizes. Only exceeded bundle and archive ceilings advance to the next 64-byte boundary after composition review; passing limits, measurement inputs and the UI download cap remain unchanged.
