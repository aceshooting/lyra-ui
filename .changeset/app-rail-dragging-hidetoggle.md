---
"@aceshooting/lyra-ui": minor
---

`lyra-app-rail` gains `dragging` (reflected boolean, true for the duration of a pointer-driven
resize -- not a keyboard step -- so its own `[part='base']` transition suppresses during the drag
instead of visibly "chasing" the pointer) and `hideToggle` (suppresses the built-in mobile hamburger
button for a consumer that owns its own external toggle wired to `open`).
