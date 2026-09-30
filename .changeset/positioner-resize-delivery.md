---
'@aceshooting/lyra-ui': patch
---

Coalesce element resize positioning updates into the next animation frame to prevent resize-delivery errors when an open anchored surface changes size. Initial placement, scrolling and layout shifts remain immediate; queued resize updates are canceled when placement is disposed.

Reduce temporary placement allocations while preserving rollback and consumer-owned styles.
