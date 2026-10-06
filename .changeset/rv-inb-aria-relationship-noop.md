---
"@aceshooting/lyra-ui": patch
---
Controls that forward `aria-describedby` or `aria-labelledby` to an inner element no longer rewrite the relationship and rebuild its observer on every update when nothing changed.
