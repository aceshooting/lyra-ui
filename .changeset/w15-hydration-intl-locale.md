---
'@aceshooting/lyra-ui': patch
---

Fix server-rendered `Intl` text staying in the server's locale after hydration under an ancestor `lang` (`lr-format-number`, `lr-format-date`, `lr-format-bytes`, `lr-relative-time` and every other component that formats through the effective locale). The hydrating first render now formats in the locale the server resolved, and the next render commits the inherited locale.
