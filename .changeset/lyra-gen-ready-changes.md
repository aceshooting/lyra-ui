---
"@aceshooting/lyra-gen": minor
---

`lr-gen-ready` now carries `changes` — the node ids a revision `added`, `changed` and `removed` since the previous ready revision of the same surface (absent for a surface's first one) — and the added and changed components carry the unstyled `changed` part until the next ready revision, so hosts can highlight a refinement. The new `diffViews(previous, next)` helper computes the same comparison.
