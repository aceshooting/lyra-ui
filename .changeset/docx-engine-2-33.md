---
'@aceshooting/lyra-docs': patch
---

Upgrade the bundled document engine to 2.33.0 while preserving lazy feature loading and asynchronous command readiness. Documents gain upstream rendering and layout fixes, including SmartArt, drawing groups, diagonal cell borders, East Asian spacing and right-to-left layout. Rich paste in suggesting mode is admitted with the same captured routing as edit mode. The Ecma notice for the preset shape geometry the engine now bundles ships in `THIRD_PARTY_LICENSES`, and self-contained layout helpers load from their own distribution module so every engine module stays below 500 kB.
