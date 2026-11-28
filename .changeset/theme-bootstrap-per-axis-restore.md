---
"@aceshooting/lyra-ui": minor
---
The theme bootstrap and `startLyraStyle()` accept a per-axis restore policy (`restore: ['mode', 'accent']` or `data-lr-theme-restore="mode accent"`) that leaves unlisted style axes to the host, and the new `@aceshooting/lyra-ui/vite/theme-bootstrap.js` plugin serves, emits and references the classic `theme-bootstrap.js` asset for strict-CSP Vite apps.
