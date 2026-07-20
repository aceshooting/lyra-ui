---
"@aceshooting/lyra-ui": minor
---

Add `getRegisteredLyraLocales()` and `subscribeLyraLocaleRegistry()` so a consumer can enumerate
and live-track every locale registered via `registerLyraLocale()` (plus `'en'`) — the piece that
unblocks a locale-picker component built on top of the existing locale runtime.
