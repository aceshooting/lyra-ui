---
'@aceshooting/lyra-ui': patch
---

`lr-context-inspector`, `lr-eval-run`, `lr-approval-queue`, and `lr-policy-summary` now cap their rendered rows at 500 and show a localized "only the first N are shown" notice (`part="limit"`) when the host-supplied collection is larger, preventing main-thread jank from very large agent sessions, evaluation batches, approval queues, or policy decision sets. Summary counts, progress bars, and dialog selection still reflect the full collection.
