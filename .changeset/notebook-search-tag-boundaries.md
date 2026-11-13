---
'@aceshooting/lyra-ui': patch
---

Match complete script and style tag names when searching notebook HTML output, preserving visible text in other elements and ignoring hidden raw text after misleading closing-tag prefixes. Keep quoted attribute text out of search results when it contains greater-than characters.

The quote-aware scanner adds 861 raw bytes to the notebook module. Reviewed bundle and unpacked-package ceilings advance only where this fix exceeds them, to the next 64-byte boundary. The packed consumer remains at 64 emitted files, measured at 5,669,889 raw bytes with a 5,669,952-byte ceiling. Package contents and optional-peer exclusions are unchanged.
