---
"@aceshooting/lyra-ui": patch
---
`lr-time-range` uses the shared `ElementInternals` fallback, so validity stays honest where `attachInternals` is missing.
