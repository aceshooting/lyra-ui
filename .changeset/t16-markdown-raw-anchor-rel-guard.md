---
'@aceshooting/lyra-ui': patch
---

Fix `lr-markdown` and `lr-markdown-core` now force `rel="noopener noreferrer"` (merging any author-supplied `rel` and stripping `opener`) onto a raw HTML `<a target="...">` written directly in Markdown content, closing a reverse-tabnabbing gap that previously affected only that raw-HTML path — markdown-syntax `[text](url)` links with `link-target` set were already guarded.
