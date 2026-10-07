---
"@aceshooting/lyra-ui": patch
---
lr-icon-button: a slotted bare SVG `<use>` keeps its same-document `href` (`xlink:href` is written as `href`) instead of losing it when cloned, while external and script references are still stripped.
