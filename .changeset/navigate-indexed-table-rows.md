---
'@aceshooting/lyra-ui': patch
---

Restore cell-anchor navigation in CSV, dataset and spreadsheet viewers with more than 10,000 admitted inline body rows. Let the indexed source resolve its own row keys instead of overriding it with the array key callback. Navigation continues to work when a large table is replaced by a smaller one.

The three conditional bindings add 78 unpacked bytes: the package estimate is 22,543,419 bytes and the verified archive is 22,542,797 bytes. Raise only the unpacked ceiling to 22,543,424 bytes, five bytes above the estimate. Standalone gzip grows by two bytes for CSV and four bytes each for dataset and spreadsheet viewers.

The viewers barrel measures 460,904 gzip bytes, exceeding its previous 460,864-byte ceiling. Advance only that exceeded bundle ceiling to 460,928 bytes.

The packed consumer's complete core graph measures 5,666,723 raw bytes across 64 files. Raise its exceeded 5,666,688-byte ceiling to 5,666,752 bytes, with 29 bytes of headroom.
