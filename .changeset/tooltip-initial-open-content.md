---
'@aceshooting/lyra-ui': patch
---

`lr-tooltip` opened before its first render (an `open` attribute, or `open` set while that render is pending) classifies its content after the first update settles, so actionable content still renders the popup as a dialog without triggering Lit's change-in-update warning.
