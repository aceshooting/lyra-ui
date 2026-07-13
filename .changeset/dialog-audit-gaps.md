---
"@aceshooting/lyra-ui": minor
---

`lyra-dialog`: add `noLightDismiss` to opt out of backdrop-click dismissal, and make `close()`
actually respect a `lyra-dialog-close` listener's `preventDefault()` (the event is now genuinely
`cancelable: true`) for every dismissal path — Escape, backdrop, the built-in close button, and a
consumer's own `close()` call.
