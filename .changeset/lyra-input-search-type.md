---
"@aceshooting/lyra-ui": minor
---

`lyra-input` gains `'search'` as a documented `LyraInputType` member. It already worked at runtime
via unchecked passthrough to the internal native `<input type="search">` (`type` has no runtime
validation), but the exported type union didn't include it, so a consumer setting `type="search"`
got no compile-time confirmation it was supported and no protection against a future stricter-typed
release silently dropping it.
