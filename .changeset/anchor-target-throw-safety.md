---
"@aceshooting/lyra-ui": patch
---

Fix `DocumentAnchorTarget` (the shared mixin behind every viewer's `.scrollToAnchor()`) so a
throwing `applyAnchor()` reliably degrades to a resolved `false` and still emits
`lr-anchor-result:{found:false}`, instead of leaving the promise rejected and the documented
"always reports a definite result" contract broken. A previous attempt at this (a blanket
try/catch) was reverted because it made `lr-ebook-viewer`'s own override's localized
rendition-failure alert unreachable; `scrollToAnchor()` is now split into a thin public wrapper
carrying the safety net and a `performScrollToAnchor()` the mixin's own subclasses (currently only
`lr-ebook-viewer`) can call directly to bypass it and keep full control of their own catch.
