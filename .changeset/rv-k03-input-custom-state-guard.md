---
"@aceshooting/lyra-ui": patch
---
`lr-input`, `lr-number-input` and `lr-textarea` set their `blank`/`focused` custom states through the guarded helper, so engines that reject a state name no longer break updates.
