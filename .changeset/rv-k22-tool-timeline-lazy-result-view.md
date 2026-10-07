---
"@aceshooting/lyra-ui": patch
---
`lr-tool-timeline` registers `lr-tool-result-view` when the first entry's details open instead of at import, so a timeline that never opens one does not load it.
