---
"@aceshooting/lyra-ui": patch
---
`lr-rubric-form`, `lr-agent-question`, `lr-eval-result` and `lr-stack-trace` ignore a re-bound identical `keys`/`value`/`schema`/`internalPatterns` object, so a parent re-render no longer wipes the reviewer's unsaved answers or folds expanded internal frames.
