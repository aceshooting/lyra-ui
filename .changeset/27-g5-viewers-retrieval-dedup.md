---
'@aceshooting/lyra-ui': minor
---

`lr-memory-panel`, `lr-retrieval-compare`, `lr-retrieval-trace` and `lr-research-progress` gain `frame` (`'card'` | `'plain'`) and `size` (dense under `s` and smaller). A `lr-chunk-inspector` with `ordinalIndex` set (every `lr-retrieval-results` row) no longer renders its own group, list and listitem semantics. Optional-peer load failures for `notebook-viewer`/`lr-icon` sanitizing, `pdfjs-dist`, `epubjs`, `mammoth` and `qrcode` now emit the shared fixed dev diagnostic (no error object) and a failed load is retried on the next use instead of being cached.
