---
"@aceshooting/lyra-ui": patch
---
lr-tooltip keeps describing its trigger after its children are replaced wholesale (`textContent`, `innerHTML`, `replaceChildren()`).
