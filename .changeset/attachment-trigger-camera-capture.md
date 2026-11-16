---
'@aceshooting/lyra-ui': minor
---

`lr-attachment-trigger` gains an opt-in `camera-capture` attribute (`'environment'` or `'user'`). On an engine that supports the native `capture` attribute (phones and tablets), the `camera` capability then opens the hidden file input with `accept="image/*"` and that `capture` value inside the same user gesture and reports the photo through `lr-files` with `capability: 'camera'`. Desktop browsers keep firing `lr-camera-request`, so a host can keep its own camera dialog there. Unset, `camera` stays request-only. New exported types: `LyraAttachmentCameraCapture` and `LyraAttachmentFilesCapability`.
