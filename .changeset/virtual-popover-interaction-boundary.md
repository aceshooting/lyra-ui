---
'@aceshooting/lyra-ui': minor
---

Add an optional `interactionBoundary` to `lr-popover.showAt()` so caller-owned virtual targets can toggle a popover without outside-pointer dismissal racing their click handler. The boundary affects only light dismissal and preserves caller-owned positioning, ARIA, and focus return.
