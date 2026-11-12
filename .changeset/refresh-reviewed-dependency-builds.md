---
'@aceshooting/lyra-ui': patch
'@aceshooting/lyra-docs': patch
'@aceshooting/lyra-map': patch
---

Refresh dependency versions and generated package artifacts. Qualify the latest optional peers while preserving supported consumer ranges, and update the map style specification dependency to 26.6.0. Rebuild the document engine with Vite 8.3.8 and the reviewed ProseMirror model 1.25.13 dependency.

Retain coverage counter safeguards and the dev-server dependency security patch with the upgraded test runner.

The map dependency rebuild changes the archive from 1,051,147 to 1,051,391 packed bytes while reducing unpacked bytes from 4,295,831 to 4,295,701, with the same 677 files. Advance only the exceeded packed ceiling to the next 64-byte boundary, 1,051,392 bytes.
