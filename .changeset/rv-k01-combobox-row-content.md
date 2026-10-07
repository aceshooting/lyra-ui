---
"@aceshooting/lyra-ui": patch
---
`lr-combobox` async rows now accept `icon`, `start` and `end` only as text, DOM nodes, Lit templates or flat lists of those, so a malformed JSON row can no longer break rendering.
