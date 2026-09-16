---
"@aceshooting/lyra-ui": patch
---

`lr-markdown` / `lr-markdown-core`: a fenced-block highlight batch whose tokenization rejected unexpectedly (for example a lazy `languages` loader whose memoized failure is re-thrown from its reporting hook) is now recorded as failed for every key in the batch, so the block settles on its plain-text fallback. Previously such a key was neither cached nor failed, and every re-render re-queued it into the same rejection in a microtask-tight loop that never yielded to the page.
