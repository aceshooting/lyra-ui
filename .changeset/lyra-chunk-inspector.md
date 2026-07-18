---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-chunk-inspector>`: a ranked retrieved-chunks "why this answer" panel — relevance score
bars with tier-mapped tones, expandable chunk text (state keyed by chunk id, survives streaming
reassignment), and `lyra-chunk-open` for landing a chunk in `lyra-document-viewer` with its anchor.
Virtualizes automatically above `virtualizeAt` rows via the existing `lyra-virtual-list`.
