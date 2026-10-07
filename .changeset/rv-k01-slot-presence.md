---
"@aceshooting/lyra-ui": patch
---
`lr-locale-picker`, `lr-emoji-picker` and `lr-token-input` hide hint, error and adornment wrappers whose forwarded slots carry no content, like `lr-select` and `lr-combobox`.
