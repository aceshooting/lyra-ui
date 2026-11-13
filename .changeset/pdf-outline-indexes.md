---
'@aceshooting/lyra-ui': patch
---

Resolve PDF outline bookmarks that identify pages with zero-based integer indexes, including named destinations and the first page. Only valid pages within the document are exposed; unresolved bookmark titles and children remain available.

The verified package changes one runtime module (+71 raw bytes, +23 standalone gzip bytes). The installed core consumer adds 47 raw bytes across the same 64 files. Only exceeded archive and bundle limits advance to the next 64-byte boundary; package contents and optional-peer exclusions remain unchanged.
