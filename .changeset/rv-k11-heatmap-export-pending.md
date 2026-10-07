---
"@aceshooting/lyra-ui": patch
---
lr-heatmap: `exportData('png')` returns an empty string, as documented, while a redraw is waiting for the heatmap to become visible, instead of the previous picture.
