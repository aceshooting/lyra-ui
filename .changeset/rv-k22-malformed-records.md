---
"@aceshooting/lyra-ui": patch
---
`lr-prompt-studio`, `lr-context-inspector` and `lr-agent-run` skip or normalize malformed records (a `null` variable, a non-array `redactions`, a run without `status`) instead of throwing and blanking the component.
