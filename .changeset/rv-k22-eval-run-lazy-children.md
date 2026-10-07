---
"@aceshooting/lyra-ui": patch
---
`lr-eval-run` registers its Markdown, code-block, grounding-summary and tool-timeline children when the first example expands instead of at import, so a collapsed batch no longer ships roughly 95 KB gzip of unused UI.
