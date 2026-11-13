---
'@aceshooting/lyra-ui': patch
---

Report a map custom layer as unavailable when an optional bridge handle throws during capability validation. Attempt disposal independently and contain cleanup failures so a broken bridge cannot leave the layer loading or cause an unhandled promise rejection; a replacement layer can still install.

The fix adds 99 unpacked bytes, measuring 22,546,560 bytes in the UI archive and 22,547,182 in the npm estimate across the same 3,289 files. Only the exceeded unpacked ceiling advances to the next 64-byte boundary; all bundle gzip limits remain unchanged.
