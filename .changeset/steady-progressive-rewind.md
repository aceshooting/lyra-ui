---
'@aceshooting/lyra-ui': patch
---

Keep progressive Markdown streaming active when a rewriting edit discards committed groups while a queued recompute still points past them, instead of freezing the progressive render for the rest of that stream.
