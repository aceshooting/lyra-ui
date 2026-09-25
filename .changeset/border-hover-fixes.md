---
'@aceshooting/lyra-ui': patch
---

Two border fixes:

- `lr-stat`: a linked tile now shows its hover border when the pointer rests on slotted content (a `sub`, `caption` or `spark` slot, for example), not only when it rests on the tile itself. On that same path, `frame="plain"` no longer shows the lift shadow; it keeps the underline it shows for any other hover.
- `lr-agent-eval-dashboard`: run rows no longer show the native button border on three sides. Only the intended top divider remains.
