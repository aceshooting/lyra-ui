---
"@aceshooting/lyra-ui": patch
---
lr-chip now accepts `variant="primary"` as the brand tone (it used to fall back to neutral), and lr-progress-bar / lr-progress-ring fall back to their documented `brand` default for an unsupported `variant` instead of painting neutral.
