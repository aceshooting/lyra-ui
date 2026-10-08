---
'@aceshooting/lyra-ui': minor
---

`lr-command-palette` now emits `lr-hide` (non-cancelable, `{ reason }`, after an accepted `lr-close-request`), `lr-after-show` and `lr-after-hide`, matching the dialog lifecycle vocabulary. Veto a close through `lr-close-request`, as before. The `videoPlaybackSpeed` locale string was removed; `lr-video` reads `avPlayerPlaybackRate`.
