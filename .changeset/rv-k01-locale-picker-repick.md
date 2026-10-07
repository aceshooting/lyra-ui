---
"@aceshooting/lyra-ui": patch
---
`lr-locale-picker` no longer re-commits the current locale: picking it (or re-typing it on the closed trigger) only closes the list instead of firing `lr-change` and re-localizing the page.
