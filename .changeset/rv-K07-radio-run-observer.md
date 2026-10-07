---
"@aceshooting/lyra-ui": patch
---
lr-radio-group no longer rebuilds its resize observer and re-reads layout for every option on each update, only when its options change.
