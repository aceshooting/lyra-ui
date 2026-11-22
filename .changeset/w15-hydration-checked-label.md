---
'@aceshooting/lyra-ui': patch
---

Fix the label of a server-rendered `lr-checkbox` staying hidden after hydration. The shared label-presence check now waits until the hydrating first render has reproduced the server markup, then reveals the slotted label on the next render.
