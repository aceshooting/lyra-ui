---
"@aceshooting/lyra-ui": minor
---

Fix `<lr-control-group>` collapsing to 0 inline size when placed as an ordinary flex-basis:auto
child of a shrink-to-fit flex row (its own stated primary use case). The `@container`
narrow-allocation breakpoint is now opt-in via a new `responsive` property instead of always-on.
