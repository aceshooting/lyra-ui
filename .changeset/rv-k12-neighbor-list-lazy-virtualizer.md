---
"@aceshooting/lyra-ui": patch
---
lr-neighbor-list (and lr-entity-dossier and lr-knowledge-graph-explorer through it) loads lr-virtual-list only when a list first exceeds `virtualizeAt`, so short lists no longer ship the virtualizer.
