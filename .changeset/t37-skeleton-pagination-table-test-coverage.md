---
'@aceshooting/lyra-ui': patch
---

No functional change: added regression coverage confirming `lr-skeleton` stays accessible while `announce` is set (mounting its `role="status"` live region), and that `lr-pagination` and `lr-table` correctly parse `has-next="false"` written as a plain HTML attribute string, not just as a JS property binding.
