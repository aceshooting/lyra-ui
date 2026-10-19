---
'@aceshooting/lyra-ui': patch
---

`lr-code-block` and `lr-code-block-core` no longer throw in DOM implementations without `Element.part`, such as Happy DOM test environments, so consumers need no shim; highlighted lines keep their `line-highlight` part wherever CSS parts exist.
