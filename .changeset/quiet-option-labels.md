---
'@aceshooting/lyra-ui': patch
---

Reduce work when updating explicit option labels in large select and combobox catalogs by preserving unchanged accessible-text observation. Content mutations, fallback labels, slot changes, and lifecycle transitions continue to refresh observation.
