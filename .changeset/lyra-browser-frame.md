---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-browser-frame>`: a presentational "agent computer" viewport — a safe-URL-gated
screenshot/frame stream `<img>` (or slotted live media), read-only address bar, visible (never
color-only) connection status, kind-distinct action-ping overlays, and take-over/stop affordances
(`lyra-take-over`, `lyra-stop`). No automation transport and no input relay — take-over is an event;
the host swaps in its own interactive element.
