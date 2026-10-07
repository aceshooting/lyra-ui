---
"@aceshooting/lyra-ui": patch
---
lr-usage-badge closes its tooltip on Escape with `preventDefault()` instead of stopping propagation, so document-level listeners still observe the key.
