---
'@aceshooting/lyra-ui': patch
---

- A chart that cannot rebuild after the annotation plugin registers now reports one development-only diagnostic per page instead of a console warning in production.
- Optional-peer loaders share one capability check for the methods they call; accepted and rejected peer shapes are unchanged.
- Components whose message keys resolve entirely to their own local key maps no longer ship unrelated English fallback strings in their default-string slices.
