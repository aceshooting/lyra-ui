---
'@aceshooting/lyra-ui': patch
---

Preserve click pinning when popover or dropdown trigger lists combine click with hover or focus. Clicking an already revealed surface keeps it open without moving focus, while a second click dismisses it. Disabled or vetoed click openings no longer leave a stale pin behind.
