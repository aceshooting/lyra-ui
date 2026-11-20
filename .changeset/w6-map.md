---
'@aceshooting/lyra-ui': patch
---

- Production builds now drop development diagnostics and their message text: the production diagnostics entry is marked side-effect free and `lr-map` plus the shared element, request, collection and optional-peer helpers guard each warning, so a bundler removes it even when the diagnostics module lands in a shared chunk. The `lr-map` bundle shrinks accordingly; development warnings are unchanged.
- `lr-map` no longer re-measures its container and canvas on every camera move of a geographic scene: a move re-reads only the padding and measures again when it changed, while resizes and padding updates still refresh the scene allocation.
- `lr-map` merges two identical glass-material rule sets and groups its action states, trimming its stylesheet without changing rendered styles.
- The shared engine-style resolver is smaller: its palette is a tree-shakeable literal and unused override and windowless branches are gone.
