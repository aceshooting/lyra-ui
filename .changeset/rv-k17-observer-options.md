---
"@aceshooting/lyra-ui": patch
---
lr-intersection-observer and lr-mutation-observer: a new array with the same `threshold` or `attributeFilter` values no longer rebuilds the observer, so inline array bindings stop re-delivering initial entries.
