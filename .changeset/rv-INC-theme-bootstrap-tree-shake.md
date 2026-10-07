---
"@aceshooting/lyra-ui": patch
---
`theme.js` no longer ships the pre-paint bootstrap generator (about 3 KB gzip) to bundles that only call `setLyraStyle()` or `getLyraStyle()`.
