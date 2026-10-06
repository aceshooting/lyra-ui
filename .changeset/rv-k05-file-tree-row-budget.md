---
"@aceshooting/lyra-ui": minor
---
lr-file-tree: a listing larger than the composed tree's 1,000-row budget no longer silently drops every entry after the 1,000th (for example all top-level folders after a large `node_modules/`); collapsed directories are then projected as single rows whose children load from the snapshot on expansion, and the new read-only `dataTruncated` getter reports any entries still omitted.
