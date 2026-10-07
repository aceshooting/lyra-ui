---
"@aceshooting/lyra-ui": patch
---
Glass surfaces keep their solid resting fill in engines without `light-dark()` (Chromium 120-122, Safari 17.0-17.4) instead of painting no background under the blur.
