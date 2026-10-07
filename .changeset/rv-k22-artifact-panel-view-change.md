---
"@aceshooting/lyra-ui": patch
---
`lr-artifact-panel` fires `lr-view-change` only when the view actually changes, and reads its `code` slot hydration-safely (as does `lr-agent-run` its `header`/`summary` slots).
