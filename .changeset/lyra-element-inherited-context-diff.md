---
"@aceshooting/lyra-ui": patch
---

`LyraElement`'s ancestor `class`/`style` observer (kept for CSS-only direction/locale context changes) now only calls `requestUpdate()` when the resolved direction or locale actually changes, instead of on every ancestor `class`/`style` mutation regardless of relevance — an unrelated ancestor style write (e.g. an overlay's own stacking-index custom property) could otherwise schedule a spurious re-render.
