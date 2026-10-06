---
"@aceshooting/lyra-ui": patch
---
lr-pdf-viewer: page and thumbnail canvases are capped at 16,777,216 pixels (16,384 per side), so large pages or deep zoom render at lower resolution instead of blank.
