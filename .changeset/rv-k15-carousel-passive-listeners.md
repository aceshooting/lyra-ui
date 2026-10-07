---
"@aceshooting/lyra-ui": patch
---
lr-carousel: the scroll container listens for `wheel` and `touchstart` passively, so swipes and wheel scrolling no longer wait for the main thread.
