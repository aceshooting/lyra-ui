---
"@aceshooting/lyra-ui": minor
---

`lyra-widget` gains a `backdrop-inset` prop to decouple the fullscreen backdrop's inset from the panel's own `fullscreen-inset`. Falls back to `fullscreen-inset`, so existing consumers are unaffected.
