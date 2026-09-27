---
"@aceshooting/lyra-ui": patch
---

Regional locale fallback is now script- and region-aware. `zh-HK`, `zh-MO`, `zh-Hant` and `zh-Hant-HK` resolve to Traditional `zh-TW` instead of Simplified `zh-CN`, and a bare `pt` resolves to `pt-BR` (its CLDR likely region) even when `pt-PT` is also imported; messages, plural forms and `getLyraLocaleDirection()` all follow. `languageToCountry()` and `<lr-flag language>` give a region-less tag the region its script implies, so `zh-Hant` shows the Taiwan flag instead of sharing China's with `zh-Hans`.
