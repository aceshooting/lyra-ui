---
'@aceshooting/lyra-ui': minor
---

`<lr-embedding-explorer>` now caps `points` rendering at 1,000 points and `<lr-mind-map>` now caps its currently-visible topic count at 500 nodes, each keeping a deterministic, distribution-preserving sample of the full input (spread across the whole array/tree rather than a leading run) instead of rendering every item, with a localized "showing N of M" notice exposed as the new `limit` CSS part.
