---
'@aceshooting/lyra-ui': patch
---

Treat a removed include source as idle in deferred loading. Retain the current included content without fetching or throwing, and allow a later source attribute to load normally.

Reset an ebook viewer to idle when its source is removed, including across reconnection, and allow a replacement book to load without a deferred null-string error.
