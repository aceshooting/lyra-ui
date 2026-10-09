---
"@aceshooting/lyra-ui": minor
---

`@aceshooting/lyra-ui/theme.js` exports `startLyraStyle()`, a storage-free runtime initializer for pages that inline only `lyraThemeBootstrap` and load the style runtime later. It adopts the saved style (or the defaults) on the document root and, while the mode is `system`, attaches the live `prefers-color-scheme` listener. It never calls `localStorage.setItem()`/`removeItem()`, does not migrate a v1 record, emits no `lr-style-change` of its own, and is idempotent. The previous workaround, `setLyraStyle({})`, persisted the record as a side effect.
