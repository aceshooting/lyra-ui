---
"@aceshooting/lyra-ui": patch
---
lr-color-picker: `format` accepts hex, rgb, hsl and hsv case-insensitively (`rgba` names rgb, with alpha from `opacity`); any other value is `hex` instead of silently serializing as hsl.
