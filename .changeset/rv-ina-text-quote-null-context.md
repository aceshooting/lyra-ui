---
"@aceshooting/lyra-ui": patch
---
Text-quote highlights deserialized from JSON no longer break highlighting in `lr-html-viewer`, `lr-email-viewer`, `lr-pptx-viewer`, `lr-include`, `lr-docx-viewer`, `lr-pdf-viewer`, `lr-markdown`, `lr-archive-viewer` and the other text viewers: a `null` `prefix` or `suffix` is now treated as absent, and a highlight whose `quote`, `prefix` or `suffix` is not a string (or throws when read) is skipped. Previously one such highlight made every update throw, so no highlight or search match painted and `updateComplete` rejected; `scrollToAnchor()` with such an anchor now resolves `false` instead of throwing.
