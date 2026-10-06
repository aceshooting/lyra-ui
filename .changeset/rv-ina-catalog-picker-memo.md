---
"@aceshooting/lyra-ui": patch
---
`lr-model-select` and `lr-voice-picker` no longer re-normalize, re-copy and re-lowercase their whole catalog several times per render and per keystroke: rows, the stale-value row, lowercased search keys and filter results are now derived once per catalog, value, locale and query.
