---
"@aceshooting/lyra-ui": patch
---
lr-animated-image: the frozen-frame canvas is allocated at the image natural size instead of being scaled up by the device pixel ratio, cutting its memory by the ratio squared.
