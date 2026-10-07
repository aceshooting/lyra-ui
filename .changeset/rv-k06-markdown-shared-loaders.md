---
"@aceshooting/lyra-ui": patch
---
lr-markdown, lr-markdown-core: DOMPurify now loads through the shared loader, so its missing-peer development warning is the shared message, and a `marked` or `katex` module without the expected API now warns once like a failed import.
