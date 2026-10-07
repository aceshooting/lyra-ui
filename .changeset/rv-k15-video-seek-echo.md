---
"@aceshooting/lyra-ui": patch
---
lr-video: a playing video no longer seeks to its own position on every native `timeupdate`; a requested `currentTime` is written to the element only when it differs from where the element is.
