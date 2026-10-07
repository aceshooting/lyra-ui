---
"@aceshooting/lyra-ui": minor
---
lr-multi-split: new `lr-resize-change` event (`detail: { sizes }`) fires once after each keyboard step and once on pointer release after a drag, so a host can persist when the drag ends; like the other resize events it bubbles, so an ancestor listener should ignore events whose `target` is not the split.
