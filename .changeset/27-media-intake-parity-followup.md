---
'@aceshooting/lyra-ui': major
---

Media follow-ups. Migration notes:

- `lr-file-input`'s `multiple` now reads `multiple="false"` as false, like `lr-drop-zone` and `lr-attachment-trigger`; remove the attribute instead of setting it to `"false"` only if you relied on it enabling batches.
- `lr-drop-zone` gains `allowedMimeTypes`, `forbiddenMimeTypes`, `accepted-message` and `rejected-message`, matching `lr-file-input`.
- `lr-video`'s speed select is named by `avPlayerPlaybackRate`, shared with `lr-av-player`; a `videoPlaybackSpeed` string override no longer applies, so move it to `avPlayerPlaybackRate`.
- `lr-lightbox` no longer navigates on Arrow keys pressed in a slotted `actions` button or link.
- `lr-zoomable-frame` shares one set of owner-document focus listeners across frames and drops its theme watcher when `with-theme-sync` is turned off.
