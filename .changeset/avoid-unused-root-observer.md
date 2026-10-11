---
"@aceshooting/lyra-ui": patch
---

Avoid allocating a deferred Chromium root observer when the token layer and its root key are adopted immediately. Documents without a static token stylesheet no longer retain an unnecessary observer; documents with an existing stylesheet still defer the key until the root changes.
