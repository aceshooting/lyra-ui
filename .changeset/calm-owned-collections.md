---
'@aceshooting/lyra-ui': patch
---

Keep clone-owned collection properties referentially stable when a declarative renderer rebinds
the same unchanged input, avoiding redundant work such as resetting an unchanged map style while
preserving explicit change detectors and updates made by assigning a new collection.
