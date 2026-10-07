---
"@aceshooting/lyra-ui": patch
---
lr-tab-group: removing, disabling or inerting the active tab now moves selection to its following (else preceding) tab and emits `lr-tab-hide`/`lr-tab-show`, instead of silently selecting the first tab.
