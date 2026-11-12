---
'@aceshooting/lyra-ui': patch
---

Keep map feature clicks available while unchanged overlay layers prepare an in-place GeoJSON data
refresh. Changes to source options, layers, interaction rules, or other map resources retain the
preparation guard, as do disabled and inert maps.
