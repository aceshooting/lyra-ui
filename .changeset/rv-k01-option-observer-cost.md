---
"@aceshooting/lyra-ui": patch
---
`lr-option` no longer re-renders on unrelated ancestor attribute changes and caches its accessible label, and `lr-combobox` derives its rows once per write and builds none for a printable key.
