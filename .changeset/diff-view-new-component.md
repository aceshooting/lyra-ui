---
"@aceshooting/lyra-ui": minor
---

Add `lyra-diff-view`: a real two-string line diff (LCS-aligned), rendered as interleaved
unified-diff output -- unlike diff-flavored syntax highlighting over an already-formatted string,
this computes the alignment itself, so a one-line change inside a longer block renders as one
red/green pair near the change instead of every old line then every new line.
