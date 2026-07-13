---
"@aceshooting/lyra-ui": minor
---

`lyra-diff-view`'s copy-button aria-label now routes entirely through `this.localize('copyDiff', ...)`
instead of concatenating the localized "copy" verb with a hardcoded " diff" suffix. Default English
output ("Copy diff") is unchanged.
