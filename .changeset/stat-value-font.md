---
'@aceshooting/lyra-ui': major
---

`lr-stat` values (headline, breakdown rows and the exact-value reveal) now use the surrounding text font with tabular digits instead of the monospace face, so text values such as names render correctly in every script, including Arabic. Set the new `--lr-stat-value-font-family: var(--lr-font-mono)` to keep the previous look.
