---
"@aceshooting/lyra-ui": patch
---

Avoid allocating a deferred Chromium root observer when the token layer and its root key are adopted immediately. Documents without a static token stylesheet no longer retain an unnecessary observer; documents with an existing stylesheet still defer the key until the root changes.

The final 28.0.0 version stamp changes compressed split-chunk routes: CDN autoloader 13,116 bytes, autoloader 12,935 bytes, scoped-registry loader 11,295 bytes, and tool-call-chip initial marginal 7,620 bytes. Their tight ceilings advance by 1 to 3 bytes to those exact measurements, with no added headroom; shell imports, peer exclusions, and passing ceilings are unchanged.
