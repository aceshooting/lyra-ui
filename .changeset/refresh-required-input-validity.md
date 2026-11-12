---
'@aceshooting/lyra-ui': patch
---

Refresh native constraint validity after `required` changes on `lr-input`, `lr-number-input`, and
`lr-native-time-input`, so owning forms validate and submit correctly without a manual validity refresh.
Correct the dropdown menu example to supply its fallback accessible name through `aria-label`.
