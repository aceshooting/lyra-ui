---
'@aceshooting/lyra-ui': patch
---

`lr-rag-eval-dashboard`, `lr-grounding-summary`, `lr-claim-evidence`, `lr-memory-panel`, and `lr-funnel` now cap their rendered rows at 500 and show a localized "only the first N are shown" notice (`part="limit"`) when the host-supplied collection is larger, preventing main-thread jank from very large evaluation runs, citation sets, claim sets, memory lists, or funnel stage sets. `lr-calendar` caps event markers at 4 per month-view day cell and at 500 in agenda view, showing a localized "+N more" notice (`part="event-limit"`/`part="agenda-limit"`) rather than mounting an unbounded number of event buttons. Summary counts and computed values (latest metric readings, funnel shares) still reflect the full collection.
