---
"@aceshooting/lyra-ui": patch
---
lr-stepper, lr-segmented, lr-widget: reassigning the same `steps`/`items`/`views` array no longer re-snapshots and re-renders, so a focused segment keeps focus when a parent re-renders.
